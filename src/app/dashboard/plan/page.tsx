
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
  getDoc,
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
  type User as UserType,
  type UserStudyProfile,
  type WithId,
} from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { getSafeErrorMessage } from '@/lib/exposed-error';
import { logHandledClientIssue } from '@/lib/handled-client-log';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  EMPTY_ATTENDANCE_SCHEDULE_DRAFT,
  ROUTINE_TEMPLATE_OPTIONS,
  STUDY_PLAN_MODE_OPTIONS,
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
import { resolveStudentTargetDailyMinutesOrFallback } from '@/lib/student-target-minutes';

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
const SCHEDULE_STATUS_BADGE_TONE: Record<string, string> = {
  '등원 예정': 'border-[#FFE2C5] bg-[#FFF4E8] text-[#D86A11]',
  휴식: 'border-[#DCE6F5] bg-[#EEF4FF] text-[#5A6F95]',
  미정: 'border-[#E5ECF7] bg-white text-[#5A6F95]',
};

type InlineMessage = {
  title: string;
  description: string;
};

type ScheduleSaveFeedback = InlineMessage & {
  variant: 'success' | 'warning';
};

type PersistStudentScheduleResult = {
  legacySyncWarning: boolean;
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
  { id: 'etc', label: '직접 입력', color: 'bg-slate-400', light: 'bg-slate-50', text: 'text-slate-500' },
];
const DEFAULT_CUSTOM_SUBJECT_LABEL = '직접 입력';

function normalizeCustomSubjectLabel(label?: string | null) {
  const trimmed = label?.trim();
  return trimmed || DEFAULT_CUSTOM_SUBJECT_LABEL;
}

function resolveSubjectLabel(subject?: string | null, subjectLabel?: string | null) {
  const subjectValue = subject || 'etc';
  if (subjectValue === 'etc') return normalizeCustomSubjectLabel(subjectLabel);
  return SUBJECTS.find((item) => item.id === subjectValue)?.label || DEFAULT_CUSTOM_SUBJECT_LABEL;
}

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

function buildChecklistMeta(task: Pick<StudyPlanItem, 'category' | 'studyPlanMode' | 'targetMinutes' | 'targetAmount' | 'actualAmount' | 'amountUnit' | 'amountUnitLabel' | 'done' | 'completedWithinPlannedTime' | 'completionOvertimeMinutes'>) {
  if (task.category === 'personal') {
    if (task.done && (task.completionOvertimeMinutes || 0) > 0) {
      return `기타 일정 · ${task.completionOvertimeMinutes}분 더 걸림`;
    }
    return task.done ? '기타 일정 · 완료' : '기타 일정';
  }

  const baseMeta = buildStudyTaskMeta(task);
  if (task.done && task.completedWithinPlannedTime === false && (task.completionOvertimeMinutes || 0) > 0) {
    return `${baseMeta} · ${task.completionOvertimeMinutes}분 더 걸림`;
  }
  if (task.done && task.completedWithinPlannedTime === true) {
    return `${baseMeta} · 제시간 완료`;
  }
  return baseMeta;
}

