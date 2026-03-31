
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Loader2, 
  Plus, 
  Trash2, 
  Copy, 
  Clock, 
  MapPin, 
  Coffee, 
  School, 
  CalendarX,
  CalendarDays,
  Sparkles,
  Activity,
  PlusCircle,
  CheckCircle2,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  AlertCircle,
  XCircle,
  CalendarClock,
  Zap,
  Crown,
  Info,
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
  type DailyRoutineBlock,
  type DailyRoutinePlan,
  type RoutineWorkspaceState,
  type StudyPlanItem,
  type WithId,
  type GrowthProgress,
  type RecommendedRoutine,
  type StudentProfile,
  type UserStudyProfile,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ROUTINE_TEMPLATE_OPTIONS,
  type AttendanceAwaySlot,
  type RecentStudyOption,
  type StudyAmountUnit,
  type StudyPlanMode,
} from '@/components/dashboard/student-planner/planner-constants';
import { RoutineComposerCard } from '@/components/dashboard/student-planner/routine-composer-card';
import { StudyComposerCard } from '@/components/dashboard/student-planner/study-composer-card';
import { PlanItemCard } from '@/components/dashboard/student-planner/plan-item-card';
import { ScheduleItemCard } from '@/components/dashboard/student-planner/schedule-item-card';
import { RecentStudySheet } from '@/components/dashboard/student-planner/recent-study-sheet';
import { RepeatCopySheet } from '@/components/dashboard/student-planner/repeat-copy-sheet';
import { StudyPlanSheet } from '@/components/dashboard/student-planner/study-plan-sheet';
import { PlannerTemplateSheet } from '@/components/dashboard/student-planner/planner-template-sheet';
import { PlannerChecklistItem } from '@/components/dashboard/student-planner/planner-checklist-item';
import { RoutineOnboardingFlow } from '@/components/dashboard/student-planner/routine-onboarding-flow';
import { RoutineHome } from '@/components/dashboard/student-planner/routine-home';
import { RoutineEditor } from '@/components/dashboard/student-planner/routine-editor';
import { ReflectionSheet } from '@/components/dashboard/student-planner/reflection-sheet';
import { RoutineBlockSheet } from '@/components/dashboard/student-planner/routine-block-sheet';
import { RoutinePrivacySheet } from '@/components/dashboard/student-planner/routine-privacy-sheet';
import {
  addReflectionEntry,
  addRoutineBlock,
  applyRoutineBlockToggle,
  buildInitialRoutineWorkspace,
  refreshRoutineWorkspaceForToday,
  removeRoutineBlock,
  updateRoutineBlock,
} from '@/lib/routine-workspace';
import {
  buildInitialRoutineSocialProfile,
  getVisibilityLabel,
} from '@/lib/routine-social';
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
  const shouldRenderLegacyPlanner = process.env.NEXT_PUBLIC_PLAN_TRACK_LEGACY === '1';
  const rewardGradient = 'from-[#14295F] via-[#1B326D] to-[#233E86]';
  const [planTrackEntryMode, setPlanTrackEntryMode] = useState<'auto' | 'onboarding' | 'planner'>('auto');
  const [routineSurfaceMode, setRoutineSurfaceMode] = useState<'home' | 'editor'>('home');
  const [routineWorkspace, setRoutineWorkspace] = useState<RoutineWorkspaceState | null>(null);
  const [isReflectionSheetOpen, setIsReflectionSheetOpen] = useState(false);
  const [isRoutineBlockSheetOpen, setIsRoutineBlockSheetOpen] = useState(false);
  const [isRoutinePrivacySheetOpen, setIsRoutinePrivacySheetOpen] = useState(false);
  const [selectedRoutineBlock, setSelectedRoutineBlock] = useState<DailyRoutineBlock | null>(null);
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
  const [isRecentStudyLoading, setIsRecentStudyLoading] = useState(false);
  const [activeRecentStudyKey, setActiveRecentStudyKey] = useState<string | null>(null);

  const [inTime, setInTime] = useState('09:00');
  const [outTime, setOutTime] = useState('22:00');
  const [awayStartTime, setAwayStartTime] = useState('');
  const [awayEndTime, setAwayEndTime] = useState('');
  const [awayReason, setAwayReason] = useState('');
  const [extraAwayPlans, setExtraAwayPlans] = useState<AttendanceAwaySlot[]>([]);

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
    if (!searchParams.get('privacy')) return;
    setIsRoutinePrivacySheetOpen(true);
  }, [searchParams]);

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
  const routineSocialProfile = useMemo(
    () =>
      buildInitialRoutineSocialProfile({
        studyProfile: studentProfile?.studyRoutineProfile,
        socialProfile: studentProfile?.routineSocialProfile,
        studentName: studentProfile?.name || activeMembership?.displayName || user?.displayName,
        gradeLabel: studentProfile?.grade,
      }),
    [
      activeMembership?.displayName,
      studentProfile?.grade,
      studentProfile?.name,
      studentProfile?.routineSocialProfile,
      studentProfile?.studyRoutineProfile,
      user?.displayName,
    ]
  );

  useEffect(() => {
    if (shouldRenderLegacyPlanner || !isStudent || planTrackEntryMode !== 'auto' || isStudentProfileLoading) return;
    if (studentProfile?.studyRoutineProfile?.selectedRoutineId) {
      setPlanTrackEntryMode('planner');
      return;
    }
    setPlanTrackEntryMode('onboarding');
  }, [
    isStudent,
    isStudentProfileLoading,
    planTrackEntryMode,
    shouldRenderLegacyPlanner,
    studentProfile?.studyRoutineProfile?.selectedRoutineId,
  ]);

  useEffect(() => {
    if (shouldRenderLegacyPlanner || !isStudent || !studentProfile?.studyRoutineProfile) return;
    setRoutineWorkspace((previous) => {
      const baseWorkspace = previous || studentProfile.studyRoutineWorkspace;
      return refreshRoutineWorkspaceForToday(studentProfile.studyRoutineProfile!, baseWorkspace);
    });
  }, [isStudent, shouldRenderLegacyPlanner, studentProfile?.studyRoutineProfile, studentProfile?.studyRoutineWorkspace]);

  const fetchRecentStudyOptions = useCallback(async () => {
    if (!firestore || !user || !activeMembership || !isStudent || recentStudyWeekKeys.length === 0) {
      setRecentStudyOptions([]);
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

  const hasInPlan = useMemo(() => scheduleItems.some(i => i.title.includes('등원 예정')), [scheduleItems]);
  const hasOutPlan = useMemo(() => scheduleItems.some(i => i.title.includes('하원 예정')), [scheduleItems]);
  const hasAwayPlan = Boolean(awayStartTime && awayEndTime) || extraAwayPlans.some((slot) => Boolean(slot.startTime && slot.endTime));
  const isAbsentMode = useMemo(() => scheduleItems.some(i => i.title.includes('등원하지 않습니다')), [scheduleItems]);

  const seedRecommendedRoutineToPlanner = useCallback(async (routine: RecommendedRoutine) => {
    if (isPast || !firestore || !user || !activeMembership || !weekKey || !selectedDateKey) return;
    if ((dailyPlans?.length || 0) > 0) return;

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

    const batch = writeBatch(firestore);
    routine.studyBlocks.forEach((block, index) => {
      batch.set(doc(itemsCollectionRef), {
        title: block.title,
        done: false,
        weight: Math.max(1, routine.studyBlocks.length - index),
        dateKey: selectedDateKey,
        category: 'study',
        subject: block.subjectId || null,
        studyPlanMode: 'time',
        targetMinutes: block.durationMinutes,
        startTime: block.startTime,
        endTime: block.endTime,
        priority: index <= 1 ? 'high' : 'medium',
        tag: block.kind === 'review' ? '복습' : block.kind === 'memorization' ? '암기' : undefined,
        studyPlanWeekId: weekKey,
        centerId: activeMembership.id,
        studentId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
  }, [activeMembership, dailyPlans?.length, firestore, isPast, selectedDateKey, user, weekKey]);

  const handleSaveRoutineProfile = useCallback(async (profile: UserStudyProfile, selectedRoutine: RecommendedRoutine) => {
    if (!firestore || !user || !activeMembership || !studentProfileRef) return;

    const fallbackDisplayName =
      studentProfile?.name ||
      activeMembership.displayName ||
      user.displayName ||
      '학생';
    const nextSocialProfile = buildInitialRoutineSocialProfile({
      studyProfile: profile,
      socialProfile: studentProfile?.routineSocialProfile,
      studentName: fallbackDisplayName,
      gradeLabel: studentProfile?.grade,
    });

    await setDoc(
      studentProfileRef,
      {
        id: user.uid,
        name: fallbackDisplayName,
        schoolName: studentProfile?.schoolName || '학교 미정',
        grade: studentProfile?.grade || '학년 미정',
        seatNo: studentProfile?.seatNo || 0,
        targetDailyMinutes: studentProfile?.targetDailyMinutes || 240,
        parentUids: studentProfile?.parentUids || [],
        createdAt: studentProfile?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        studyRoutineProfile: {
          ...profile,
          createdAt: studentProfile?.studyRoutineProfile?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        studyRoutineWorkspace: {
          ...buildInitialRoutineWorkspace(profile),
          updatedAt: serverTimestamp(),
          lastOpenedAt: serverTimestamp(),
        },
        routineSocialProfile: {
          ...nextSocialProfile,
          updatedAt: serverTimestamp(),
        },
      },
      { merge: true }
    );

    await seedRecommendedRoutineToPlanner(selectedRoutine);
    setRoutineWorkspace(buildInitialRoutineWorkspace(profile));
    toast({
      title: '추천 루틴 저장 완료',
      description: '오늘부터 바로 쓸 수 있는 루틴이 계획트랙에 반영됐어요.',
    });
  }, [activeMembership, firestore, seedRecommendedRoutineToPlanner, studentProfile, studentProfileRef, toast, user]);

  const persistRoutineWorkspace = useCallback(async (nextWorkspace: RoutineWorkspaceState) => {
    if (!studentProfileRef) return;
    setRoutineWorkspace(nextWorkspace);
    await setDoc(
      studentProfileRef,
      {
        studyRoutineWorkspace: {
          ...nextWorkspace,
          updatedAt: serverTimestamp(),
          lastOpenedAt: serverTimestamp(),
        },
      },
      { merge: true }
    );
  }, [studentProfileRef]);

  const handleToggleRoutineBlock = useCallback(async (blockId: string) => {
    if (!routineWorkspace) return;
    await persistRoutineWorkspace(applyRoutineBlockToggle(routineWorkspace, blockId));
  }, [persistRoutineWorkspace, routineWorkspace]);

  const handleSaveRoutineBlock = useCallback(async (
    blockDraft: Omit<DailyRoutineBlock, 'id' | 'sequence' | 'done'>,
    blockId?: string
  ) => {
    if (!routineWorkspace) return;
    const nextWorkspace = blockId
      ? updateRoutineBlock(routineWorkspace, blockId, blockDraft)
      : addRoutineBlock(routineWorkspace, blockDraft);
    await persistRoutineWorkspace(nextWorkspace);
  }, [persistRoutineWorkspace, routineWorkspace]);

  const handleDeleteRoutineBlock = useCallback(async (blockId: string) => {
    if (!routineWorkspace) return;
    await persistRoutineWorkspace(removeRoutineBlock(routineWorkspace, blockId));
  }, [persistRoutineWorkspace, routineWorkspace]);

  const handleSubmitReflection = useCallback(async (
    reflection: Parameters<typeof addReflectionEntry>[1]
  ) => {
    if (!routineWorkspace) return;
    await persistRoutineWorkspace(addReflectionEntry(routineWorkspace, reflection));
    toast({
      title: '하루 회고 저장 완료',
      description: '내일 이어갈 포인트까지 같이 남겨뒀어요.',
    });
  }, [persistRoutineWorkspace, routineWorkspace, toast]);

  const handleSaveRoutineSocialProfile = useCallback(async (nextSocialProfile: typeof routineSocialProfile) => {
    if (!studentProfileRef) return;

    const patch: Record<string, unknown> = {
      routineSocialProfile: {
        ...nextSocialProfile,
        updatedAt: serverTimestamp(),
      },
    };
    if (studentProfile?.studyRoutineProfile) {
      patch.studyRoutineProfile = {
        sharingPreference: nextSocialProfile.visibility,
        updatedAt: serverTimestamp(),
      };
    }

    await setDoc(
      studentProfileRef,
      patch,
      { merge: true }
    );

    toast({
      title: '공유 설정 저장 완료',
      description: '기본값은 여전히 조용한 참고형 공개로 유지됩니다.',
    });
    setIsRoutinePrivacySheetOpen(false);
  }, [routineSocialProfile, studentProfile?.studyRoutineProfile, studentProfileRef, toast]);

  useEffect(() => {
    const arrival = scheduleItems.find((item) => item.title.startsWith('등원 예정: '));
    const dismissal = scheduleItems.find((item) => item.title.startsWith('하원 예정: '));
    const awayItems = scheduleItems
      .filter((item) => item.title.startsWith('외출 예정'))
      .map((item) => parseAwayScheduleTitle(item.title))
      .filter((item): item is AttendanceAwaySlot => Boolean(item))
      .sort((left, right) => left.startTime.localeCompare(right.startTime));

    setInTime(arrival?.title.split(': ')[1] || '09:00');
    setOutTime(dismissal?.title.split(': ')[1] || '22:00');

    if (awayItems.length > 0) {
      const [firstAway, ...restAway] = awayItems;
      setAwayStartTime(firstAway.startTime);
      setAwayEndTime(firstAway.endTime);
      setAwayReason(firstAway.reason);
      setExtraAwayPlans(restAway);
    } else {
      setAwayStartTime('');
      setAwayEndTime('');
      setAwayReason('');
      setExtraAwayPlans([]);
    }
  }, [scheduleItems]);

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

  const handleSetAttendance = async (type: 'attend' | 'absent') => {
    if (isPast || !firestore || !user || !activeMembership || !weekKey || !selectedDateKey) return;
    setIsSubmitting(true);
    
    const batch = writeBatch(firestore);
    const colRef = collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items');

    try {
      scheduleItems.filter(i => i.title.includes('등원') || i.title.includes('하원') || i.title.includes('외출 예정')).forEach(i => {
        batch.delete(doc(colRef, i.id));
      });

      if (type === 'attend') {
        const normalizedAwayPlans = [
          createAwaySlot({
            id: 'away-primary',
            startTime: awayStartTime,
            endTime: awayEndTime,
            reason: awayReason.trim(),
          }),
          ...extraAwayPlans.map((slot) =>
            createAwaySlot({
              id: slot.id,
              startTime: slot.startTime,
              endTime: slot.endTime,
              reason: slot.reason.trim(),
            })
          ),
        ].filter((slot) => slot.startTime && slot.endTime);

        batch.set(doc(colRef), {
          title: `등원 예정: ${inTime}`,
          done: false, weight: 0, dateKey: selectedDateKey, category: 'schedule',
          studyPlanWeekId: weekKey, centerId: activeMembership.id, studentId: user.uid,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        batch.set(doc(colRef), {
          title: `하원 예정: ${outTime}`,
          done: false, weight: 0, dateKey: selectedDateKey, category: 'schedule',
          studyPlanWeekId: weekKey, centerId: activeMembership.id, studentId: user.uid,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        normalizedAwayPlans.forEach((slot) => {
          const awayLabel = slot.reason ? `외출 예정 · ${slot.reason}: ${slot.startTime} ~ ${slot.endTime}` : `외출 예정: ${slot.startTime} ~ ${slot.endTime}`;
          batch.set(doc(colRef), {
            title: awayLabel,
            done: false, weight: 0, dateKey: selectedDateKey, category: 'schedule',
            studyPlanWeekId: weekKey, centerId: activeMembership.id, studentId: user.uid,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp()
          });
        });
      } else {
        batch.set(doc(colRef), {
          title: `이날 등원하지 않습니다`,
          done: false, weight: 0, dateKey: selectedDateKey, category: 'schedule',
          studyPlanWeekId: weekKey, centerId: activeMembership.id, studentId: user.uid,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
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

  if (!isStudent) {
    return <div className="flex items-center justify-center h-[400px] px-4"><Card className="max-w-md w-full rounded-[2.5rem] border-none shadow-2xl"><CardHeader className="text-center"><CardTitle className="font-black text-2xl tracking-tighter">학생 전용 페이지</CardTitle><CardDescription className="font-bold">학생 계정으로 로그인해야 학습 계획을 관리할 수 있습니다.</CardDescription></CardHeader></Card></div>;
  }

  if (!selectedDate) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  if (!shouldRenderLegacyPlanner && (planTrackEntryMode === 'auto' || isStudentProfileLoading)) {
    return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;
  }

  if (!shouldRenderLegacyPlanner && planTrackEntryMode === 'onboarding') {
    return (
      <RoutineOnboardingFlow
        studentName={studentProfile?.name || activeMembership.displayName || user?.displayName || '학생'}
        onSaveRoutineProfile={handleSaveRoutineProfile}
        onContinueToPlanner={() => setPlanTrackEntryMode('planner')}
      />
    );
  }

  if (!shouldRenderLegacyPlanner) {
    if (!routineWorkspace) {
      return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;
    }

    return (
      <>
        {routineSurfaceMode === 'editor' ? (
          <RoutineEditor
            routine={routineWorkspace.activeRoutine}
            onBack={() => setRoutineSurfaceMode('home')}
            onSaveBlock={handleSaveRoutineBlock}
            onDeleteBlock={handleDeleteRoutineBlock}
          />
        ) : (
          <RoutineHome
            studentName={studentProfile?.name || activeMembership.displayName || user?.displayName || '학생'}
            workspace={routineWorkspace}
            sharingLabel={getVisibilityLabel(routineSocialProfile.visibility)}
            onToggleBlock={handleToggleRoutineBlock}
            onOpenEditor={() => setRoutineSurfaceMode('editor')}
            onOpenPrivacy={() => setIsRoutinePrivacySheetOpen(true)}
            onOpenReflection={() => setIsReflectionSheetOpen(true)}
            onEditBlock={(block) => {
              setSelectedRoutineBlock(block);
              setIsRoutineBlockSheetOpen(true);
            }}
          />
        )}

        <RoutineBlockSheet
          open={isRoutineBlockSheetOpen}
          onOpenChange={(open) => {
            setIsRoutineBlockSheetOpen(open);
            if (!open) setSelectedRoutineBlock(null);
          }}
          block={selectedRoutineBlock}
          onSave={(blockDraft) => void handleSaveRoutineBlock(blockDraft, selectedRoutineBlock?.id)}
          onDelete={selectedRoutineBlock ? (blockId) => void handleDeleteRoutineBlock(blockId) : undefined}
        />

        <ReflectionSheet
          open={isReflectionSheetOpen}
          onOpenChange={setIsReflectionSheetOpen}
          onSubmit={(reflection) => void handleSubmitReflection(reflection)}
        />

        <RoutinePrivacySheet
          open={isRoutinePrivacySheetOpen}
          onOpenChange={setIsRoutinePrivacySheetOpen}
          socialProfile={routineSocialProfile}
          studyProfile={studentProfile?.studyRoutineProfile}
          studentName={studentProfile?.name || activeMembership.displayName || user?.displayName || '학생'}
          schoolName={studentProfile?.schoolName}
          gradeLabel={studentProfile?.grade}
          onSave={(nextProfile) => void handleSaveRoutineSocialProfile(nextProfile)}
        />
      </>
    );
  }

  return (
    <div className={cn("flex flex-col w-full max-w-5xl mx-auto pb-24", isMobile ? "gap-3 px-0" : "gap-10")}>
      <header className={cn("flex flex-col", isMobile ? "gap-1 px-1" : "gap-2")}>
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className={cn("font-black tracking-tighter text-primary leading-none", isMobile ? "text-xl" : "text-4xl")}>계획트랙</h1>
            <p className={cn("font-bold text-muted-foreground mt-1", isMobile ? "text-[8px] uppercase tracking-widest" : "text-sm")}>
              {isPast ? '과거 기록 보기' : '일일 학습 매트릭스 · 루틴'}
            </p>
          </div>
          {isPast ? (
            <Badge variant="destructive" className={cn("rounded-full font-black px-3 py-1 shadow-lg", isMobile ? "text-[8px] h-6" : "text-[10px]")}>기록 모드</Badge>
          ) : (
            <Badge className={cn("rounded-full font-black gap-2 border-none text-white shadow-lg bg-gradient-to-r", isMobile ? "text-[8px] h-7 px-3" : "text-[10px] h-9 px-4", rewardGradient)}>
              <Zap className={cn(isMobile ? "h-3 w-3" : "h-4 w-4")} /> 포인트 보상 활성
            </Badge>
          )}
        </div>
      </header>

      <div className={cn("flex items-center justify-between", isMobile ? "px-0 gap-1" : "gap-3")}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => moveWeek(-1)}
          className={cn(
            "shrink-0 rounded-xl border-2 bg-white text-primary hover:bg-primary hover:text-white",
            isMobile ? "h-9 w-9" : "h-11 w-11"
          )}
          aria-label="지난 주 보기"
        >
          <ChevronLeft className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
        </Button>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-center">
            <span className={cn("font-black text-primary/60", isMobile ? "text-[10px]" : "text-xs")}>
              {weekRangeLabel}
            </span>
          </div>
          <div className={cn("grid grid-cols-7 gap-1 sm:gap-4", isMobile ? "px-0" : "px-0")}>
            {weekDays.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const isTodayBtn = isSameDay(day, new Date());
              return (
                <button
                  key={day.toISOString()}
                  className={cn(
                    "flex flex-col items-center justify-center transition-all duration-500 rounded-[1.25rem] sm:rounded-[2.5rem] border-2 h-auto py-2.5 sm:py-5 shrink-0",
                    isMobile ? "px-0" : "px-4",
                    isSelected
                      ? cn("border-transparent shadow-xl scale-105 z-10 text-white bg-gradient-to-br", rewardGradient)
                      : "bg-white border-transparent hover:border-primary/20",
                    isTodayBtn && !isSelected && "border-primary/30"
                  )}
                  onClick={() => setSelectedDate(day)}
                >
                  <span className={cn("font-black uppercase tracking-widest leading-none", isMobile ? "text-[7px] mb-1" : "text-[10px] mb-2", isSelected ? "text-white/60" : "text-muted-foreground/40")}>{format(day, 'EEE', { locale: ko })}</span>
                  <span className={cn("font-black tracking-tighter tabular-nums leading-none", isMobile ? "text-base" : "text-2xl", isSelected ? "text-white" : "text-primary")}>{format(day, 'd')}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => moveWeek(1)}
          className={cn(
            "shrink-0 rounded-xl border-2 bg-white text-primary hover:bg-primary hover:text-white",
            isMobile ? "h-9 w-9" : "h-11 w-11"
          )}
          aria-label="다음 주 보기"
        >
          <ChevronRight className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
        </Button>
      </div>

      {!isPast && (
        <Card className={cn(
          "border-none shadow-2xl overflow-hidden transition-all duration-700 bg-white ring-1 ring-black/[0.03]",
          "relative group",
          isMobile ? "rounded-[1.25rem]" : "rounded-[2.5rem]",
          isToday && "opacity-80"
        )}>
          <div className={cn("h-1.5 w-full bg-gradient-to-r", rewardGradient)} />
          <CardHeader className={cn("bg-muted/5 border-b", isMobile ? "p-4" : "p-8")}>
            <div className="flex items-center justify-between">
              <CardTitle className={cn("font-black tracking-tighter flex items-center gap-2", isMobile ? "text-base" : "text-2xl")}>
                <CalendarClock className={cn("text-primary", isMobile ? "h-5 w-5" : "h-7 w-7")} /> {isToday ? '오늘의 출석 정보' : '출석 설정'}
              </CardTitle>
              {isToday ? (
                <Badge className={cn("bg-amber-50 text-amber-700 border border-amber-200 font-black text-[8px] uppercase tracking-widest px-2 py-0.5 shadow-sm")}>
                  당일 수정 시 벌점 +{SAME_DAY_ROUTINE_PENALTY_POINTS}
                </Badge>
              ) : (
                <Badge className={cn("bg-white text-primary border-none font-black text-[8px] uppercase tracking-widest px-2 py-0.5 shadow-sm")}>1단계</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className={cn(isMobile ? "p-4" : "p-8 sm:p-10")}>
            {(!hasInPlan || !hasOutPlan) && !isAbsentMode ? (
              <div className={isMobile ? "space-y-6" : "flex flex-col gap-10"}>
                <div className={cn("grid gap-4 sm:gap-8", isMobile ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]")}>
                  <div className={cn(isMobile ? "space-y-3" : "space-y-4", !isMobile && "min-w-0")}>
                    <div className="flex items-center gap-2 ml-1">
                      <Zap className={cn("text-amber-500 fill-amber-500", isMobile ? "h-3 w-3" : "h-4 w-4")} />
                      <Label className={cn("font-black text-primary uppercase tracking-widest", isMobile ? "text-[9px]" : "text-xs")}>등원 계획</Label>
                    </div>
                    <div className={cn("gap-2 sm:gap-3", isMobile ? "flex flex-col" : "flex flex-col xl:flex-row xl:items-end")}>
                        <div className={cn("grid w-full min-w-0", isMobile ? "grid-cols-2 gap-1 sm:gap-2" : "grid-cols-2 gap-2 sm:gap-3 xl:flex-1")}>
                          <div className="space-y-1">
                            <span className={cn("font-black opacity-40 ml-1", isMobile ? "text-[7px]" : "text-[10px]")}>등원 예정</span>
                          <Input type="time" value={inTime} onChange={e => setInTime(e.target.value)} className={cn("rounded-xl border-2 font-black shadow-inner focus-visible:ring-primary/20", isMobile ? "h-9 text-xs px-2" : "h-14 text-xl")} />
                        </div>
                        <div className="space-y-1">
                          <span className={cn("font-black opacity-40 ml-1", isMobile ? "text-[7px]" : "text-[10px]")}>하원 예정</span>
                          <Input type="time" value={outTime} onChange={e => setOutTime(e.target.value)} className={cn("rounded-xl border-2 font-black shadow-inner focus-visible:ring-primary/20", isMobile ? "h-9 text-xs px-2" : "h-14 text-xl")} />
                          </div>
                        </div>
                        <Button onClick={() => handleSetAttendance('attend')} disabled={isSubmitting} className={cn("touch-manipulation rounded-xl font-black shadow-xl active:scale-95 transition-all text-white bg-gradient-to-br", isMobile ? "w-full h-10 text-xs" : "h-14 px-10 mt-6 text-lg", rewardGradient)}>설정 완료</Button>
                    </div>
                    <div className={cn("rounded-[1.2rem] border border-primary/10 bg-primary/[0.03]", isMobile ? "p-3 space-y-2" : "p-4 space-y-3")}>
                      <div className="flex items-center gap-2 ml-1">
                        <Clock className={cn("text-primary", isMobile ? "h-3 w-3" : "h-4 w-4")} />
                        <Label className={cn("font-black text-primary uppercase tracking-widest", isMobile ? "text-[9px]" : "text-xs")}>외출 일정</Label>
                        <span className={cn("font-bold text-muted-foreground", isMobile ? "text-[8px]" : "text-[10px]")}>학원/병원/식사 등</span>
                      </div>
                      <div className={cn("grid", isMobile ? "grid-cols-2 gap-2" : "grid-cols-[minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,1fr)] gap-3")}>
                        <div className="space-y-1">
                          <span className={cn("font-black opacity-40 ml-1", isMobile ? "text-[7px]" : "text-[10px]")}>외출 시작</span>
                          <Input type="time" value={awayStartTime} onChange={e => setAwayStartTime(e.target.value)} className={cn("rounded-xl border-2 font-black shadow-inner focus-visible:ring-primary/20", isMobile ? "h-9 text-xs px-2" : "h-12 text-lg")} />
                        </div>
                        <div className="space-y-1">
                          <span className={cn("font-black opacity-40 ml-1", isMobile ? "text-[7px]" : "text-[10px]")}>복귀 예정</span>
                          <Input type="time" value={awayEndTime} onChange={e => setAwayEndTime(e.target.value)} className={cn("rounded-xl border-2 font-black shadow-inner focus-visible:ring-primary/20", isMobile ? "h-9 text-xs px-2" : "h-12 text-lg")} />
                        </div>
                        <div className={cn("space-y-1", isMobile ? "col-span-2" : "")}>
                          <span className={cn("font-black opacity-40 ml-1", isMobile ? "text-[7px]" : "text-[10px]")}>사유</span>
                          <Input value={awayReason} onChange={e => setAwayReason(e.target.value)} placeholder="예: 영어학원, 병원, 저녁 식사" className={cn("rounded-xl border-2 font-black shadow-inner focus-visible:ring-primary/20", isMobile ? "h-9 text-xs px-2" : "h-12 text-sm")} />
                        </div>
                      </div>
                      <p className={cn("font-semibold text-muted-foreground", isMobile ? "text-[9px]" : "text-[11px]")}>
                        사유와 시간이 모두 있으면 등원 계획과 함께 외출 일정도 저장됩니다.
                      </p>
                    </div>
                  </div>
                  
                  <div className={cn("flex flex-col justify-center items-center", isMobile ? "border-t border-dashed pt-4" : "border-t border-dashed pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0")}>
                    <p className={cn("font-bold text-muted-foreground mb-3", isMobile ? "text-[10px]" : "text-xs")}>오늘은 공부를 쉬어갑니다.</p>
                    <Button variant="outline" onClick={() => handleSetAttendance('absent')} disabled={isSubmitting} className={cn("touch-manipulation w-full rounded-xl border-2 border-rose-200 text-rose-600 font-black hover:bg-rose-50 gap-2 transition-all active:scale-95", isMobile ? "h-11 text-sm" : "h-14 text-lg")}>
                      <XCircle className={cn(isMobile ? "h-4 w-4" : "h-6 w-6")} /> 이날 등원하지 않습니다
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className={cn("flex items-center justify-between rounded-[1.5rem] bg-[#fafafa] border-2 border-transparent shadow-inner relative group overflow-hidden", isMobile ? "p-4 gap-3" : "p-8")}>
                <div className={cn("absolute inset-0 opacity-[0.03] pointer-events-none bg-gradient-to-br", rewardGradient)} />
                <div className={cn("flex items-center gap-4 relative z-10", isMobile ? "flex-row text-left" : "flex-row")}>
                  <div className={cn("p-2.5 rounded-2xl shadow-lg text-white bg-gradient-to-br", isAbsentMode ? "from-rose-500 to-rose-700" : rewardGradient)}>
                    {isAbsentMode ? <XCircle className={cn(isMobile ? "h-5 w-5" : "h-8 w-8")} /> : <CheckCircle2 className={cn(isMobile ? "h-5 w-5" : "h-8 w-8")} />}
                  </div>
                  <div className="grid">
                    <span className={cn("font-black tracking-tighter text-primary", isMobile ? "text-sm" : "text-2xl")}>{isAbsentMode ? '오늘 휴무' : '출석 설정 완료'}</span>
                    {!isAbsentMode && <span className={cn("font-bold text-muted-foreground", isMobile ? "text-[10px]" : "text-sm")}>{inTime} ~ {outTime}</span>}
                    {!isAbsentMode && hasAwayPlan && awayStartTime && awayEndTime && (
                      <span className={cn("font-bold text-primary/70 break-keep", isMobile ? "text-[9px]" : "text-xs")}>
                        외출 {awayStartTime} ~ {awayEndTime}{awayReason.trim() ? ` · ${awayReason.trim()}` : ''}
                      </span>
                    )}
                  </div>
                </div>
                {!isPast && (
                  <button onClick={() => {
                    const batch = writeBatch(firestore!);
                    const colRef = collection(firestore!, 'centers', activeMembership!.id, 'plans', user!.uid, 'weeks', weekKey, 'items');
                    scheduleItems.filter(i => i.title.includes('등원') || i.title.includes('하원') || i.title.includes('등원하지 않습니다') || i.title.includes('외출 예정')).forEach(i => batch.delete(doc(colRef, i.id)));
                    batch.commit().then(async () => {
                      if (isToday) {
                        await applySameDayRoutinePenalty('당일 출석 루틴 초기화');
                        toast({
                          title: `당일 루틴 수정으로 벌점 ${SAME_DAY_ROUTINE_PENALTY_POINTS}점 반영`,
                          description: '당일 출석 루틴은 수정 가능하지만 벌점이 자동 반영됩니다.',
                        });
                      }
                      toast({ title: "설정을 재설정합니다." });
                    });
                  }} className={cn("font-black uppercase text-muted-foreground underline underline-offset-4 hover:text-primary transition-all relative z-10", isMobile ? "text-[8px]" : "text-[10px]")}>재설정</button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className={cn("border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white ring-1 ring-black/[0.03]", isMobile && "rounded-[1.5rem]")}>
        <div className={cn("h-1.5 w-full bg-gradient-to-r", rewardGradient)} />
        <CardHeader className={cn("border-b bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(245,249,255,0.94)_100%)]", isMobile ? "p-4" : "p-8")}>
          <div className={cn("flex gap-4", isMobile ? "flex-col" : "items-start justify-between")}>
            <div className="min-w-0">
              <Badge className="border-none bg-primary/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-primary shadow-none">
                설정 스튜디오
              </Badge>
              <CardTitle className={cn("mt-3 font-black tracking-tight text-primary break-keep", isMobile ? "text-xl" : "text-3xl")}>
                루틴과 공부 계획을 한 곳에서 빠르게 정리해요
              </CardTitle>
              <CardDescription className={cn("mt-2 break-keep text-slate-500", isMobile ? "text-[11px] leading-5" : "text-sm leading-6")}>
                생활 루틴부터 학습 계획, 기타 일정까지 여기서 전체 설정을 끝내고 기록트랙에서는 빠르게만 손보세요.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="rounded-full border border-primary/10 bg-white px-3 py-1 text-[10px] font-black text-primary shadow-sm">
                {format(selectedDate, 'yyyy. MM. dd', { locale: ko })}
              </Badge>
              <Badge className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black text-slate-600 shadow-sm">
                루틴 {routineCountLabel}
              </Badge>
              <Badge className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700 shadow-sm">
                학습 {studyCountLabel}
              </Badge>
              <Badge className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-700 shadow-sm">
                기타 {personalCountLabel}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className={cn("bg-[#fafafa] space-y-5", isMobile ? "p-4" : "p-8")}>
          <section className={cn("overflow-hidden rounded-[1.85rem] border border-primary/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,250,255,0.96)_100%)] shadow-[0_18px_44px_-34px_rgba(20,41,95,0.22)]", isMobile && "rounded-[1.45rem]")}>
            <div className={cn("space-y-4", isMobile ? "p-4" : "p-6")}>
              <div className={cn("flex gap-3", isMobile ? "flex-col" : "items-start justify-between")}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="rounded-2xl bg-primary/7 p-2.5 text-primary">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className={cn("font-black tracking-tight text-primary", isMobile ? "text-base" : "text-xl")}>생활 루틴</h3>
                      <p className={cn("break-keep text-slate-500", isMobile ? "text-[11px] leading-5" : "text-sm leading-6")}>
                        등원, 하원, 식사, 학원처럼 매일 반복되는 흐름부터 먼저 정리해요.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full border border-primary/10 bg-white px-3 py-1 text-[10px] font-black text-primary shadow-sm">
                    현재 {routineCountLabel}
                  </Badge>
                  {isToday ? (
                    <Badge className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-700 shadow-sm">
                      당일 수정 시 벌점 +{SAME_DAY_ROUTINE_PENALTY_POINTS}
                    </Badge>
                  ) : null}
                </div>
              </div>

              {isToday ? (
                <div className="rounded-[1.35rem] border border-amber-200 bg-amber-50/80 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-black text-amber-900">당일 루틴 수정 주의</p>
                      <p className="mt-1 break-keep text-[11px] font-semibold leading-5 text-amber-800/80">
                        오늘 루틴도 수정할 수 있지만 벌점은 하루 최대 1점만 자동 반영됩니다.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {!isPast ? (
                <RoutineComposerCard
                  title="생활 루틴 추가"
                  description="템플릿으로 빠르게 시작하고, 필요한 이름만 바로 고쳐서 저장해요."
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
                  selectedTemplateKey={selectedRoutineTemplateKey}
                  onTemplateSelect={handleRoutineTemplateSelect}
                  templateOptions={ROUTINE_TEMPLATE_OPTIONS}
                />
              ) : null}

              {isLoading ? (
                <div className="flex justify-center py-14">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/20" />
                </div>
              ) : scheduleItems.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-primary/15 bg-white/72 p-6 text-center">
                  <p className="text-sm font-black text-primary">아직 루틴이 없어요</p>
                  <p className="mt-2 break-keep text-[11px] font-semibold leading-5 text-slate-500">
                    등원, 하원, 식사처럼 자주 반복되는 루틴을 먼저 만들어두면 하루 관리가 훨씬 쉬워져요.
                  </p>
                  {!isPast ? (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {ROUTINE_TEMPLATE_OPTIONS.filter((item) => item.key !== 'custom').slice(0, 6).map((template) => (
                        <Button
                          key={template.key}
                          type="button"
                          variant="outline"
                          className="h-8 rounded-full border-primary/15 bg-white px-3 text-[10px] font-black text-primary"
                          onClick={() => handleRoutineTemplateSelect(template)}
                        >
                          {template.label}
                        </Button>
                      ))}
                    </div>
                  ) : null}
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
                        isPast={isPast}
                        isToday={isToday}
                        isMobile={isMobile}
                      />
                    ))}
                </div>
              )}
            </div>
          </section>
          <section className={cn("overflow-hidden rounded-[1.85rem] border border-emerald-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,253,248,0.96)_100%)] shadow-[0_18px_44px_-34px_rgba(16,185,129,0.18)]", isMobile && "rounded-[1.45rem]")}>
            <div className={cn("space-y-4", isMobile ? "p-4" : "p-6")}>
              <div className={cn("flex gap-3", isMobile ? "flex-col" : "items-start justify-between")}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="rounded-2xl bg-emerald-500/10 p-2.5 text-emerald-600">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className={cn("font-black tracking-tight text-slate-900", isMobile ? "text-base" : "text-xl")}>학습 계획</h3>
                      <p className={cn("break-keep text-slate-500", isMobile ? "text-[11px] leading-5" : "text-sm leading-6")}>
                        전에 쓰던 계획을 불러와서 조금만 바꾸거나, 새 목표를 바로 짧게 적어둘 수 있어요.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-[10px] font-black text-emerald-700 shadow-sm">
                    완료 {completedStudyCount}/{studyTasks.length}
                  </Badge>
                  <Badge className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black text-slate-600 shadow-sm">
                    {studyGoalSummaryLabel}
                  </Badge>
                </div>
              </div>

              {!isPast ? (
                <StudyComposerCard
                  title="학습 계획 추가"
                  description="최근 계획을 먼저 불러오거나, 시간형과 분량형 중 편한 방식으로 바로 적어보세요."
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
                  isRecentLoading={isRecentStudyLoading}
                  recentOptions={visibleRecentStudyOptions}
                  onPrefillRecent={handlePrefillRecentStudy}
                  onOpenRecentSheet={() => setIsRecentStudySheetOpen(true)}
                  activeRecentTitle={activeRecentStudyOption?.title || null}
                  onResetRecentPrefill={resetStudyComposerPrefill}
                />
              ) : null}

              {studyTasks.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-emerald-200 bg-white/80 p-6 text-center">
                  <p className="text-sm font-black text-emerald-700">첫 학습 계획을 추가해보세요</p>
                  <p className="mt-2 break-keep text-[11px] font-semibold leading-5 text-slate-500">
                    시간을 먼저 정하지 않아도 괜찮아요. 오늘 끝낼 분량부터 적어도 바로 시작할 수 있어요.
                  </p>
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
                        disabled={isPast}
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
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </section>
          <section className={cn("overflow-hidden rounded-[1.85rem] border border-amber-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,251,245,0.96)_100%)] shadow-[0_18px_44px_-34px_rgba(251,146,60,0.18)]", isMobile && "rounded-[1.45rem]")}>
            <div className={cn("space-y-4", isMobile ? "p-4" : "p-6")}>
              <div className={cn("flex gap-3", isMobile ? "flex-col" : "items-start justify-between")}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="rounded-2xl bg-amber-500/10 p-2.5 text-amber-600">
                      <CalendarDays className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className={cn("font-black tracking-tight text-slate-900", isMobile ? "text-base" : "text-xl")}>기타 일정</h3>
                      <p className={cn("break-keep text-slate-500", isMobile ? "text-[11px] leading-5" : "text-sm leading-6")}>
                        병원, 약속, 시험 준비처럼 공부 외 일정은 보조 카드로 짧게만 관리해요.
                      </p>
                    </div>
                  </div>
                </div>
                <Badge className="rounded-full border border-amber-100 bg-white px-3 py-1 text-[10px] font-black text-amber-700 shadow-sm">
                  완료 {completedPersonalCount}/{personalTasks.length}
                </Badge>
              </div>

              {!isPast ? (
                <Card className="overflow-hidden rounded-[1.6rem] border-none bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(255,251,245,0.96)_100%)] ring-1 ring-amber-100/80 shadow-[0_18px_44px_-34px_rgba(245,158,11,0.18)]">
                  <CardHeader className={cn(isMobile ? "p-4 pb-3" : "p-6 pb-4")}>
                    <div className="flex items-center gap-2">
                      <div className="rounded-2xl bg-amber-500/10 p-2 text-amber-600">
                        <PlusCircle className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className={cn("font-black tracking-tight text-slate-900", isMobile ? "text-sm" : "text-lg")}>
                          기타 일정 추가
                        </CardTitle>
                        <CardDescription className={cn("break-keep text-slate-500", isMobile ? "mt-0.5 text-[10px] leading-4" : "mt-0.5 text-[11px] leading-5")}>
                          짧은 제목만 적어도 오늘 일정 보드에 바로 반영돼요.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className={cn(isMobile ? "p-4 pt-0" : "p-6 pt-0")}>
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
                        className={cn("rounded-xl bg-amber-500 font-black text-white hover:bg-amber-600", isMobile ? "h-10 px-4 text-xs" : "h-10 px-4 text-sm")}
                      >
                        추가
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {personalTasks.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-amber-200 bg-white/80 p-6 text-center">
                  <p className="text-sm font-black text-amber-700">보조 일정은 필요할 때만 가볍게 추가해요</p>
                  <p className="mt-2 break-keep text-[11px] font-semibold leading-5 text-slate-500">
                    공부 외 일정은 너무 무겁게 적지 말고, 꼭 챙겨야 할 것만 짧게 남겨두면 충분해요.
                  </p>
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
                      disabled={isPast}
                      isMobile={isMobile}
                      tone="amber"
                      badgeLabel="기타"
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {!isPast ? (
            <section className="rounded-[1.65rem] border border-slate-200 bg-white/92 p-4 shadow-[0_20px_42px_-34px_rgba(15,23,42,0.2)]">
              <div className={cn("flex gap-3", isMobile ? "flex-col" : "items-center justify-between")}>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">설정 보조 액션</p>
                  <p className="mt-1 break-keep text-sm font-bold text-slate-700">
                    반복 복사는 이 날짜를 기준으로 같은 요일 패턴에 안전하게 복사해요.
                  </p>
                </div>
                <div className={cn("flex gap-2", isMobile ? "flex-col" : "flex-row")}>
                  <Button
                    variant="outline"
                    onClick={() => setIsRoutineCopyDialogOpen(true)}
                    disabled={isSubmitting || !hasCopyableRoutines}
                    className={cn("rounded-xl border-2 bg-white font-black", isMobile ? "h-10 w-full text-[10px]" : "h-11 px-5 text-xs")}
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" /> 루틴 반복 복사
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsTaskCopyDialogOpen(true)}
                    disabled={isSubmitting || !hasCopyableTasks}
                    className={cn("rounded-xl border-2 bg-white font-black", isMobile ? "h-10 w-full text-[10px]" : "h-11 px-5 text-xs")}
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" /> 학습/기타 반복 복사
                  </Button>
                </div>
              </div>
            </section>
          ) : null}
        </CardContent>
      </Card>

      <RecentStudySheet
        open={isRecentStudySheetOpen}
        onOpenChange={setIsRecentStudySheetOpen}
        items={recentStudyOptions}
        onPrefill={handlePrefillRecentStudy}
        onQuickAdd={handleQuickAddRecentStudy}
        isSubmitting={isSubmitting}
        isMobile={isMobile}
      />

      <RepeatCopySheet
        open={isTaskCopyDialogOpen}
        onOpenChange={setIsTaskCopyDialogOpen}
        title="계획 반복 복사"
        description="선택한 요일 패턴으로 학습 계획과 기타 일정을 몇 주간 이어붙여요."
        itemLabel="복사할 계획 선택"
        weeksValue={taskCopyWeeks}
        onWeeksChange={setTaskCopyWeeks}
        selectedDays={taskCopyDays}
        onToggleDay={(day, checked) => toggleCopyDay('task', day, checked)}
        itemOptions={taskCopyOptions}
        selectedItemIds={taskCopyItemIds}
        onToggleItem={(id, checked) => toggleCopyItem('task', id, checked)}
        onSelectAllItems={() => setTaskCopyItemIds(copyableTaskItems.map((item) => item.id))}
        onClearItems={() => setTaskCopyItemIds([])}
        onConfirm={handleApplyTasksToAllWeekdays}
        isSubmitting={isSubmitting}
        isMobile={isMobile}
        weekdayOptions={WEEKDAY_OPTIONS}
      />

      <RepeatCopySheet
        open={isRoutineCopyDialogOpen}
        onOpenChange={setIsRoutineCopyDialogOpen}
        title="루틴 반복 복사"
        description="자주 쓰는 루틴을 같은 요일 라인으로 몇 주간 빠르게 복사해요."
        itemLabel="복사할 루틴 선택"
        weeksValue={routineCopyWeeks}
        onWeeksChange={setRoutineCopyWeeks}
        selectedDays={routineCopyDays}
        onToggleDay={(day, checked) => toggleCopyDay('routine', day, checked)}
        itemOptions={routineCopyOptions}
        selectedItemIds={routineCopyItemIds}
        onToggleItem={(id, checked) => toggleCopyItem('routine', id, checked)}
        onSelectAllItems={() => setRoutineCopyItemIds(copyableRoutineItems.map((item) => item.id))}
        onClearItems={() => setRoutineCopyItemIds([])}
        onConfirm={handleApplyRoutineToAllWeekdays}
        isSubmitting={isSubmitting}
        isMobile={isMobile}
        weekdayOptions={WEEKDAY_OPTIONS}
      />

      {false && (
      <>
      <div className={cn("grid gap-4 sm:gap-6 items-start", isMobile ? "grid-cols-1 px-0" : "md:grid-cols-12")}>
        {/* 학습 계획 카드 */}
        <div className={cn("w-full mx-auto order-1 md:order-2", isMobile ? "md:col-span-12" : "md:col-span-7")}>
          <Tabs defaultValue="study" className="w-full">
            <Card className={cn("border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.02]", isMobile ? "rounded-[1.5rem]" : "")}>
              <CardHeader className="p-0 border-b bg-muted/5">
                <TabsList className={cn("w-full justify-start rounded-none bg-transparent p-0 gap-0", isMobile ? "h-12" : "h-16")}>
                  <TabsTrigger value="study" className="flex-1 h-full data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 font-black text-[10px] sm:text-sm uppercase tracking-widest">학습 할 일</TabsTrigger>
                  <TabsTrigger value="personal" className="flex-1 h-full data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 font-black text-[10px] sm:text-sm uppercase tracking-widest">개인 일정</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className={cn("bg-[#fafafa]", isMobile ? "p-4" : "p-8")}>
                <TabsContent value="study" className="mt-0 space-y-4">
                  <div className="grid gap-3">
                    {studyTasks.map((task) => {
                      const subj = SUBJECTS.find(s => s.id === (task.subject || 'etc'));
                      const isVolumeTask = resolveStudyPlanMode(task) === 'volume';
                      const unitLabel = resolveAmountUnitLabel(task);
                      return (
                        <div key={task.id} className={cn("flex items-start gap-4 p-4 rounded-[1.5rem] border-2 transition-all group", task.done ? "bg-emerald-50/30 border-emerald-100/50" : "bg-white border-transparent shadow-sm hover:shadow-md", isMobile ? "p-4" : "p-6 rounded-[2rem]")}>
                          {!isVolumeTask ? (
                            <Checkbox id={task.id} checked={task.done} onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} disabled={isPast} className={cn("rounded-xl border-2 mt-1", isMobile ? "h-6 w-6" : "h-7 w-7")} />
                          ) : (
                            <Badge className="mt-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700 shadow-none">
                              {Math.min(999, Math.round(((task.actualAmount || 0) / Math.max(1, task.targetAmount || 1)) * 100))}%
                            </Badge>
                          )}
                          <div className="flex-1 grid gap-1">
                            <div className="flex items-center gap-2">
                              <Badge className={cn("rounded-md font-black text-[8px] px-1.5 py-0 border-none shadow-sm", subj?.color, "text-white")}>{subj?.label}</Badge>
                              <span className={cn("font-black text-muted-foreground/40 uppercase tracking-widest", isMobile ? "text-[8px]" : "text-[10px]")}>{isVolumeTask ? '분량형' : '시간형'}</span>
                            </div>
                            <Label htmlFor={task.id} className={cn("font-black tracking-tight transition-all leading-snug break-keep", isMobile ? "text-sm" : "text-lg", task.done && "line-through text-muted-foreground/40 italic")}>{task.title}</Label>
                            <p className="text-[10px] font-black text-slate-400">{buildStudyTaskMeta(task)}</p>
                            {isVolumeTask ? (
                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-[10px] font-black" onClick={() => handleCommitStudyActualAmount(task as WithId<StudyPlanItem>, 0)} disabled={isPast}>0</Button>
                                <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-[10px] font-black" onClick={() => handleCommitStudyActualAmount(task as WithId<StudyPlanItem>, Math.max(1, Math.round((task.targetAmount || 0) / 2)))} disabled={isPast}>절반</Button>
                                <Button type="button" variant="outline" className="h-7 rounded-full px-2.5 text-[10px] font-black" onClick={() => handleCommitStudyActualAmount(task as WithId<StudyPlanItem>, task.targetAmount || 0)} disabled={isPast}>완료</Button>
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min={0}
                                    defaultValue={String(task.actualAmount || 0)}
                                    onBlur={(e) => handleCommitStudyActualAmount(task as WithId<StudyPlanItem>, Number(e.target.value))}
                                    className="h-7 w-16 rounded-lg border-slate-200 px-2 text-center text-[10px] font-black"
                                  />
                                  <span className="text-[10px] font-semibold text-slate-400">{unitLabel}</span>
                                </div>
                              </div>
                            ) : null}
                          </div>
                          {!isPast && (
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
                    
                    {!isPast && (
                      <div className={cn("flex flex-col gap-3 rounded-[1.5rem] bg-white border-2 border-emerald-100 shadow-sm mt-2", isMobile ? "p-4" : "p-6 rounded-[2rem]")}>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className={cn("font-black uppercase text-muted-foreground ml-1", isMobile ? "text-[8px]" : "text-[10px]")}>과목 선택</Label>
                            <Select value={newStudySubject} onValueChange={setNewStudySubject}>
                              <SelectTrigger className="h-9 rounded-lg border-2 font-bold text-[10px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-none shadow-2xl">
                                {SUBJECTS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className={cn("font-black uppercase text-muted-foreground ml-1", isMobile ? "text-[8px]" : "text-[10px]")}>목표 시간(분)</Label>
                            <Input type="number" value={newStudyMinutes} onChange={(e) => setNewStudyMinutes(e.target.value)} className="h-9 rounded-lg border-2 font-black text-center text-xs" />
                          </div>
                        </div>
                        <div className="relative flex items-center bg-muted/20 rounded-xl p-1 gap-1">
                          <Input placeholder="할 일 추가..." value={newStudyTask} onChange={(e) => setNewStudyTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newStudyTask, 'study')} disabled={isSubmitting} className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 font-bold h-10 text-xs" />
                      <Button size="icon" onClick={() => handleAddTask(newStudyTask, 'study')} disabled={isSubmitting || !newStudyTask.trim()} className={cn("touch-manipulation rounded-lg shrink-0 shadow-lg bg-emerald-500 hover:bg-emerald-600 text-white relative z-10", isMobile ? "h-10 w-10" : "h-8 w-8")}><Plus className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="personal" className="mt-0 space-y-4">
                  <div className="grid gap-3">
                    {personalTasks.map((task) => (
                      <div key={task.id} className={cn("flex items-center gap-4 p-4 rounded-[1.5rem] border-2 transition-all group", task.done ? "bg-amber-50/30 border-amber-100/50" : "bg-white border-transparent shadow-sm", isMobile ? "p-4" : "p-6 rounded-[2rem]")}>
                        <Checkbox id={task.id} checked={task.done} onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} disabled={isPast} className={cn("rounded-xl border-2", isMobile ? "h-6 w-6" : "h-7 w-7")} />
                        <Label htmlFor={task.id} className={cn("flex-1 font-black tracking-tight transition-all", isMobile ? "text-sm" : "text-lg", task.done && "line-through text-muted-foreground/40 italic")}>{task.title}</Label>
                        {!isPast && (
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
                    {!isPast && (
                      <div className={cn("relative flex items-center bg-white border-2 border-amber-100 rounded-xl p-1 shadow-sm mt-2 gap-1", isMobile ? "p-1.5" : "p-1.5 rounded-[1.5rem]")}>
                        <Input placeholder="개인 일정 추가..." value={newPersonalTask} onChange={(e) => setNewPersonalTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newPersonalTask, 'personal')} disabled={isSubmitting} className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 font-bold h-10 text-xs" />
                        <Button variant="outline" size="icon" onClick={() => handleAddTask(newPersonalTask, 'personal')} disabled={isSubmitting || !newPersonalTask.trim()} className={cn("touch-manipulation rounded-lg shrink-0 shadow-lg border-2 border-amber-500 text-amber-600 relative z-10", isMobile ? "h-10 w-10" : "h-8 w-8")}><Plus className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </CardContent>
              <div className={cn("bg-muted/10 border-t flex flex-col sm:flex-row items-center justify-between gap-4", isMobile ? "p-4" : "p-8")}>
                <div className="flex items-center gap-2 bg-white/80 px-4 py-2 rounded-xl border shadow-sm w-full sm:w-auto justify-center">
                  <CalendarCheck className="h-3.5 w-3.5 text-primary" />
                  <p className={cn("font-black text-primary/70 uppercase tracking-widest", isMobile ? "text-[9px]" : "text-[11px]")}>{selectedDate ? format(selectedDate!, 'yyyy. MM. dd', { locale: ko }) : ''}</p>
                </div>
                {!isPast && (
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" className={cn("rounded-xl gap-2 font-black border-2 shadow-sm bg-white hover:bg-primary hover:text-white transition-all active:scale-95", isMobile ? "h-10 text-[10px] w-full" : "h-12 px-8 text-xs")} onClick={() => setIsTaskCopyDialogOpen(true)} disabled={isSubmitting || !hasCopyableTasks}>
                      {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Copy className="h-3.5 w-3.5" />} 이 요일 반복 복사
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </Tabs>
        </div>

        {/* 생활 루틴 카드 */}
        <Card className={cn("border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white ring-1 ring-black/[0.02] mx-auto w-full order-2 md:order-1", isMobile ? "md:col-span-12 rounded-[1.5rem]" : "md:col-span-5")}>
          <CardHeader className={cn("bg-muted/5 border-b", isMobile ? "p-4" : "p-8")}>
            <div className="flex items-center justify-between">
              <CardTitle className={cn("flex items-center gap-2 font-black tracking-tighter text-primary", isMobile ? "text-base" : "text-2xl")}>
                <div className="bg-primary/5 p-1.5 rounded-lg"><Clock className={cn("text-primary", isMobile ? "h-5 w-5" : "h-6 w-6")} /></div>
                생활 루틴
              </CardTitle>
              {!isPast && (
                <Dialog open={isRoutineModalOpen} onOpenChange={setIsRoutineModalOpen}>
                  <DialogTrigger asChild><Button variant="ghost" size="icon" className={cn("touch-manipulation rounded-full hover:bg-primary/10 transition-all", isMobile ? "h-8 w-8" : "h-10 w-10")}><PlusCircle className={cn(isMobile ? "h-5 w-5" : "h-6 w-6")} /></Button></DialogTrigger>
                  <DialogContent className={cn("rounded-[2.5rem] border-none shadow-2xl p-8", isMobile ? "w-[min(94vw,25rem)] max-h-[86svh] rounded-[2rem] p-0" : "sm:max-w-md")}>
                    <div className={cn("p-10 text-white relative", `bg-gradient-to-br ${rewardGradient}`)}>
                    <Sparkles className="pointer-events-none absolute top-0 right-0 p-10 h-40 w-40 opacity-10 rotate-12" />
                      <DialogHeader><DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-xl" : "text-2xl")}>새 루틴 추가</DialogTitle></DialogHeader>
                    </div>
                    <div className={cn("space-y-6 bg-white", isMobile ? "max-h-[calc(86svh-9rem)] overflow-y-auto p-5" : "p-8")}>
                      <Input placeholder="예: 영어 학원, 점심 시간" value={newRoutineTitle} onChange={(e) => setNewRoutineTitle(e.target.value)} className="h-14 rounded-2xl border-2 font-bold text-base" />
                      <div className="flex flex-wrap gap-2">
                        {['점심', '저녁', '학원', '독서실'].map(tag => (
                          <Button
                            key={tag}
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-auto rounded-xl px-4 py-1.5 text-xs font-black"
                            onClick={() => setNewRoutineTitle(tag)}
                          >
                            +{tag}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <DialogFooter className={cn("bg-muted/30", isMobile ? "p-5" : "p-8")}><Button onClick={() => handleAddTask(newRoutineTitle, 'schedule')} disabled={!newRoutineTitle.trim() || isSubmitting} className={cn("w-full h-14 rounded-2xl font-black text-lg shadow-xl text-white bg-gradient-to-br", rewardGradient)}>{isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : '루틴 생성'}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              {isToday && (
                <Badge variant="outline" className="h-6 px-2 text-[9px] font-black border-amber-200 text-amber-700">
                  당일 수정 시 벌점 +{SAME_DAY_ROUTINE_PENALTY_POINTS}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className={cn("bg-[#fafafa] flex flex-col gap-3", isMobile ? "p-4" : "p-8")}>
            {isToday && (
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 flex items-start gap-3 mb-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <p className="text-[10px] font-bold text-amber-900 leading-relaxed">당일 출석 루틴도 작성/수정할 수 있지만, 벌점은 하루 최대 1점만 자동 반영됩니다.</p>
              </div>
            )}
            {isLoading ? <div className="py-16 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div> : scheduleItems.length === 0 ? <div className={cn("py-12 text-center opacity-20 italic font-black border-2 border-dashed rounded-2xl", isMobile ? "text-xs" : "text-sm")}>등록된 루틴이 없습니다.</div> :
              scheduleItems.sort((a,b) => (a.title.split(': ')[1] || '00:00').localeCompare(b.title.split(': ')[1] || '00:00')).map((item) => (
                <ScheduleItemRow key={item.id} item={item} onUpdateRange={handleUpdateScheduleRange} onDelete={handleDeleteTask} isPast={isPast} isToday={isToday} isMobile={isMobile} />
              ))
            }
            
            {/* 생활 루틴 하단 반복 복사 버튼 */}
            {!isPast && !isToday && scheduleItems.length > 0 && (
              <div className="flex justify-end mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={cn("rounded-xl gap-2 font-black border-2 shadow-sm bg-white hover:bg-primary hover:text-white transition-all active:scale-95", isMobile ? "h-9 text-[9px] px-3" : "h-10 px-5 text-xs")} 
                  onClick={() => setIsRoutineCopyDialogOpen(true)} 
                  disabled={isSubmitting || !hasCopyableRoutines}
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Copy className="h-3.5 w-3.5" />} 루틴 반복 복사
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isTaskCopyDialogOpen} onOpenChange={setIsTaskCopyDialogOpen}>
        <DialogContent className={cn("border-none shadow-2xl", isMobile ? "w-[92vw] max-w-[360px] rounded-2xl p-5" : "sm:max-w-md rounded-3xl p-7")}>
          <DialogHeader>
            <DialogTitle className="font-black text-primary text-xl">계획 반복 복사</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-black text-muted-foreground">몇 주간 복사할까요?</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={taskCopyWeeks}
                onChange={(e) => setTaskCopyWeeks(e.target.value)}
                className="h-11 rounded-xl border-2 font-black"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black text-muted-foreground">복사할 요일</Label>
              <div className="grid grid-cols-4 gap-2">
                {WEEKDAY_OPTIONS.map((option) => (
                  <label key={`task-copy-day-${option.value}`} className="flex items-center gap-2 rounded-xl border p-2 cursor-pointer bg-muted/10">
                    <Checkbox
                      checked={taskCopyDays.includes(option.value)}
                      onCheckedChange={(checked) => toggleCopyDay('task', option.value, checked === true)}
                    />
                    <span className="text-xs font-black">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsTaskCopyDialogOpen(false)} className="rounded-xl border-2 font-black">취소</Button>
            <Button onClick={handleApplyTasksToAllWeekdays} disabled={isSubmitting} className="rounded-xl font-black text-white">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '복사하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRoutineCopyDialogOpen} onOpenChange={setIsRoutineCopyDialogOpen}>
        <DialogContent className={cn("border-none shadow-2xl", isMobile ? "w-[92vw] max-w-[360px] rounded-2xl p-5" : "sm:max-w-md rounded-3xl p-7")}>
          <DialogHeader>
            <DialogTitle className="font-black text-primary text-xl">루틴 반복 복사</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-black text-muted-foreground">몇 주간 복사할까요?</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={routineCopyWeeks}
                onChange={(e) => setRoutineCopyWeeks(e.target.value)}
                className="h-11 rounded-xl border-2 font-black"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black text-muted-foreground">복사할 요일</Label>
              <div className="grid grid-cols-4 gap-2">
                {WEEKDAY_OPTIONS.map((option) => (
                  <label key={`routine-copy-day-${option.value}`} className="flex items-center gap-2 rounded-xl border p-2 cursor-pointer bg-muted/10">
                    <Checkbox
                      checked={routineCopyDays.includes(option.value)}
                      onCheckedChange={(checked) => toggleCopyDay('routine', option.value, checked === true)}
                    />
                    <span className="text-xs font-black">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsRoutineCopyDialogOpen(false)} className="rounded-xl border-2 font-black">취소</Button>
            <Button onClick={handleApplyRoutineToAllWeekdays} disabled={isSubmitting} className="rounded-xl font-black text-white">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : '복사하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
      )}
      
      <footer className={cn("py-8 text-center opacity-30", isMobile ? "hidden" : "px-4 py-12")}>
        <div className="flex items-center justify-center gap-6 text-[10px] font-black uppercase tracking-[0.4em] text-primary">
           <div className="flex items-center gap-2"><Activity className="h-4 w-4" /><span>깊은 몰입 준비 완료</span></div>
           <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
           <div className="flex items-center gap-2"><Sparkles className="h-4 w-4" /><span>인공지능 동기화 활성</span></div>
        </div>
      </footer>
    </div>
  );
}