function normalizeStudyTitle(title: string) {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

function getPlanTimestampMs(task: Pick<StudyPlanItem, 'updatedAt' | 'createdAt'>) {
  const updatedAtMs = task.updatedAt?.toDate?.().getTime?.() ?? 0;
  const createdAtMs = task.createdAt?.toDate?.().getTime?.() ?? 0;
  return Math.max(updatedAtMs, createdAtMs);
}

function getScheduleTemplateTimestampMs(template: Pick<StudentScheduleTemplate, 'updatedAt' | 'createdAt'>) {
  const updatedAtMs = template.updatedAt?.toDate?.().getTime?.() ?? 0;
  const createdAtMs = template.createdAt?.toDate?.().getTime?.() ?? 0;
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
  const rewardGradient = 'from-[#14295F] via-[#1A3673] to-[#FF8A2A]';
  const [planTrackEntryMode, setPlanTrackEntryMode] = useState<'auto' | 'onboarding' | 'planner'>('auto');
  const [hasDismissedRoutineOnboardingLocally, setHasDismissedRoutineOnboardingLocally] = useState(false);
  const onboardingPresentationRef = useRef(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newStudyTask, setNewStudyTask] = useState('');
  const [newStudySubject, setNewStudySubject] = useState('math');
  const [newStudyCustomSubject, setNewStudyCustomSubject] = useState(DEFAULT_CUSTOM_SUBJECT_LABEL);
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

  const planSubjectOptions = useMemo(
    () =>
      SUBJECTS.map((item) =>
        item.id === 'etc'
          ? { ...item, label: normalizeCustomSubjectLabel(newStudyCustomSubject) }
          : item
      ),
    [newStudyCustomSubject]
  );

  const [inTime, setInTime] = useState('09:00');
  const [outTime, setOutTime] = useState('22:00');
  const [awayStartTime, setAwayStartTime] = useState('');
  const [awayEndTime, setAwayEndTime] = useState('');
  const [awayReason, setAwayReason] = useState('');
  const [extraAwayPlans, setExtraAwayPlans] = useState<AttendanceAwaySlot[]>([]);
  const [isScheduleAbsent, setIsScheduleAbsent] = useState(false);
  const [scheduleNote, setScheduleNote] = useState('');
  const [scheduleSaveFeedback, setScheduleSaveFeedback] = useState<ScheduleSaveFeedback | null>(null);
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
  const [completionReviewItem, setCompletionReviewItem] = useState<WithId<StudyPlanItem> | null>(null);
  const [completionWithinPlannedTime, setCompletionWithinPlannedTime] = useState(true);
  const [completionOvertimeMinutes, setCompletionOvertimeMinutes] = useState('10');
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);
  const [isCompletionSubmitting, setIsCompletionSubmitting] = useState(false);
  const [isGoalTargetDialogOpen, setIsGoalTargetDialogOpen] = useState(false);
  const [goalTargetHoursDraft, setGoalTargetHoursDraft] = useState('');
  const [goalTargetMinutesDraft, setGoalTargetMinutesDraft] = useState('');
  const [isGoalTargetSaving, setIsGoalTargetSaving] = useState(false);
  const [goalTargetSaveError, setGoalTargetSaveError] = useState<InlineMessage | null>(null);
  const [attendanceSaveError, setAttendanceSaveError] = useState<InlineMessage | null>(null);

  useEffect(() => {
    if (!scheduleSaveFeedback) return;
    const timeout = window.setTimeout(() => setScheduleSaveFeedback(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [scheduleSaveFeedback]);

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc<UserType>(userProfileRef, {
    enabled: Boolean(userProfileRef),
  });

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
    if (!completionReviewItem) return;
    setCompletionWithinPlannedTime(true);
    setCompletionOvertimeMinutes('10');
  }, [completionReviewItem]);

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
      setAttendanceSaveError(null);
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
  const moveSelectedDay = useCallback((direction: -1 | 1) => {
    if (!selectedDate) return;
    setSelectedDate(addDays(selectedDate, direction));
  }, [selectedDate]);

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
      const resolvedSubjectLabel = resolveSubjectLabel(subjectValue, task.subjectLabel);
      const studyModeValue = resolveStudyPlanMode(task);
      const amountUnitValue = (task.amountUnit || '문제') as StudyAmountUnit;
      const customAmountUnitValue = task.amountUnit === '직접입력' ? task.amountUnitLabel?.trim() || '' : '';
      const updatedAtMs = getPlanTimestampMs(task);
      const usedDate = updatedAtMs ? format(new Date(updatedAtMs), 'M/d') : task.dateKey.slice(5).replace('-', '/');

      return {
        key: [
          subjectValue,
          subjectValue === 'etc' ? resolvedSubjectLabel : '',
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
        subjectLabel: resolvedSubjectLabel,
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
  const effectiveRoutineProfile = studentProfile?.studyRoutineProfile || userProfile?.studyRoutineProfile;
  const routineOnboardingState = studentProfile?.studyRoutineOnboarding || userProfile?.studyRoutineOnboarding;
  const effectivePlannerDiagnostic = studentProfile?.studyPlannerDiagnostic || userProfile?.studyPlannerDiagnostic || null;
  const hasRoutineProfile = Boolean(effectiveRoutineProfile);
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
    () =>
      [...(scheduleTemplates || [])]
        .filter((template) => template.active !== false)
        .sort((left, right) => getScheduleTemplateTimestampMs(right) - getScheduleTemplateTimestampMs(left)),
    [scheduleTemplates]
  );
  const matchingWeekdayTemplate = useMemo(
    () =>
      activeScheduleTemplates.find((template) =>
        Array.isArray(template.weekdays) && template.weekdays.includes(selectedWeekdayValue)
      ),
    [activeScheduleTemplates, selectedWeekdayValue]
  );
  const matchingRecurringTemplate = useMemo(() => {
    const normalizedSelected = [...selectedRecurringWeekdays].sort((left, right) => left - right);
    if (normalizedSelected.length === 0) return null;

    return (
      activeScheduleTemplates.find((template) => {
        const weekdays = Array.isArray(template.weekdays) ? [...template.weekdays].sort((left, right) => left - right) : [];
        return weekdays.length === normalizedSelected.length && weekdays.every((value, index) => value === normalizedSelected[index]);
      }) || null
    );
  }, [activeScheduleTemplates, selectedRecurringWeekdays]);
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
    if (!hasSeenRoutineOnboarding && !onboardingPresentationRef.current) {
      onboardingPresentationRef.current = true;
    }
    setPlanTrackEntryMode('planner');
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
  const resolvedTargetDailyMinutes = useMemo(
    () => resolveStudentTargetDailyMinutesOrFallback(studentProfile, userProfile, 240),
    [
      studentProfile?.targetDailyMinutes,
      studentProfile?.targetDailyMinutesSource,
      userProfile?.targetDailyMinutes,
      userProfile?.targetDailyMinutesSource,
    ]
  );

  const handleSaveRoutineProfile = useCallback(async (profile: UserStudyProfile) => {
    if (!firestore || !user || !activeMembership || !userProfileRef) return;

    const onboardingPayload = {
      presentedAt: routineOnboardingState?.presentedAt || serverTimestamp(),
      status: 'completed' as const,
      completedAt: serverTimestamp(),
      version: PLAN_TRACK_ONBOARDING_VERSION,
      updatedAt: serverTimestamp(),
    };
    const studyProfilePayload = {
      ...profile,
      createdAt: effectiveRoutineProfile?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const writeResults = await Promise.allSettled([
      setDoc(
        userProfileRef,
        {
          updatedAt: serverTimestamp(),
          studyRoutineOnboarding: onboardingPayload,
          studyRoutineProfile: studyProfilePayload,
        },
        { merge: true }
      ),
      studentProfileRef
        ? setDoc(
            studentProfileRef,
              {
                id: user.uid,
                name: studentProfile?.name || activeMembership.displayName || user.displayName || '학생',
                schoolName: studentProfile?.schoolName || userProfile?.schoolName || '학교 미정',
                grade: studentProfile?.grade || '학년 미정',
                seatNo: studentProfile?.seatNo || 0,
                targetDailyMinutes: resolvedTargetDailyMinutes.minutes,
                parentUids: studentProfile?.parentUids || [],
                createdAt: studentProfile?.createdAt || serverTimestamp(),
                updatedAt: serverTimestamp(),
                studyRoutineOnboarding: onboardingPayload,
                studyRoutineProfile: studyProfilePayload,
              studyRoutineWorkspace: null,
            },
            { merge: true }
          )
        : Promise.resolve(),
    ]);

    if (writeResults.every((result) => result.status === 'rejected')) {
      throw (writeResults.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined)?.reason;
    }

    toast({
      title: '학습 기준 저장 완료',
      description: '이제 직접 쓴 오늘 계획을 기준으로 부족한 점과 보강 포인트를 함께 보여드릴게요.',
    });
  }, [
    activeMembership,
    effectiveRoutineProfile?.createdAt,
    firestore,
    routineOnboardingState?.presentedAt,
    studentProfile,
    studentProfileRef,
    toast,
    user,
    userProfile?.schoolName,
    userProfileRef,
    resolvedTargetDailyMinutes.minutes,
  ]);

  const handleDismissRoutineOnboarding = useCallback(async () => {
      setHasDismissedRoutineOnboardingLocally(true);
      setPlanTrackEntryMode('planner');

      try {
        const dismissPayload = {
          studyRoutineOnboarding: {
            presentedAt: routineOnboardingState?.presentedAt || serverTimestamp(),
            status: 'dismissed' as const,
            dismissedAt: serverTimestamp(),
            version: PLAN_TRACK_ONBOARDING_VERSION,
            updatedAt: serverTimestamp(),
          },
        };

        const writeResults = await Promise.allSettled([
          userProfileRef ? setDoc(userProfileRef, dismissPayload, { merge: true }) : Promise.resolve(),
          studentProfileRef ? setDoc(studentProfileRef, dismissPayload, { merge: true }) : Promise.resolve(),
        ]);

        if (writeResults.every((result) => result.status === 'rejected')) {
          throw (writeResults.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined)?.reason;
        }
    } catch (error) {
      logHandledClientIssue('[plan-track] dismiss routine onboarding failed', error);
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
  }, [routineOnboardingState?.presentedAt, studentProfileRef, toast, userProfileRef]);

  const handleSaveGoalTarget = useCallback(async () => {
    if (!userProfileRef) {
      setGoalTargetSaveError({
        title: '목표시간을 저장할 수 없어요',
        description: '회원 정보가 준비된 뒤에 다시 시도해 주세요.',
      });
      return;
    }

    const parsedHours = Number(goalTargetHoursDraft.trim() === '' ? '0' : goalTargetHoursDraft);
    const parsedMinutes = Number(goalTargetMinutesDraft.trim() === '' ? '0' : goalTargetMinutesDraft);
    const hasInvalidHour = !Number.isInteger(parsedHours) || parsedHours < 0 || parsedHours > 24;
    const hasInvalidMinute = !Number.isInteger(parsedMinutes) || parsedMinutes < 0 || parsedMinutes > 59;

    if (hasInvalidHour || hasInvalidMinute) {
      setGoalTargetSaveError({
        title: '시간 형식을 다시 확인해 주세요',
        description: '시간은 0~24, 분은 0~59 사이로 입력할 수 있어요.',
      });
      return;
    }

    const nextTargetMinutes = parsedHours * 60 + parsedMinutes;
    if (nextTargetMinutes < 30 || nextTargetMinutes > 24 * 60) {
      setGoalTargetSaveError({
        title: '목표시간 범위를 확인해 주세요',
        description: '하루 목표시간은 최소 30분부터 설정할 수 있어요.',
      });
      return;
    }

    setIsGoalTargetSaving(true);
    setGoalTargetSaveError(null);

    try {
      await setDoc(userProfileRef, {
        targetDailyMinutes: nextTargetMinutes,
        targetDailyMinutesSource: 'manual',
        updatedAt: serverTimestamp(),
      }, { merge: true });

      if (studentProfileRef) {
        const mirrorWriteResult = await Promise.allSettled([
          getDoc(studentProfileRef).then((studentProfileSnapshot) => {
            if (!studentProfileSnapshot.exists()) return;
            return updateDoc(studentProfileRef, {
              targetDailyMinutes: nextTargetMinutes,
              targetDailyMinutesSource: 'manual',
              updatedAt: serverTimestamp(),
            });
          }),
        ]);

        if (mirrorWriteResult[0]?.status === 'rejected') {
          logHandledClientIssue('[plan-track] mirror goal target failed', mirrorWriteResult[0].reason);
        }
      }

      setIsGoalTargetDialogOpen(false);
    } catch (error: any) {
      logHandledClientIssue('[plan-track] save goal target failed', error);
      setGoalTargetSaveError({
        title: '목표시간 저장 실패',
        description: getSafeErrorMessage(error, '목표시간을 저장하지 못했습니다.'),
      });
    } finally {
      setIsGoalTargetSaving(false);
    }
  }, [
    goalTargetHoursDraft,
    goalTargetMinutesDraft,
    studentProfileRef,
    userProfileRef,
  ]);

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
    if (matchingRecurringTemplate) {
      setWeekdayDraft(
        buildDraftFromScheduleDoc({
          inTime: matchingRecurringTemplate.arrivalPlannedAt,
          outTime: matchingRecurringTemplate.departurePlannedAt,
          isAbsent: false,
          outings:
            matchingRecurringTemplate.hasExcursionDefault &&
            matchingRecurringTemplate.defaultExcursionStartAt &&
            matchingRecurringTemplate.defaultExcursionEndAt
              ? [
                  {
                    id: matchingRecurringTemplate.id || 'weekday-template',
                    startTime: matchingRecurringTemplate.defaultExcursionStartAt,
                    endTime: matchingRecurringTemplate.defaultExcursionEndAt,
                    reason: matchingRecurringTemplate.defaultExcursionReason || '',
                  },
                ]
              : [],
        })
      );
    }
  }, [matchingRecurringTemplate]);

  const studyTimeSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    const labeledSummary = new Map<string, { subjectId: string; subjectLabel: string; minutes: number }>();
    let total = 0;
    studyTasks.forEach(task => {
      const subject = task.subject || 'etc';
      const subjectLabel = resolveSubjectLabel(subject, task.subjectLabel);
      const subjectKey = subject === 'etc' ? `etc:${subjectLabel}` : subject;
      const mins = task.targetMinutes || 0;
      summary[subject] = (summary[subject] || 0) + mins;
      const current = labeledSummary.get(subjectKey);
      if (current) {
        current.minutes += mins;
      } else {
        labeledSummary.set(subjectKey, { subjectId: subjectKey, subjectLabel, minutes: mins });
      }
      total += mins;
    });
    return { breakdown: summary, labeledBreakdown: Array.from(labeledSummary.values()), total };
  }, [studyTasks]);
  const volumeStudyTasks = useMemo(
    () => studyTasks.filter((task) => resolveStudyPlanMode(task) === 'volume'),
    [studyTasks]
  );
  const studyGoalSummaryLabel = useMemo(() => {
    const timeTaskCount = studyTasks.length - volumeStudyTasks.length;
    if (volumeStudyTasks.length > 0 && studyTimeSummary.total > 0) {
      return `분량형 ${volumeStudyTasks.length}개 · 총 계획 ${formatMinutesSummary(studyTimeSummary.total)}`;
    }
    if (volumeStudyTasks.length > 0) {
      return `분량형 목표 ${volumeStudyTasks.length}개`;
    }
    return timeTaskCount > 0 ? `총 계획 ${formatMinutesSummary(studyTimeSummary.total)}` : '오늘 계획을 아직 정하지 않았어요';
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
      const isStudyItem = item.category === 'study' || !item.category;
      const planMetaLabel = buildStudyTaskMeta(item);
      return {
        id: item.id,
        title: item.title,
        meta: isStudyItem
          ? `${resolveSubjectLabel(item.subject, item.subjectLabel)} · ${planMetaLabel}`
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
  const routineSuggestedDailyMinutes = effectiveRoutineProfile?.answers?.dailyStudyHours
    ? DAILY_STUDY_MINUTES_MAP[effectiveRoutineProfile.answers.dailyStudyHours] || 0
    : 0;
  const hasManualTargetDailyMinutes =
    resolvedTargetDailyMinutes.source === 'manual' && resolvedTargetDailyMinutes.minutes > 0;
  const recommendedDailyMinutes = hasManualTargetDailyMinutes
    ? resolvedTargetDailyMinutes.minutes
    : routineSuggestedDailyMinutes || resolvedTargetDailyMinutes.minutes;
  const openGoalTargetDialog = useCallback(() => {
    const currentTargetMinutes = Math.max(30, recommendedDailyMinutes || 240);
    setGoalTargetHoursDraft(String(Math.floor(currentTargetMinutes / 60)));
    setGoalTargetMinutesDraft(String(currentTargetMinutes % 60));
    setGoalTargetSaveError(null);
    setIsGoalTargetDialogOpen(true);
  }, [recommendedDailyMinutes]);
  const planProgressPercent = recommendedDailyMinutes > 0
    ? Math.min(100, Math.round((studyTimeSummary.total / recommendedDailyMinutes) * 100))
    : 0;
  const subjectBalanceEntries = useMemo(
    () => [...studyTimeSummary.labeledBreakdown].sort((left, right) => right.minutes - left.minutes),
    [studyTimeSummary.labeledBreakdown]
  );
  const visibleChecklistTasks = useMemo(() => orderedChecklistTasks.slice(0, 5), [orderedChecklistTasks]);
  const hiddenChecklistTaskCount = Math.max(0, checklistTasks.length - visibleChecklistTasks.length);
  const latestDiagnostic = effectivePlannerDiagnostic;
  const mainRecommendations = useMemo(
    () =>
      buildMainPlanRecommendations({
        profile: effectiveRoutineProfile,
        diagnostic: latestDiagnostic,
        latestStudyPlan: currentStudyPlan,
        todayStudyTasks: studyTasks,
        recentStudyTasks: recentStudyHistory,
      }),
    [currentStudyPlan, effectiveRoutineProfile, latestDiagnostic, recentStudyHistory, studyTasks]
  );
  const prioritySubjectLabels = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...(effectiveRoutineProfile?.answers?.subjectPriority || []),
            ...(effectiveRoutineProfile?.answers?.weakSubjects || []),
          ]
            .map((subject) => SUBJECTS.find((item) => item.id === subject)?.label || subject)
            .filter((subject) => subject && subject !== 'none')
        )
      ),
    [effectiveRoutineProfile?.answers?.subjectPriority, effectiveRoutineProfile?.answers?.weakSubjects]
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
          ? '이날은 등원하지 않아요.'
          : '';

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
        if (matchedSubject.id === 'etc') {
          setNewStudyCustomSubject(normalizeCustomSubjectLabel(preset.subject));
        }
      } else if (preset.subject) {
        setNewStudySubject('etc');
        setNewStudyCustomSubject(normalizeCustomSubjectLabel(preset.subject));
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
    setAttendanceSaveError(null);
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
    setNewStudyCustomSubject(DEFAULT_CUSTOM_SUBJECT_LABEL);
    setNewStudyTargetAmount('');
    setNewStudyAmountUnit('문제');
    setNewStudyCustomAmountUnit('');
    setEnableVolumeStudyMinutes(false);
    setNewStudyMode('volume');
  };

  const handlePrefillRecentStudy = (item: RecentStudyOption) => {
    setNewStudySubject(item.subjectValue);
    setNewStudyCustomSubject(item.subjectValue === 'etc' ? normalizeCustomSubjectLabel(item.subjectLabel) : DEFAULT_CUSTOM_SUBJECT_LABEL);
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
    subjectLabel: task.subject === 'etc' ? normalizeCustomSubjectLabel(task.subjectLabel) : undefined,
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
          subjectLabel: task.category === 'study' && (task.subject || 'etc') === 'etc' ? normalizeCustomSubjectLabel(task.subjectLabel) : null,
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
        description: getSafeErrorMessage(error, '다시 한 번 시도해주세요.'),
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
        description: getSafeErrorMessage(error, '다시 시도해주세요.'),
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
          subjectLabel: (task.subject || 'etc') === 'etc' ? normalizeCustomSubjectLabel(task.subjectLabel) : null,
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
        description: getSafeErrorMessage(error, '다시 시도해주세요.'),
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
        description: getSafeErrorMessage(error, '다시 시도해주세요.'),
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
        const customSubjectLabel = taskBlueprint?.subjectLabel?.trim()
          || (recentStudy?.subjectValue === 'etc' ? recentStudy.subjectLabel.trim() : '')
          || (subjectValue === 'etc' ? normalizeCustomSubjectLabel(newStudyCustomSubject) : '');
        const shouldKeepMinutes = taskBlueprint
          ? Boolean(taskBlueprint.targetMinutes && studyMode === 'volume')
          : recentStudy ? recentStudy.enableVolumeMinutes : enableVolumeStudyMinutes;

        data.subject = subjectValue;
        data.subjectLabel = subjectValue === 'etc' ? normalizeCustomSubjectLabel(customSubjectLabel) : null;
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
          setNewStudyCustomSubject(DEFAULT_CUSTOM_SUBJECT_LABEL);
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
        description: getSafeErrorMessage(error, '할 일을 저장하지 못했습니다.'),
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
    existingScheduleDoc?: Partial<StudentScheduleDoc> | null;
  }): Promise<PersistStudentScheduleResult> => {
    if (!firestore || !user) return { legacySyncWarning: false };

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
      createdAt:
        params.existingScheduleDoc?.createdAt ||
        (params.dateKey === selectedDateKey ? (selectedScheduleDoc as any)?.createdAt : null) ||
        serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    try {
      await syncLegacyScheduleItems(params.dateKey, scheduleDoc as StudentScheduleDoc);
      return { legacySyncWarning: false };
    } catch (error) {
      logHandledClientIssue(`[plan-track] sync schedule items failed (${params.dateKey})`, error);
      return { legacySyncWarning: true };
    }
  }, [activeMembership, firestore, selectedDateKey, selectedScheduleDoc, studentProfile?.name, syncLegacyScheduleItems, user]);

  const syncWeekdayTemplateToVisibleSchedules = useCallback(async (params: {
    templateId: string;
    targetWeekdays: number[];    
    draft: AttendanceScheduleDraft;
  }): Promise<PersistStudentScheduleResult> => {
    const targetWeekdaySet = new Set(params.targetWeekdays);
    const todayStart = startOfDay(new Date());
    const visibleTargetDays = weekDays.filter((day) => (
      targetWeekdaySet.has(getDay(day)) &&
      !isBefore(startOfDay(day), todayStart)
    ));
    let legacySyncWarning = false;

    for (const day of visibleTargetDays) {
      const dateKey = format(day, 'yyyy-MM-dd');
      const existingSchedule = weekScheduleMap[dateKey];
      const hasManualOverride = Boolean(
        existingSchedule &&
        existingSchedule.source !== 'regular-routine' &&
        existingSchedule.recurrenceSourceId !== params.templateId
      );

      if (hasManualOverride) {
        continue;
      }

      const persistResult = await persistStudentSchedule({
        dateKey,
        draft: params.draft,
        awaySlots: params.draft.awaySlots || [],
        recurrenceSourceId: params.templateId,
        source: 'regular-routine',
        recommendedStudyMinutes: scheduleRecommendationPrefill?.recommendedDailyStudyMinutes || null,
        recommendedWeeklyDays: scheduleRecommendationPrefill?.recommendedWeeklyDays || null,
        existingScheduleDoc: existingSchedule || null,
      });
      legacySyncWarning = legacySyncWarning || persistResult.legacySyncWarning;
    }
    return { legacySyncWarning };
  }, [persistStudentSchedule, scheduleRecommendationPrefill, weekDays, weekScheduleMap]);

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
    setAttendanceSaveError(null);
    applyAttendanceDraftToState({
      ...buildCurrentAttendanceDraft(),
      ...patch,
      awaySlots: patch.awaySlots ?? extraAwayPlans,
    });
  }, [applyAttendanceDraftToState, buildCurrentAttendanceDraft, extraAwayPlans]);

  const handleWeekdayDraftChange = useCallback((patch: Partial<AttendanceScheduleDraft>) => {
    setAttendanceSaveError(null);
    setWeekdayDraft((previous) => ({
      ...previous,
      ...patch,
      awaySlots: patch.awaySlots ?? previous.awaySlots,
    }));
  }, []);

  const handleScheduleNoteChange = useCallback((value: string) => {
    setAttendanceSaveError(null);
    setScheduleNote(value);
  }, []);

  const handleSaveTodaySchedule = useCallback(async () => {
    if (!selectedDateKey) return false;
    setIsSubmitting(true);
    setAttendanceSaveError(null);
    try {
      const persistResult = await persistStudentSchedule({
        dateKey: selectedDateKey,
        draft: buildCurrentAttendanceDraft(),
        awaySlots: extraAwayPlans,
        note: scheduleNote,
        source: scheduleRecommendationPrefill ? 'planner-diagnostic' : 'manual',
        recommendedStudyMinutes: scheduleRecommendationPrefill?.recommendedDailyStudyMinutes || null,
        recommendedWeeklyDays: scheduleRecommendationPrefill?.recommendedWeeklyDays || null,
      });
      setScheduleSaveFeedback({
        variant: persistResult.legacySyncWarning ? 'warning' : 'success',
        title: '날짜별 일정 저장 완료',
        description: persistResult.legacySyncWarning
          ? '선택한 날짜의 등하원·외출 일정을 저장했어요. 일부 일정 카드는 잠시 늦게 갱신될 수 있어요.'
          : '선택한 날짜의 등하원·외출 일정을 저장했어요.',
      });
      clearSchedulePrefillCache();
      setIsAttendanceScheduleSheetOpen(false);
      return true;
    } catch (error: any) {
      setAttendanceSaveError({
        title: '일정 저장 실패',
        description: getSafeErrorMessage(error, '일정을 저장하지 못했어요.'),
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [buildCurrentAttendanceDraft, clearSchedulePrefillCache, extraAwayPlans, persistStudentSchedule, scheduleNote, scheduleRecommendationPrefill, selectedDateKey]);

  const handleSetTodayAbsent = useCallback(async () => {
    if (!selectedDateKey) return;
    setIsSubmitting(true);
    setAttendanceSaveError(null);
    try {
      const persistResult = await persistStudentSchedule({
        dateKey: selectedDateKey,
        draft: {
          ...buildCurrentAttendanceDraft(),
          isAbsent: true,
        },
        note: scheduleNote,
      });
      setScheduleSaveFeedback({
        variant: persistResult.legacySyncWarning ? 'warning' : 'success',
        title: '미등원 일정 저장 완료',
        description: persistResult.legacySyncWarning
          ? '선택한 날짜를 미등원 일정으로 저장했어요. 일부 일정 카드는 잠시 늦게 갱신될 수 있어요.'
          : '선택한 날짜를 미등원 일정으로 저장했어요.',
      });
      clearSchedulePrefillCache();
      setIsAttendanceScheduleSheetOpen(false);
    } catch (error: any) {
      setAttendanceSaveError({
        title: '일정 저장 실패',
        description: getSafeErrorMessage(error, '일정을 저장하지 못했어요.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [buildCurrentAttendanceDraft, clearSchedulePrefillCache, persistStudentSchedule, scheduleNote, selectedDateKey]);

  const handleResetTodaySchedule = useCallback(async () => {
    if (!firestore || !user || !selectedDateKey) return;
    setIsSubmitting(true);
    setAttendanceSaveError(null);
    try {
      await deleteDoc(doc(firestore, 'users', user.uid, 'schedules', selectedDateKey));
      let legacySyncWarning = false;
      try {
        await syncLegacyScheduleItems(selectedDateKey, null);
      } catch (error) {
        legacySyncWarning = true;
        logHandledClientIssue(`[plan-track] clear schedule items failed (${selectedDateKey})`, error);
      }
      applyAttendanceDraftToState(EMPTY_ATTENDANCE_SCHEDULE_DRAFT);
      setScheduleNote('');
      clearSchedulePrefillCache();
      setScheduleSaveFeedback({
        variant: legacySyncWarning ? 'warning' : 'success',
        title: '이 날짜 일정 초기화',
        description: legacySyncWarning
          ? '저장된 날짜별 일정을 비웠어요. 일부 일정 카드는 잠시 늦게 갱신될 수 있어요.'
          : '저장된 날짜별 일정을 비웠어요.',
      });
      setIsAttendanceScheduleSheetOpen(false);
    } catch (error: any) {
      setAttendanceSaveError({
        title: '초기화 실패',
        description: getSafeErrorMessage(error, '일정을 초기화하지 못했어요.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [applyAttendanceDraftToState, clearSchedulePrefillCache, firestore, selectedDateKey, syncLegacyScheduleItems, user]);

  const handleToggleRecurringWeekday = useCallback((weekday: number) => {
    setAttendanceSaveError(null);
    setSelectedRecurringWeekdays((previous) =>
      previous.includes(weekday)
        ? previous.filter((value) => value !== weekday)
        : [...previous, weekday].sort()
    );
  }, []);

  const handleCopyTodayToWeekday = useCallback(() => {
    setAttendanceSaveError(null);
    setWeekdayDraft(buildCurrentAttendanceDraft());
  }, [buildCurrentAttendanceDraft]);

  const handleSaveWeekdayTemplate = useCallback(async () => {
    if (!firestore || !user) return false;
    if (selectedRecurringWeekdays.length === 0) {
      setAttendanceSaveError({
        title: '반복 요일을 선택해 주세요',
        description: '최소 1개 이상의 요일을 선택해야 저장할 수 있어요.',
      });
      return false;
    }

    const validationMessage = validateScheduleDraft(weekdayDraft, weekdayDraft.awaySlots || []);
    if (validationMessage) {
      setAttendanceSaveError({
        title: '반복 루틴 저장 실패',
        description: validationMessage,
      });
      return false;
    }

    setIsSubmitting(true);
    setAttendanceSaveError(null);
    try {
      const targetWeekdays = [...selectedRecurringWeekdays].sort((left, right) => left - right);
      const templateId = matchingRecurringTemplate?.id || `template-${selectedRecurringWeekdays.join('-')}`;
      const batch = writeBatch(firestore);

      activeScheduleTemplates.forEach((template) => {
        if (!template.id || template.id === templateId || !Array.isArray(template.weekdays)) return;
        const overlappingWeekdays = template.weekdays.filter((weekday) => targetWeekdays.includes(weekday));
        if (overlappingWeekdays.length === 0) return;

        const remainingWeekdays = template.weekdays.filter((weekday) => !targetWeekdays.includes(weekday));
        batch.set(
          doc(firestore, 'users', user.uid, 'scheduleTemplates', template.id),
          {
            weekdays: remainingWeekdays,
            active: remainingWeekdays.length > 0,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      batch.set(
        doc(firestore, 'users', user.uid, 'scheduleTemplates', templateId),
        {
          name: presetName.trim() || `${selectedRecurringWeekdayLabel} 기본 루틴`,
          weekdays: targetWeekdays,
          arrivalPlannedAt: weekdayDraft.inTime,
          departurePlannedAt: weekdayDraft.outTime,
          hasExcursionDefault: Boolean(weekdayDraft.awayStartTime && weekdayDraft.awayEndTime),
          defaultExcursionStartAt: weekdayDraft.awayStartTime || null,
          defaultExcursionEndAt: weekdayDraft.awayEndTime || null,
          defaultExcursionReason: weekdayDraft.awayReason?.trim() || null,
          active: true,
          timezone: 'Asia/Seoul',
          createdAt: matchingRecurringTemplate?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await batch.commit();
      let syncResult: PersistStudentScheduleResult = { legacySyncWarning: false };
      let visibleSyncWarning = false;

      try {
        syncResult = await syncWeekdayTemplateToVisibleSchedules({
          templateId,
          targetWeekdays,
          draft: weekdayDraft,
        });
      } catch (error) {
        visibleSyncWarning = true;
        logHandledClientIssue('[plan-track] sync weekday template to visible schedules failed', error);
      }

      clearSchedulePrefillCache();
      setScheduleSaveFeedback({
        variant: syncResult.legacySyncWarning || visibleSyncWarning ? 'warning' : 'success',
        title: '주간 기본 일정 저장 완료',
        description: visibleSyncWarning
          ? `매주 ${selectedRecurringWeekdayLabel} 기본 일정을 저장했어요. 이번 주 일정 반영은 잠시 늦을 수 있어요.`
          : syncResult.legacySyncWarning
          ? `매주 ${selectedRecurringWeekdayLabel} 기본 일정을 저장했어요. 일부 일정 카드는 잠시 늦게 갱신될 수 있어요.`
          : `매주 ${selectedRecurringWeekdayLabel} 기본 일정을 저장하고 이번 주에도 바로 반영했어요.`,
      });
      setAttendanceSheetInitialTab('weekday');
      setIsAttendanceScheduleSheetOpen(false);
      return true;
    } catch (error: any) {
      logHandledClientIssue('[plan-track] save weekday template failed', error);
      setAttendanceSaveError({
        title: '정기 루틴 저장 실패',
        description: getSafeErrorMessage(error, '반복 루틴을 저장하지 못했어요.'),
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [activeScheduleTemplates, clearSchedulePrefillCache, firestore, matchingRecurringTemplate, presetName, selectedRecurringWeekdayLabel, selectedRecurringWeekdays, syncWeekdayTemplateToVisibleSchedules, user, weekdayDraft]);

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
    const itemRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id);
    const nextState = !item.done;

    if (resolveStudyPlanMode(item) === 'volume') {
      if (!nextState) {
        await updateDoc(itemRef, {
          actualAmount: 0,
          done: false,
          completedAt: null,
          completedWithinPlannedTime: null,
          completionOvertimeMinutes: null,
          updatedAt: serverTimestamp(),
        });
        return;
      }

      await handleCommitStudyActualAmount(item, Math.max(0, item.targetAmount || 0));
      return;
    }

    if (!nextState) {
      await updateDoc(itemRef, {
        done: false,
        completedAt: null,
        completedWithinPlannedTime: null,
        completionOvertimeMinutes: null,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    setCompletionReviewItem(item);
    setIsCompletionDialogOpen(true);
  };

  const handleConfirmTaskCompletion = useCallback(async () => {
    if (
      !completionReviewItem ||
      !firestore ||
      !user ||
      !activeMembership ||
      !isStudent ||
      !weekKey ||
      !selectedDateKey
    ) {
      return;
    }

    const overtimeMinutes = completionWithinPlannedTime
      ? 0
      : Math.max(0, Math.round(Number(completionOvertimeMinutes) || 0));

    if (!completionWithinPlannedTime && overtimeMinutes <= 0) {
      toast({
        variant: 'destructive',
        title: '추가로 걸린 시간을 적어주세요',
        description: '계획보다 더 걸렸다면 몇 분 더 걸렸는지 입력해주시면 돼요.',
      });
      return;
    }

    setIsCompletionSubmitting(true);
    try {
      const itemRef = doc(
        firestore,
        'centers',
        activeMembership.id,
        'plans',
        user.uid,
        'weeks',
        weekKey,
        'items',
        completionReviewItem.id
      );

      await updateDoc(itemRef, {
        done: true,
        completedAt: serverTimestamp(),
        completedWithinPlannedTime: completionWithinPlannedTime,
        completionOvertimeMinutes: completionWithinPlannedTime ? 0 : overtimeMinutes,
        updatedAt: serverTimestamp(),
      });

      const nextCompletedCount =
        checklistTasks.filter((task) => task.id !== completionReviewItem.id && task.done).length + 1;
      const awarded = await awardPlannerCompletionPoints(
        completionReviewItem,
        nextCompletedCount,
        checklistTasks.length
      );

      if (awarded > 0) {
        pushFloatingPointBurst(`+${awarded}`);
      }

      toast({
        title: completionWithinPlannedTime ? '제시간에 완료했어요' : '완료 시간까지 함께 기록했어요',
        description: completionWithinPlannedTime
          ? awarded > 0
            ? `계획 완료와 함께 +${awarded} 포인트가 반영됐어요.`
            : '완료 체크가 반영됐어요.'
          : `${overtimeMinutes}분 더 걸린 기록까지 저장했어요.`,
      });

      setIsCompletionDialogOpen(false);
      setCompletionReviewItem(null);
    } finally {
      setIsCompletionSubmitting(false);
    }
  }, [
    activeMembership,
    awardPlannerCompletionPoints,
    checklistTasks,
    completionOvertimeMinutes,
    completionReviewItem,
    completionWithinPlannedTime,
    firestore,
    isStudent,
    pushFloatingPointBurst,
    selectedDateKey,
    toast,
    user,
    weekKey,
  ]);

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
        description: getSafeErrorMessage(error, '학습 계획을 복사하지 못했습니다.'),
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
        description: getSafeErrorMessage(error, '생활 루틴을 복사하지 못했습니다.'),
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
      logHandledClientIssue('[plan-track] copy plans failed', error);
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
  const selectedDateHeroKicker = isToday
    ? '오늘의 투두리스트'
    : isPast
      ? '지난 날짜 투두리스트'
      : '선택한 날짜 투두리스트';

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
    <div className={cn("student-font-shell flex flex-col w-full max-w-5xl mx-auto pb-24", isMobile ? "gap-4 px-0" : "gap-6")}>
      <section className={cn("student-utility-card overflow-hidden rounded-[1.7rem] border border-[#1F427E]/28 bg-[radial-gradient(circle_at_top_right,rgba(255,173,78,0.18),transparent_26%),radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_32%),linear-gradient(180deg,#11285B_0%,#17326B_46%,#21448D_100%)] text-white shadow-[0_24px_56px_-34px_rgba(20,41,95,0.48)]", isMobile ? "rounded-[1.35rem]" : "rounded-[2rem]")}>
        <div className={cn("space-y-5", isMobile ? "p-4" : "p-7")}>
          <div className={cn(
            "rounded-[1.45rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.05)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_22px_42px_-30px_rgba(4,11,31,0.48)]",
            isMobile ? "px-4 py-4" : "px-5 py-5"
          )}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-3">
                <Badge className="student-aggro-kicker border-none bg-white/12 px-3 py-1 text-[9px] text-white shadow-none">
                  {selectedDateHeroKicker}
                </Badge>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className={cn("font-aggro-display break-keep font-black tracking-[-0.04em] text-white", isMobile ? "text-[1.65rem] leading-[1.08]" : "text-[2.35rem] leading-[1.03]")}>
                      {selectedDateTitle}
                    </h2>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn("rounded-full border border-white/16 bg-white/10 text-white hover:bg-white/16 hover:text-white", isMobile ? "h-10 w-10" : "h-11 w-11")}
                      onClick={() => moveSelectedDay(-1)}
                      aria-label="이전 날짜 보기"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn("rounded-full border border-white/16 bg-white/10 text-white hover:bg-white/16 hover:text-white", isMobile ? "h-10 w-10" : "h-11 w-11")}
                      onClick={() => moveSelectedDay(1)}
                      aria-label="다음 날짜 보기"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div className={cn(
              "mt-4 rounded-[1.25rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.05)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
              isMobile ? "px-4 py-4" : "px-4 py-4"
            )}>
              <div className={cn("gap-3", isMobile ? "space-y-3" : "flex items-end justify-between")}>
                <div className="min-w-0">
                  <p className="student-aggro-kicker text-[10px] text-white/68">오늘 목표시간 진행</p>
                  <p className={cn("font-aggro-display mt-2 break-keep font-black text-white", isMobile ? "text-[1.08rem] leading-6" : "text-[1.18rem] leading-7")}>
                    {studyGoalSummaryLabel}
                  </p>
                </div>
                <div className={cn("flex items-center gap-2", isMobile ? "justify-between" : "justify-end")}>
                  <span className="student-aggro-body text-[11px] font-black text-white/64">총 계획 {formatMinutesSummary(studyTimeSummary.total)}</span>
                  <button
                    type="button"
                    onClick={openGoalTargetDialog}
                    className="student-aggro-body inline-flex items-center gap-1.5 rounded-full border border-white/14 bg-white/10 px-3 py-1 text-[10px] font-black text-white shadow-none transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    aria-label="목표 시간 수정"
                    disabled={isGoalTargetSaving}
                  >
                    <span>목표 {formatMinutesSummary(recommendedDailyMinutes)}</span>
                    <PencilLine className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <div className="relative mt-4">
                <Progress
                  value={planProgressPercent}
                  className="h-3.5 bg-white/12 shadow-[inset_0_1px_2px_rgba(7,18,48,0.24)]"
                  indicatorClassName="bg-[linear-gradient(90deg,rgba(255,255,255,0.78)_0%,#FFFFFF_52%,rgba(255,255,255,0.88)_100%)]"
                />
                <div className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.16)_50%,transparent_100%)] opacity-80" />
              </div>
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(10,24,57,0.18)_0%,rgba(255,255,255,0.05)_100%)] px-4 py-4">
            <div className="flex flex-wrap items-center gap-2.5">
            {(subjectBalanceEntries.length > 0 ? subjectBalanceEntries.slice(0, 4).map((entry) => (
              <Badge key={entry.subjectId} className="student-aggro-body rounded-full border border-white/15 bg-white px-3 py-1.5 text-[10px] font-black text-[#17326B] shadow-[0_8px_18px_-16px_rgba(8,20,54,0.48)]">
                {entry.subjectLabel} {formatMinutesSummary(entry.minutes)}
              </Badge>
            )) : prioritySubjectLabels.slice(0, 4).map((label) => (
              <Badge key={label} className="student-aggro-body rounded-full border border-white/15 bg-white px-3 py-1.5 text-[10px] font-black text-[#17326B] shadow-[0_8px_18px_-16px_rgba(8,20,54,0.48)]">
                {label}
              </Badge>
            )))}
            {subjectBalanceEntries.length === 0 && prioritySubjectLabels.length === 0 ? (
              <Badge className="student-aggro-body rounded-full border-none bg-white/12 px-3 py-1 text-[10px] font-black text-white shadow-none">
                우선 과목을 아직 정하지 않았어요
              </Badge>
            ) : null}
            </div>
          </div>

          <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_auto]")}>
            <div className="space-y-3">
              {visibleChecklistTasks.length === 0 ? (
                <div className="rounded-[1.25rem] border border-dashed border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.05)_100%)] px-4 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                  <p className="font-aggro-display text-[1.05rem] font-black text-white">오늘 계획이 아직 비어 있어요</p>
                  <p className="student-aggro-body mt-2 break-keep text-[12px] font-semibold leading-5 text-white/70">
                    첫 공부 블록이나 기타 일정 하나만 적어도 충분해요. 오늘 바로 시작할 수 있는 것부터 가볍게 넣어보세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleChecklistTasks.map((task) => {
                    const isStudyTask = task.category === 'study' || !task.category;
                    const subjectLabel = isStudyTask ? resolveSubjectLabel(task.subject, task.subjectLabel) : '기타 일정';
                    const isVolumeTask = resolveStudyPlanMode(task) === 'volume';
                    const metaLabel = buildChecklistMeta(task);
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-[1.15rem] border px-4 py-3 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
                          task.done
                            ? "border-[#FFB86F]/40 bg-[linear-gradient(180deg,rgba(255,182,101,0.18)_0%,rgba(255,255,255,0.08)_100%)]"
                            : "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.07)_100%)] hover:border-white/16"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="student-aggro-body rounded-full border-none bg-white px-2.5 py-1 text-[9px] font-black text-[#17326B] shadow-none">
                              {subjectLabel}
                            </Badge>
                            {isStudyTask && isVolumeTask ? (
                              <span className="student-aggro-kicker text-[10px] font-black uppercase tracking-[0.16em] text-white/55">
                                분량형
                              </span>
                            ) : null}
                          </div>
                          <p className={cn("font-aggro-display mt-2 break-keep text-[1rem] font-black tracking-[-0.03em]", task.done ? "text-white/70 line-through" : "text-white")}>
                            {task.title}
                          </p>
                          <p className="student-aggro-body mt-1 text-[11px] font-semibold text-white/68">{metaLabel}</p>
                        </div>
                        <Button
                          type="button"
                          variant={task.done ? 'outline' : 'secondary'}
                          className={cn(
                            "student-aggro-body shrink-0 rounded-full px-4 font-black shadow-none",
                            task.done
                              ? "border-white/16 bg-white/8 text-white hover:bg-white/12 hover:text-white"
                              : "border border-white/12 bg-white text-[#17326B] hover:bg-[#FFF4E8]",
                            isMobile ? "h-9 text-[11px]" : "h-10 text-xs"
                          )}
                          onClick={() => void handleToggleTask(task as WithId<StudyPlanItem>)}
                          disabled={isPast}
                        >
                          {task.done ? '완료됨' : '완료'}
                        </Button>
                      </div>
                    );
                  })}
                  {hiddenChecklistTaskCount > 0 ? (
                    <p className="student-aggro-body text-[11px] font-semibold text-white/70">
                      나머지 {hiddenChecklistTaskCount}개는 계획 수정에서 이어서 볼 수 있어요.
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div className={cn("flex gap-2", isMobile ? "grid grid-cols-2" : "flex-col justify-start")}>
              <Button
                type="button"
                className={cn("student-aggro-body rounded-[1rem] border border-white/10 font-black text-white bg-gradient-to-r shadow-[0_18px_28px_-24px_rgba(255,138,42,0.6)]", isMobile ? "h-11 text-[12px]" : "h-11 min-w-[132px] text-xs", rewardGradient)}
                onClick={() => openStudyPlanSheet()}
                disabled={isPast}
              >
                <Plus className="mr-2 h-4 w-4" />
                계획 추가
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn("student-aggro-body rounded-[1rem] border-white/18 bg-white/8 font-black text-white hover:bg-white/12 hover:text-white", isMobile ? "h-11 text-[12px]" : "h-11 min-w-[132px] text-xs")}
                onClick={() => setIsStudyPlanSheetOpen(true)}
              >
                <PencilLine className="mr-2 h-4 w-4" />
                계획 수정
              </Button>
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(8,20,49,0.18)_0%,rgba(255,255,255,0.06)_100%)] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <div className="flex flex-wrap items-center gap-2">
              <p className="student-aggro-kicker text-[10px] font-black uppercase tracking-[0.18em] text-white/65">빠른 추가</p>
              {PLANNER_QUICK_TASK_SUGGESTIONS.slice(0, 4).map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => void handleQuickAddSuggestion(suggestion.id)}
                  className="student-aggro-body rounded-full border border-white/16 bg-white px-3 py-1.5 text-[10px] font-black text-[#17326B] transition hover:border-[#FFB665]/60 hover:bg-[#FFF4E8]"
                  disabled={isPast}
                >
                  {suggestion.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={cn("student-utility-card overflow-hidden rounded-[1.7rem] border border-[#DCE6F5] bg-[radial-gradient(circle_at_top_right,rgba(255,166,84,0.16),transparent_18%),linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] shadow-[0_20px_48px_-34px_rgba(20,41,95,0.18)]", isMobile ? "rounded-[1.35rem]" : "rounded-[2rem]")}>
        <div className={cn("space-y-4", isMobile ? "p-4" : "p-5")}>
          <div className={cn("flex gap-3", isMobile ? "flex-col" : "items-start justify-between")}>
            <div className="min-w-0">
              <Badge className="student-aggro-kicker border-none bg-[#14295F]/8 px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] text-[#14295F] shadow-none">
                이번 주 독서실 일정
              </Badge>
            </div>
            <div className={cn("flex gap-2", isMobile ? "flex-col" : "flex-wrap justify-end")}>
              <Button
                type="button"
                className={cn("student-aggro-body rounded-xl border border-[#14295F]/10 font-black text-white bg-gradient-to-r shadow-[0_14px_26px_-20px_rgba(255,138,42,0.48)]", isMobile ? "h-10 w-full text-[11px]" : "h-11 px-4 text-xs", rewardGradient)}
                onClick={() => openAttendanceSheetForDate(tomorrowDate, 'today')}
              >
                내일 일정 수정하기
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn("student-aggro-body rounded-xl border border-[#D8E3F2] bg-white font-black text-[#17326B] hover:bg-[#FFF7EF]", isMobile ? "h-10 w-full text-[11px]" : "h-11 px-4 text-xs")}
                onClick={() => {
                  setAttendanceSheetInitialTab('weekday');
                  setAttendanceSaveError(null);
                  setIsAttendanceScheduleSheetOpen(true);
                }}
              >
                이번 주 한 번에 설정
              </Button>
            </div>
          </div>

          {scheduleRecommendationPrefill ? (
            <div className="rounded-[1.15rem] border border-[#FFE2C5] bg-[#FFF7EF] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <p className="student-aggro-kicker text-[10px] font-black uppercase tracking-[0.18em] text-[#D86A11]">플래너 연동 추천</p>
              <p className="font-aggro-display mt-2 break-keep text-[1.02rem] font-black text-[#17326B]">
                이번 주 권장 등원 {scheduleRecommendationPrefill.recommendedWeeklyDays}일 · 하루 권장 공부 {formatMinutesSummary(scheduleRecommendationPrefill.recommendedDailyStudyMinutes)}
              </p>
              <p className="student-aggro-body mt-1 break-keep text-[12px] font-semibold leading-5 text-[#6C5A49]">
                추천 등원 {scheduleRecommendationPrefill.recommendedArrivalTime} · 추천 하원 {scheduleRecommendationPrefill.recommendedDepartureTime}
              </p>
            </div>
          ) : null}

          {needsTomorrowSchedule ? (
            <div className="rounded-[1.15rem] border border-[#FFD7B5] bg-[#FFF4E8] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
              <p className="font-aggro-display text-[1rem] font-black text-[#17326B]">내일 독서실 일정이 아직 없어요. 오늘 미리 정해두면 좋아요.</p>
            </div>
          ) : null}

          {scheduleSaveFeedback ? (
            <div
              className={cn(
                'rounded-[1.15rem] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_16px_28px_-24px_rgba(20,41,95,0.12)]',
                scheduleSaveFeedback.variant === 'warning'
                  ? 'border border-[#FFD7B5] bg-[linear-gradient(180deg,#FFF8EE_0%,#FFFFFF_100%)]'
                  : 'border border-[#D5E3FA] bg-[linear-gradient(180deg,#F6F9FF_0%,#FFFFFF_100%)]'
              )}
            >
              <p
                className={cn(
                  'student-aggro-kicker text-[10px] font-black uppercase tracking-[0.18em]',
                  scheduleSaveFeedback.variant === 'warning' ? 'text-[#D86A11]' : 'text-[#2F5AC7]'
                )}
              >
                {scheduleSaveFeedback.variant === 'warning' ? '저장 경고' : '저장 완료'}
              </p>
              <p className="font-aggro-display mt-2 break-keep text-[1rem] font-black text-[#17326B]">
                {scheduleSaveFeedback.title}
              </p>
              <p
                className={cn(
                  'student-aggro-body mt-1 break-keep text-[12px] font-semibold leading-5',
                  scheduleSaveFeedback.variant === 'warning' ? 'text-[#8E5A2B]' : 'text-[#5A6F95]'
                )}
              >
                {scheduleSaveFeedback.description}
              </p>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => moveWeek(-1)}
              className={cn("rounded-xl border border-[#D8E3F2] bg-white text-[#17326B] hover:border-[#17326B] hover:bg-[#17326B] hover:text-white", isMobile ? "h-9 w-9" : "h-10 w-10")}
              aria-label="지난 주 보기"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="student-aggro-kicker text-center text-[11px] font-black uppercase tracking-[0.18em] text-[#8AA0C7]">{weekRangeLabel}</p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => moveWeek(1)}
              className={cn("rounded-xl border border-[#D8E3F2] bg-white text-[#17326B] hover:border-[#17326B] hover:bg-[#17326B] hover:text-white", isMobile ? "h-9 w-9" : "h-10 w-10")}
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
                  day.isSelected
                    ? "border-[#17326B] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] shadow-[0_18px_28px_-24px_rgba(20,41,95,0.3)]"
                    : "border-[#E5ECF7] bg-white hover:-translate-y-[1px] hover:border-[#FFB665]/70",
                  day.isToday && !day.isSelected && "border-[#FFB665]/70"
                )}
              >
                <p className="student-aggro-kicker text-[9px] font-black uppercase tracking-[0.16em] text-[#8AA0C7]">{day.weekdayLabel}</p>
                <p className="font-aggro-display mt-2 text-base font-black tracking-[-0.03em] text-[#17326B]">{day.dateLabel}</p>
                <Badge
                  className={cn(
                    'student-aggro-body mt-3 inline-flex min-h-[1.2rem] max-w-full items-center justify-center rounded-full border px-1.5 py-0 text-center text-[7px] font-black leading-none tracking-[-0.02em] shadow-none',
                    SCHEDULE_STATUS_BADGE_TONE[day.status] || SCHEDULE_STATUS_BADGE_TONE['미정']
                  )}
                >
                  {day.status}
                </Badge>
                {day.timeLabel ? (
                  <p className="student-aggro-body mt-1 break-keep text-[10px] font-semibold leading-4 text-[#5A6F95]">{day.timeLabel}</p>
                ) : null}
                {day.hasExcursion ? (
                  <Badge className="student-aggro-body mt-2 rounded-full border border-[#FFE2C5] bg-[#FFF4E8] px-2 py-0.5 text-[8px] font-black text-[#D86A11] shadow-none">
                    외출
                  </Badge>
                ) : null}
              </button>
            ))}
          </div>

        </div>
      </section>

      <Dialog
        open={isGoalTargetDialogOpen}
        onOpenChange={(open) => {
          if (isGoalTargetSaving) return;
          if (!open) setGoalTargetSaveError(null);
          setIsGoalTargetDialogOpen(open);
        }}
      >
        <DialogContent className="w-[min(92vw,28rem)] rounded-[1.8rem] border border-[#E5ECF7] bg-white p-0 shadow-[0_24px_60px_-30px_rgba(20,41,95,0.32)]">
          <div className="rounded-t-[1.8rem] bg-[linear-gradient(180deg,#17326B_0%,#21448D_100%)] px-6 py-5 text-white">
            <DialogHeader className="text-left">
              <DialogTitle className="text-xl font-black tracking-tight text-white">
                하루 목표시간 수정
              </DialogTitle>
              <DialogDescription className="mt-1 break-keep text-[12px] font-semibold leading-5 text-white/72">
                {routineSuggestedDailyMinutes > 0
                  ? `루틴 추천은 ${formatMinutesSummary(routineSuggestedDailyMinutes)}이에요. 여기서 학생 기준으로 직접 조절할 수 있어요.`
                  : '오늘 계획 흐름에 맞게 하루 목표시간을 직접 설정할 수 있어요.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveGoalTarget();
            }}
          >
            <div className="space-y-4 px-6 py-5">
              <div className="rounded-[1.15rem] border border-[#E6EDF8] bg-[#F8FBFF] px-4 py-4">
                <p className="text-[12px] font-semibold leading-5 text-[#5A6F95]">
                  현재 적용 중인 목표는 {formatMinutesSummary(recommendedDailyMinutes)}이에요.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[1.15rem] border border-[#E6EDF8] bg-white px-4 py-4">
                  <Label htmlFor="goal-target-hours" className="text-[12px] font-black text-[#17326B]">
                    시간
                  </Label>
                  <Input
                    id="goal-target-hours"
                    type="number"
                    min={0}
                    max={24}
                    inputMode="numeric"
                    value={goalTargetHoursDraft}
                    onChange={(event) => {
                      setGoalTargetSaveError(null);
                      setGoalTargetHoursDraft(event.target.value);
                    }}
                    className="mt-2 h-12 rounded-[1rem] border-[#DCE6F5] bg-[#FCFDFF] text-base font-black text-[#17326B]"
                  />
                </div>
                <div className="rounded-[1.15rem] border border-[#E6EDF8] bg-white px-4 py-4">
                  <Label htmlFor="goal-target-minutes" className="text-[12px] font-black text-[#17326B]">
                    분
                  </Label>
                  <Input
                    id="goal-target-minutes"
                    type="number"
                    min={0}
                    max={59}
                    inputMode="numeric"
                    value={goalTargetMinutesDraft}
                    onChange={(event) => {
                      setGoalTargetSaveError(null);
                      setGoalTargetMinutesDraft(event.target.value);
                    }}
                    className="mt-2 h-12 rounded-[1rem] border-[#DCE6F5] bg-[#FCFDFF] text-base font-black text-[#17326B]"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 border-t border-[#EEF3FB] bg-[#FCFDFF] px-6 py-4 sm:flex-col">
              {goalTargetSaveError ? (
                <div className="w-full rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-left">
                  <p className="text-[11px] font-black text-rose-600">{goalTargetSaveError.title}</p>
                  <p className="mt-1 break-keep text-[12px] font-semibold leading-5 text-rose-500">
                    {goalTargetSaveError.description}
                  </p>
                </div>
              ) : null}
              <Button
                type="submit"
                disabled={isGoalTargetSaving}
                className={cn('h-12 w-full rounded-[1rem] font-black text-white bg-gradient-to-r', rewardGradient)}
              >
                {isGoalTargetSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    저장 중
                  </>
                ) : (
                  '목표시간 저장'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isGoalTargetSaving}
                onClick={() => {
                  setGoalTargetSaveError(null);
                  setIsGoalTargetDialogOpen(false);
                }}
                className="h-11 w-full rounded-[1rem] border-[#D6E1F3] font-black text-[#17326B]"
              >
                취소
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCompletionDialogOpen}
        onOpenChange={(open) => {
          setIsCompletionDialogOpen(open);
          if (!open && !isCompletionSubmitting) {
            setCompletionReviewItem(null);
          }
        }}
      >
        <DialogContent className="w-[min(92vw,28rem)] rounded-[1.8rem] border border-[#E5ECF7] bg-white p-0 shadow-[0_24px_60px_-30px_rgba(20,41,95,0.32)]">
          <div className="rounded-t-[1.8rem] bg-[linear-gradient(180deg,#17326B_0%,#21448D_100%)] px-6 py-5 text-white">
            <DialogHeader className="text-left">
              <DialogTitle className="text-xl font-black tracking-tight text-white">
                완료 체크 전에 한 번만 확인할게요
              </DialogTitle>
              <DialogDescription className="mt-1 break-keep text-[12px] font-semibold leading-5 text-white/72">
                {completionReviewItem?.category === 'personal'
                  ? '기타 일정도 완료 체크할 수 있어요. 예상보다 더 걸렸다면 시간도 같이 남겨둘 수 있어요.'
                  : '계획한 시간 안에 끝났는지 같이 기록해두면, 다음 추천이 더 정확해져요.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-4 px-6 py-5">
            {completionReviewItem ? (
              <div className="rounded-[1.2rem] border border-[#E6EDF8] bg-[#F8FBFF] px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-none bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary shadow-none">
                    {completionReviewItem.category === 'personal'
                      ? '기타 일정'
                      : resolveSubjectLabel(completionReviewItem.subject, completionReviewItem.subjectLabel)}
                  </Badge>
                  {completionReviewItem.category !== 'personal' ? (
                    <span className="text-[10px] font-black text-[#8AA0C7]">
                      {buildStudyTaskMeta(completionReviewItem)}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 break-keep text-base font-black text-[#17326B]">
                  {completionReviewItem.title}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCompletionWithinPlannedTime(true)}
                className={cn(
                  'rounded-[1.15rem] border px-4 py-4 text-left transition-all',
                  completionWithinPlannedTime
                    ? 'border-[#FFB347] bg-[#FFF4E8] shadow-[0_12px_28px_-20px_rgba(216,106,17,0.35)]'
                    : 'border-[#E6EDF8] bg-white'
                )}
              >
                <p className="text-sm font-black text-[#17326B]">제시간에 끝냈어요</p>
                <p className="mt-1 break-keep text-[12px] font-semibold leading-5 text-[#5A6F95]">
                  계획한 흐름 안에서 마무리했다면 이대로 저장하면 돼요.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setCompletionWithinPlannedTime(false)}
                className={cn(
                  'rounded-[1.15rem] border px-4 py-4 text-left transition-all',
                  !completionWithinPlannedTime
                    ? 'border-[#FFB347] bg-[#FFF4E8] shadow-[0_12px_28px_-20px_rgba(216,106,17,0.35)]'
                    : 'border-[#E6EDF8] bg-white'
                )}
              >
                <p className="text-sm font-black text-[#17326B]">더 걸렸어요</p>
                <p className="mt-1 break-keep text-[12px] font-semibold leading-5 text-[#5A6F95]">
                  계획보다 더 걸렸다면 얼마나 더 걸렸는지만 적어둘 수 있어요.
                </p>
              </button>
            </div>

            {!completionWithinPlannedTime ? (
              <div className="rounded-[1.15rem] border border-[#FFE2C5] bg-[#FFF8F1] px-4 py-4">
                <Label htmlFor="completion-overtime" className="text-[12px] font-black text-[#17326B]">
                  추가로 걸린 시간
                </Label>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    id="completion-overtime"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={completionOvertimeMinutes}
                    onChange={(event) => setCompletionOvertimeMinutes(event.target.value)}
                    className="h-12 rounded-[1rem] border-[#FFD7B5] bg-white text-base font-black text-[#17326B]"
                  />
                  <span className="text-sm font-black text-[#D86A11]">분</span>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="flex-col gap-2 border-t border-[#EEF3FB] bg-[#FCFDFF] px-6 py-4 sm:flex-col">
            <Button
              type="button"
              onClick={() => void handleConfirmTaskCompletion()}
              disabled={isCompletionSubmitting}
              className={cn('h-12 w-full rounded-[1rem] font-black text-white bg-gradient-to-r', rewardGradient)}
            >
              {isCompletionSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  저장 중
                </>
              ) : (
                '완료 기록 저장'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCompletionDialogOpen(false);
                setCompletionReviewItem(null);
              }}
              disabled={isCompletionSubmitting}
              className="h-11 w-full rounded-[1rem] border-[#DCE6F5] bg-white font-black text-[#17326B]"
            >
              다시 보기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        completedCount={completedStudyCount}
        subjectOptions={planSubjectOptions}
        subjectValue={newStudySubject}
        onSubjectChange={setNewStudySubject}
        customSubjectValue={newStudyCustomSubject}
        onCustomSubjectChange={setNewStudyCustomSubject}
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
        modeOptions={STUDY_PLAN_MODE_OPTIONS.filter((option) => option.value === 'volume')}
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
        selectedDateWeekdayLabel={matchingWeekdayLabel}
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
        onNoteChange={handleScheduleNoteChange}
        recommendationPrefillSummary={scheduleRecommendationPrefill}
        saveError={attendanceSaveError}
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



