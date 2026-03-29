
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { type StudyPlanItem, type WithId, type GrowthProgress } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  ROUTINE_TEMPLATE_OPTIONS,
  EMPTY_ATTENDANCE_SCHEDULE_DRAFT,
  type AttendanceScheduleDraft,
  type RecentStudyOption,
  type SavedAttendanceRoutine,
  type StudyAmountUnit,
  type StudyPlanMode,
} from '@/components/dashboard/student-planner/planner-constants';
import { AttendanceScheduleSheet } from '@/components/dashboard/student-planner/attendance-schedule-sheet';
import { RoutineComposerCard } from '@/components/dashboard/student-planner/routine-composer-card';
import { StudyComposerCard } from '@/components/dashboard/student-planner/study-composer-card';
import { PlanItemCard } from '@/components/dashboard/student-planner/plan-item-card';
import { ScheduleItemCard } from '@/components/dashboard/student-planner/schedule-item-card';
import { RecentStudySheet } from '@/components/dashboard/student-planner/recent-study-sheet';
import { RepeatCopySheet } from '@/components/dashboard/student-planner/repeat-copy-sheet';
import { calculatePlanCompletionLp } from '@/lib/student-rewards';

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

type AttendanceSettingsDoc = {
  weekdayTemplates?: Record<string, AttendanceScheduleDraft>;
  savedRoutines?: SavedAttendanceRoutine[];
};

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

function normalizeAttendanceDraft(
  draft?: Partial<AttendanceScheduleDraft> | null
): AttendanceScheduleDraft {
  return {
    inTime: draft?.inTime || EMPTY_ATTENDANCE_SCHEDULE_DRAFT.inTime,
    outTime: draft?.outTime || EMPTY_ATTENDANCE_SCHEDULE_DRAFT.outTime,
    awayStartTime: draft?.awayStartTime || '',
    awayEndTime: draft?.awayEndTime || '',
    awayReason: draft?.awayReason || '',
    isAbsent: Boolean(draft?.isAbsent),
  };
}

function hasAttendanceTemplateValue(draft?: Partial<AttendanceScheduleDraft> | null) {
  if (!draft) return false;
  return Boolean(
    draft.isAbsent ||
    draft.inTime ||
    draft.outTime ||
    draft.awayStartTime ||
    draft.awayEndTime ||
    draft.awayReason
  );
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
  const [isPenaltyConfirmOpen, setIsPenaltyConfirmOpen] = useState(false);
  const [hasConfirmedTodayEdit, setHasConfirmedTodayEdit] = useState(false);
  const [pendingChange, setPendingChange] = useState<null | { type: 's' | 'e'; field: 'h' | 'm' | 'p'; value: string }>(null);

  useEffect(() => {
    const remote = parseRange(timePart);
    setSHour(remote.start.hour);
    setSMin(remote.start.minute);
    setSPer(remote.start.period);
    setEHour(remote.end.hour);
    setEMin(remote.end.minute);
    setEPer(remote.end.period);
  }, [timePart]);

  useEffect(() => {
    setHasConfirmedTodayEdit(false);
    setPendingChange(null);
    setIsPenaltyConfirmOpen(false);
  }, [item.id]);

  const applyValueChange = (type: 's' | 'e', field: 'h' | 'm' | 'p', val: string) => {
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

  const handleValueChange = (type: 's' | 'e', field: 'h' | 'm' | 'p', val: string) => {
    if (isPast) return;
    if (isToday && !hasConfirmedTodayEdit) {
      setPendingChange({ type, field, value: val });
      setIsPenaltyConfirmOpen(true);
      return;
    }

    applyValueChange(type, field, val);
  };

  const handleConfirmTodayEdit = () => {
    if (pendingChange) {
      setHasConfirmedTodayEdit(true);
      applyValueChange(pendingChange.type, pendingChange.field, pendingChange.value);
    }
    setPendingChange(null);
    setIsPenaltyConfirmOpen(false);
  };

  const handleCancelTodayEdit = () => {
    setPendingChange(null);
    setIsPenaltyConfirmOpen(false);
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

      <AlertDialog open={isPenaltyConfirmOpen} onOpenChange={setIsPenaltyConfirmOpen}>
        <AlertDialogContent className="max-w-[22rem] rounded-[1.5rem] border-slate-200 bg-white p-6">
          <AlertDialogHeader className="gap-2 text-left">
            <AlertDialogTitle className="text-lg font-black tracking-tight text-slate-900">
              오늘 루틴 수정 시 벌점이 부여돼요
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed text-slate-600">
              오늘 날짜의 루틴을 수정하면 하루 최대 1점 벌점이 자동 반영됩니다. 계속 수정할까요?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-0">
            <AlertDialogCancel
              onClick={handleCancelTodayEdit}
              className="mt-0 rounded-2xl border-slate-200 font-bold text-slate-600"
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmTodayEdit}
              className="rounded-2xl bg-slate-900 font-bold text-white hover:bg-slate-800"
            >
              수정 계속
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function StudyPlanPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, viewMode, currentTier } = useAppContext();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const isMobile = viewMode === 'mobile';
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
  const [taskCopyWeeks, setTaskCopyWeeks] = useState('4');
  const [routineCopyWeeks, setRoutineCopyWeeks] = useState('4');
  const [taskCopyDays, setTaskCopyDays] = useState<number[]>([]);
  const [routineCopyDays, setRoutineCopyDays] = useState<number[]>([]);
  const [taskCopyItemIds, setTaskCopyItemIds] = useState<string[]>([]);
  const [routineCopyItemIds, setRoutineCopyItemIds] = useState<string[]>([]);
  const [recentStudyOptions, setRecentStudyOptions] = useState<RecentStudyOption[]>([]);
  const [isRecentStudyLoading, setIsRecentStudyLoading] = useState(false);
  const [activeRecentStudyKey, setActiveRecentStudyKey] = useState<string | null>(null);
  const [isAttendanceSheetOpen, setIsAttendanceSheetOpen] = useState(false);

  const [inTime, setInTime] = useState('09:00');
  const [outTime, setOutTime] = useState('22:00');
  const [awayStartTime, setAwayStartTime] = useState('');
  const [awayEndTime, setAwayEndTime] = useState('');
  const [awayReason, setAwayReason] = useState('');
  const [attendanceIsAbsent, setAttendanceIsAbsent] = useState(false);
  const [selectedWeekdayTemplateDay, setSelectedWeekdayTemplateDay] = useState(1);
  const [weekdayDraft, setWeekdayDraft] = useState<AttendanceScheduleDraft>(EMPTY_ATTENDANCE_SCHEDULE_DRAFT);
  const [attendancePresetName, setAttendancePresetName] = useState('');

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
    if (!selectedDate) return;
    const day = getDay(selectedDate);
    setTaskCopyDays(prev => prev.length > 0 ? prev : [day]);
    setRoutineCopyDays(prev => prev.length > 0 ? prev : [day]);
    setSelectedWeekdayTemplateDay(day);
  }, [selectedDate]);

  const isStudent = activeMembership?.role === 'student';
  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const weekKey = selectedDate ? format(selectedDate, "yyyy-'W'II") : '';

  const isPast = selectedDate ? isBefore(startOfDay(selectedDate), startOfDay(new Date())) : false;
  const isToday = selectedDate ? isSameDay(selectedDate, new Date()) : false;
  const selectedDateLabel = selectedDate ? format(selectedDate, 'M월 d일 EEEE', { locale: ko }) : '';

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

  const attendanceCalendarDays = useMemo(
    () =>
      weekDays.map((day) => ({
        key: day.toISOString(),
        weekdayLabel: format(day, 'EEE', { locale: ko }),
        dateLabel: format(day, 'd'),
        isToday: isSameDay(day, new Date()),
        isSelected: selectedDate ? isSameDay(day, selectedDate) : false,
        date: day,
      })),
    [weekDays, selectedDate]
  );

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

  const attendanceSettingsRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'settings', 'attendance');
  }, [firestore, activeMembership, user]);
  const { data: attendanceSettingsDoc } = useDoc<AttendanceSettingsDoc>(attendanceSettingsRef, { enabled: isStudent });

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
    } catch (error) {
      console.error('최근 학습 계획을 불러오지 못했습니다.', error);
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
  const awayScheduleItem = useMemo(() => scheduleItems.find((item) => item.title.includes('외출 예정')), [scheduleItems]);
  const hasAwayPlan = Boolean(awayScheduleItem);
  const isAbsentMode = useMemo(() => scheduleItems.some(i => i.title.includes('등원하지 않습니다')), [scheduleItems]);
  const hasExplicitAttendancePlan = hasInPlan || hasOutPlan || hasAwayPlan || isAbsentMode;
  const attendanceSettings = useMemo(
    () => ({
      weekdayTemplates: attendanceSettingsDoc?.weekdayTemplates || {},
      savedRoutines: attendanceSettingsDoc?.savedRoutines || [],
    }),
    [attendanceSettingsDoc]
  );
  const selectedWeekdayTemplateRaw = useMemo(
    () => attendanceSettings.weekdayTemplates?.[String(selectedWeekdayTemplateDay)],
    [attendanceSettings.weekdayTemplates, selectedWeekdayTemplateDay]
  );
  const hasSelectedWeekdayTemplate = hasAttendanceTemplateValue(selectedWeekdayTemplateRaw);
  const selectedWeekdayTemplate = useMemo(
    () => normalizeAttendanceDraft(selectedWeekdayTemplateRaw),
    [selectedWeekdayTemplateRaw]
  );
  const savedAttendanceRoutines = useMemo(
    () => attendanceSettings.savedRoutines || [],
    [attendanceSettings.savedRoutines]
  );

  useEffect(() => {
    const arrival = scheduleItems.find((item) => item.title.startsWith('등원 예정: '));
    const dismissal = scheduleItems.find((item) => item.title.startsWith('하원 예정: '));
    const awayItem = scheduleItems.find((item) => item.title.startsWith('외출 예정'));

    if (arrival || dismissal || awayItem || isAbsentMode) {
      setInTime(arrival?.title.split(': ')[1] || EMPTY_ATTENDANCE_SCHEDULE_DRAFT.inTime);
      setOutTime(dismissal?.title.split(': ')[1] || EMPTY_ATTENDANCE_SCHEDULE_DRAFT.outTime);
      setAttendanceIsAbsent(isAbsentMode);
      if (awayItem) {
        const [baseTitle, rangeText = ''] = awayItem.title.split(': ');
        const [startText = '', endText = ''] = rangeText.split(' ~ ');
        setAwayStartTime(startText);
        setAwayEndTime(endText);
        setAwayReason(baseTitle.replace('외출 예정', '').replace(/^ · /, '').trim());
      } else {
        setAwayStartTime('');
        setAwayEndTime('');
        setAwayReason('');
      }
      return;
    }

    if (hasSelectedWeekdayTemplate) {
      setInTime(selectedWeekdayTemplate.inTime);
      setOutTime(selectedWeekdayTemplate.outTime);
      setAwayStartTime(selectedWeekdayTemplate.awayStartTime);
      setAwayEndTime(selectedWeekdayTemplate.awayEndTime);
      setAwayReason(selectedWeekdayTemplate.awayReason);
      setAttendanceIsAbsent(Boolean(selectedWeekdayTemplate.isAbsent));
      return;
    }

    setInTime(EMPTY_ATTENDANCE_SCHEDULE_DRAFT.inTime);
    setOutTime(EMPTY_ATTENDANCE_SCHEDULE_DRAFT.outTime);
    setAwayStartTime('');
    setAwayEndTime('');
    setAwayReason('');
    setAttendanceIsAbsent(false);
  }, [scheduleItems, isAbsentMode, hasSelectedWeekdayTemplate, selectedWeekdayTemplate]);

  useEffect(() => {
    setWeekdayDraft(selectedWeekdayTemplate);
  }, [selectedWeekdayTemplate]);

  const resolvedAbsentMode = hasExplicitAttendancePlan ? isAbsentMode : Boolean(selectedWeekdayTemplateRaw?.isAbsent);
  const attendanceSourceLabel = hasExplicitAttendancePlan
    ? '오늘 직접 설정'
    : hasSelectedWeekdayTemplate
      ? `${WEEKDAY_OPTIONS.find((option) => option.value === selectedWeekdayTemplateDay)?.label || '이 요일'} 기본값`
      : '미설정';

  const attendanceSummaryLine = resolvedAbsentMode
    ? '오늘은 등원하지 않아요'
    : attendanceSourceLabel === '미설정'
      ? '아직 출석 정보가 없어요'
      : `${inTime || '--:--'} ~ ${outTime || '--:--'}`;
  const attendanceSummarySubline = resolvedAbsentMode
    ? '수정 버튼에서 다시 출석 일정으로 바꿀 수 있어요.'
    : attendanceSourceLabel === '미설정'
      ? '수정 버튼에서 오늘 일정, 요일별 기본값, 저장한 루틴을 한 번에 관리해요.'
      : hasAwayPlan || (hasSelectedWeekdayTemplate && selectedWeekdayTemplate.awayStartTime && selectedWeekdayTemplate.awayEndTime)
        ? `외출 ${awayStartTime || selectedWeekdayTemplate.awayStartTime} ~ ${awayEndTime || selectedWeekdayTemplate.awayEndTime}${(awayReason || selectedWeekdayTemplate.awayReason).trim() ? ` · ${(awayReason || selectedWeekdayTemplate.awayReason).trim()}` : ''}`
        : '앞 화면에서는 오늘 요약만 보고, 수정은 한 번에 열어서 관리해요.';

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
      const data: any = {
        title: title.trim(),
        done: false,
        weight: category === 'schedule' ? 0 : 1,
        dateKey: selectedDateKey,
        category,
        studyPlanWeekId: weekKey,
        centerId: activeMembership.id,
        studentId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (category === 'schedule' && !title.includes('등원하지 않습니다')) {
        data.title = `${title.trim()}: 09:00 ~ 10:00`;
      } else if (category === 'study') {
        const studyMode = recentStudy?.studyModeValue || newStudyMode;
        const studyMinutes = recentStudy?.minuteValue ?? newStudyMinutes;
        const studyAmount = recentStudy?.amountValue ?? newStudyTargetAmount;
        const studyAmountUnit = recentStudy?.amountUnitValue || newStudyAmountUnit;
        const customUnitLabel = (recentStudy?.customAmountUnitValue ?? newStudyCustomAmountUnit).trim();
        const subjectValue = recentStudy?.subjectValue || newStudySubject;
        const shouldKeepMinutes = recentStudy ? recentStudy.enableVolumeMinutes : enableVolumeStudyMinutes;

        data.subject = subjectValue;
        data.studyPlanMode = studyMode;

        if (studyMode === 'time') {
          data.targetMinutes = Number(studyMinutes) || 0;
        } else {
          data.targetAmount = Number(studyAmount) || 0;
          data.actualAmount = 0;
          data.amountUnit = studyAmountUnit;
          if (studyAmountUnit === '직접입력') {
            data.amountUnitLabel = customUnitLabel || '단위';
          }
          if (shouldKeepMinutes && Number(studyMinutes) > 0) {
            data.targetMinutes = Number(studyMinutes) || 0;
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

  const patchTodayAttendanceDraft = (patch: Partial<AttendanceScheduleDraft>) => {
    if (patch.inTime !== undefined) setInTime(patch.inTime);
    if (patch.outTime !== undefined) setOutTime(patch.outTime);
    if (patch.awayStartTime !== undefined) setAwayStartTime(patch.awayStartTime);
    if (patch.awayEndTime !== undefined) setAwayEndTime(patch.awayEndTime);
    if (patch.awayReason !== undefined) setAwayReason(patch.awayReason);
    if (patch.isAbsent !== undefined) setAttendanceIsAbsent(Boolean(patch.isAbsent));
  };

  const patchWeekdayAttendanceDraft = (patch: Partial<AttendanceScheduleDraft>) => {
    setWeekdayDraft((prev) => ({
      ...prev,
      ...patch,
      isAbsent: patch.isAbsent ?? prev.isAbsent,
    }));
  };

  const buildCurrentAttendanceDraft = useCallback(
    (): AttendanceScheduleDraft => ({
      inTime,
      outTime,
      awayStartTime,
      awayEndTime,
      awayReason,
      isAbsent: attendanceIsAbsent,
    }),
    [inTime, outTime, awayStartTime, awayEndTime, awayReason, attendanceIsAbsent]
  );

  const saveAttendanceSettings = useCallback(
    async (patch: Partial<AttendanceSettingsDoc>) => {
      if (!attendanceSettingsRef) return false;
      await setDoc(attendanceSettingsRef, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
      return true;
    },
    [attendanceSettingsRef]
  );

  const handleApplySelectedWeekdayTemplateToToday = () => {
    if (!hasSelectedWeekdayTemplate) return;
    patchTodayAttendanceDraft(selectedWeekdayTemplate);
    toast({
      title: `${WEEKDAY_OPTIONS.find((option) => option.value === selectedWeekdayTemplateDay)?.label || '이 요일'} 기본값을 불러왔어요.`,
      description: '오늘 입력칸에 기본 출석 스케줄을 채웠어요.',
    });
  };

  const handleCopyTodayAttendanceToWeekday = () => {
    setWeekdayDraft(normalizeAttendanceDraft(buildCurrentAttendanceDraft()));
    toast({
      title: '오늘 입력을 요일 기본값으로 가져왔어요.',
      description: '이 상태에서 저장하면 같은 요일 기본 스케줄로 쓸 수 있어요.',
    });
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
        const trimmedAwayReason = awayReason.trim();
        const shouldSaveAwayPlan = trimmedAwayReason.length > 0 && awayStartTime && awayEndTime;

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
        if (shouldSaveAwayPlan) {
          batch.set(doc(colRef), {
            title: `외출 예정 · ${trimmedAwayReason}: ${awayStartTime} ~ ${awayEndTime}`,
            done: false, weight: 0, dateKey: selectedDateKey, category: 'schedule',
            studyPlanWeekId: weekKey, centerId: activeMembership.id, studentId: user.uid,
            createdAt: serverTimestamp(), updatedAt: serverTimestamp()
          });
        }
      } else {
        batch.set(doc(colRef), {
          title: `이날 등원하지 않습니다`,
          done: false, weight: 0, dateKey: selectedDateKey, category: 'schedule',
          studyPlanWeekId: weekKey, centerId: activeMembership.id, studentId: user.uid,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      if (isToday) {
        await applySameDayRoutinePenalty(type === 'attend' ? '당일 출석 루틴 수정(출석 설정)' : '당일 출석 루틴 수정(미등원 설정)');
        toast({
          title: `당일 루틴 수정으로 벌점 ${SAME_DAY_ROUTINE_PENALTY_POINTS}점 반영`,
          description: '당일 출석 루틴은 수정 가능하지만 벌점이 자동 반영됩니다.',
        });
      }
      toast({
        title: type === 'attend' ? '이 날짜 출석 정보가 저장되었습니다.' : '이 날짜를 미등원으로 저장했습니다.',
        description: type === 'attend' ? '특정 날짜에만 적용되고, 매주 반복 기본값은 그대로 유지됩니다.' : '필요하면 다시 출석 일정으로 바꿀 수 있어요.',
      });
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

  const handleResetAttendanceOverride = async () => {
    if (isPast || !firestore || !user || !activeMembership || !weekKey) return;
    const batch = writeBatch(firestore);
    const colRef = collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items');
    scheduleItems
      .filter((item) => item.title.includes('등원') || item.title.includes('하원') || item.title.includes('등원하지 않습니다') || item.title.includes('외출 예정'))
      .forEach((item) => batch.delete(doc(colRef, item.id)));

    await batch.commit();

    if (isToday) {
      await applySameDayRoutinePenalty('당일 출석 루틴 초기화');
      toast({
        title: `당일 루틴 수정으로 벌점 ${SAME_DAY_ROUTINE_PENALTY_POINTS}점 반영`,
        description: '당일 출석 루틴은 수정 가능하지만 벌점이 자동 반영됩니다.',
      });
    }

    toast({
      title: hasSelectedWeekdayTemplate ? '이 날짜 설정을 지우고 매주 반복 기본값으로 돌아갑니다.' : '이 날짜 설정을 초기화했습니다.',
    });
  };

  const handleSaveWeekdayAttendance = async () => {
    if (isPast) return;
    const nextWeekdayTemplates = {
      ...(attendanceSettings.weekdayTemplates || {}),
      [String(selectedWeekdayTemplateDay)]: normalizeAttendanceDraft(weekdayDraft),
    };

    await saveAttendanceSettings({ weekdayTemplates: nextWeekdayTemplates });
    toast({
      title: `매주 ${WEEKDAY_OPTIONS.find((option) => option.value === selectedWeekdayTemplateDay)?.label || '이 요일'} 반복 출석 정보가 저장되었습니다.`,
      description: '같은 요일 날짜에서는 이 기본값을 바로 불러와 사용할 수 있어요.',
    });
  };

  const handleSaveAttendancePreset = async () => {
    const trimmedName = attendancePresetName.trim();
    if (!trimmedName) {
      toast({ variant: 'destructive', title: '저장할 루틴 이름을 적어주세요.' });
      return;
    }

    const nextPresets: SavedAttendanceRoutine[] = [
      {
        id: `${Date.now()}`,
        name: trimmedName,
        ...normalizeAttendanceDraft(buildCurrentAttendanceDraft()),
      },
      ...savedAttendanceRoutines,
    ].slice(0, 12);

    await saveAttendanceSettings({ savedRoutines: nextPresets });
    setAttendancePresetName('');
    toast({
      title: '출석 루틴으로 저장되었습니다.',
      description: '다음부터는 특정 날짜나 매주 반복값에 바로 복사할 수 있어요.',
    });
  };

  const handleDeleteAttendancePreset = async (presetId: string) => {
    const nextPresets = savedAttendanceRoutines.filter((preset) => preset.id !== presetId);
    await saveAttendanceSettings({ savedRoutines: nextPresets });
    toast({ title: '저장한 루틴을 삭제했어요.' });
  };

  const handleApplyAttendancePresetToToday = (preset: SavedAttendanceRoutine) => {
    patchTodayAttendanceDraft(normalizeAttendanceDraft(preset));
    toast({
      title: `${preset.name} 루틴을 이 날짜에 복사했습니다.`,
      description: '필요한 시간이나 사유만 조금 바꾼 뒤 저장하면 돼요.',
    });
  };

  const handleApplyAttendancePresetToWeekday = (preset: SavedAttendanceRoutine) => {
    setWeekdayDraft(normalizeAttendanceDraft(preset));
    toast({
      title: `${preset.name} 루틴을 매주 ${WEEKDAY_OPTIONS.find((option) => option.value === selectedWeekdayTemplateDay)?.label || '이 요일'} 반복값에 복사했습니다.`,
      description: '필요하면 시간이나 사유를 조금만 바꾼 뒤 저장해보세요.',
    });
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
      const batch = writeBatch(firestore);
      const achievementCount = progress?.dailyLpStatus?.[selectedDateKey]?.achievementCount || 0;
      const existingDayStatus = (progress?.dailyLpStatus?.[selectedDateKey] || {}) as Record<string, any>;
      const rewardLp = calculatePlanCompletionLp(existingDayStatus);
      const nextDayStatus: Record<string, any> = {
        ...existingDayStatus,
        dailyLpAmount: increment(rewardLp),
      };
      if (item.category === 'study') nextDayStatus.plan = true;
      if (item.category === 'schedule') nextDayStatus.routine = true;
      const progressUpdate: Record<string, any> = {
        seasonLp: increment(rewardLp),
        dailyLpStatus: { [selectedDateKey]: nextDayStatus },
        updatedAt: serverTimestamp(),
      };
      if (achievementCount < 5) {
        progressUpdate.stats = { achievement: increment(0.1) };
        progressUpdate.dailyLpStatus[selectedDateKey].achievementCount = increment(1);
      }
      batch.set(progressRef!, progressUpdate, { merge: true });
      await batch.commit();
    }
  };

  const handleCommitStudyActualAmount = async (item: WithId<StudyPlanItem>, nextActualAmount: number) => {
    if (isPast || !firestore || !user || !activeMembership || !isStudent || !weekKey || !selectedDateKey) return;
    const itemRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id);
    const safeActualAmount = Math.max(0, Math.round(nextActualAmount));
    const targetAmount = Math.max(0, item.targetAmount || 0);
    const nextDone = targetAmount > 0 && safeActualAmount >= targetAmount;
    await updateDoc(itemRef, {
      actualAmount: safeActualAmount,
      done: nextDone,
      updatedAt: serverTimestamp(),
    });

    if (nextDone && !item.done && progressRef) {
      const batch = writeBatch(firestore);
      const achievementCount = progress?.dailyLpStatus?.[selectedDateKey]?.achievementCount || 0;
      const existingDayStatus = (progress?.dailyLpStatus?.[selectedDateKey] || {}) as Record<string, any>;
      const rewardLp = calculatePlanCompletionLp(existingDayStatus);
      const nextDayStatus: Record<string, any> = {
        ...existingDayStatus,
        plan: true,
        dailyLpAmount: increment(rewardLp),
      };
      const progressUpdate: Record<string, any> = {
        seasonLp: increment(rewardLp),
        dailyLpStatus: { [selectedDateKey]: nextDayStatus },
        updatedAt: serverTimestamp(),
      };
      if (achievementCount < 5) {
        progressUpdate.stats = { achievement: increment(0.1) };
        progressUpdate.dailyLpStatus[selectedDateKey].achievementCount = increment(1);
      }
      batch.set(progressRef, progressUpdate, { merge: true });
      await batch.commit();
    }
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

  if (!isStudent) {
    return <div className="flex items-center justify-center h-[400px] px-4"><Card className="max-w-md w-full rounded-[2.5rem] border-none shadow-2xl"><CardHeader className="text-center"><CardTitle className="font-black text-2xl tracking-tighter">학생 전용 페이지</CardTitle><CardDescription className="font-bold">학생 계정으로 로그인해야 학습 계획을 관리할 수 있습니다.</CardDescription></CardHeader></Card></div>;
  }

  if (!selectedDate) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

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
            <Badge className={cn("rounded-full font-black gap-2 border-none text-white shadow-lg bg-gradient-to-r", isMobile ? "text-[8px] h-7 px-3" : "text-[10px] h-9 px-4", currentTier.gradient)}>
              {currentTier.name === '챌린저' ? <Crown className={cn(isMobile ? "h-3 w-3" : "h-4 w-4")} /> : <Zap className={cn(isMobile ? "h-3 w-3" : "h-4 w-4")} />} {currentTier.name} 티어 활성
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
                      ? cn("border-transparent shadow-xl scale-105 z-10 text-white bg-gradient-to-br", currentTier.gradient)
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
        <>
          <Card
            className={cn(
              "border-none shadow-2xl overflow-hidden transition-all duration-700 bg-white ring-1 ring-black/[0.03] relative",
              isMobile ? "rounded-[1.25rem]" : "rounded-[2.5rem]"
            )}
          >
            <div className={cn("h-1.5 w-full bg-gradient-to-r", currentTier.gradient)} />
            <CardHeader className={cn("bg-muted/5 border-b", isMobile ? "p-4" : "p-8")}>
              <div className={cn("flex gap-3", isMobile ? "flex-col" : "items-center justify-between")}>
                <div className="min-w-0">
                  <CardTitle className={cn("font-black tracking-tighter flex items-center gap-2 text-primary", isMobile ? "text-base" : "text-2xl")}>
                    <CalendarClock className={cn(isMobile ? "h-5 w-5" : "h-7 w-7")} />
                    {isToday ? '오늘의 출석 정보' : `${selectedDateLabel} 출석 정보`}
                  </CardTitle>
                  <p className={cn("mt-2 break-keep font-semibold text-slate-500", isMobile ? "text-[11px] leading-5" : "text-sm leading-6")}>
                    앞 화면에는 요약만 남기고, 수정은 버튼 한 번으로 한 곳에서 관리해요.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full border border-primary/10 bg-white px-3 py-1 text-[10px] font-black text-primary shadow-sm">
                    {attendanceSourceLabel}
                  </Badge>
                  {isToday ? (
                    <Badge className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-700 shadow-sm">
                      당일 수정 시 벌점 +{SAME_DAY_ROUTINE_PENALTY_POINTS}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className={cn(isMobile ? "p-4" : "p-8")}>
              <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_auto] items-center")}>
                <div className="min-w-0 rounded-[1.5rem] border border-primary/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,250,255,0.95)_100%)] p-4 shadow-[0_18px_44px_-34px_rgba(20,41,95,0.22)]">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "rounded-2xl p-3 text-white shadow-lg",
                        resolvedAbsentMode ? "bg-gradient-to-br from-rose-500 to-rose-700" : cn("bg-gradient-to-br", currentTier.gradient)
                      )}
                    >
                      {resolvedAbsentMode ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className={cn("font-black tracking-tight text-primary break-keep", isMobile ? "text-lg" : "text-2xl")}>
                        {attendanceSummaryLine}
                      </p>
                      <p className={cn("mt-2 break-keep font-semibold text-slate-500", isMobile ? "text-[11px] leading-5" : "text-sm leading-6")}>
                        {attendanceSummarySubline}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  onClick={() => setIsAttendanceSheetOpen(true)}
                  className={cn(
                    "rounded-2xl font-black text-white shadow-xl",
                    isMobile ? "h-11 w-full text-sm" : "h-12 px-6 text-sm",
                    cn("bg-gradient-to-r", currentTier.gradient)
                  )}
                >
                  출석 정보 수정
                </Button>
              </div>
            </CardContent>
          </Card>

          <AttendanceScheduleSheet
            open={isAttendanceSheetOpen}
            onOpenChange={setIsAttendanceSheetOpen}
            isMobile={isMobile}
            isSubmitting={isSubmitting}
            selectedDateLabel={selectedDateLabel}
            isToday={isToday}
            sameDayPenaltyPoints={SAME_DAY_ROUTINE_PENALTY_POINTS}
            weekRangeLabel={weekRangeLabel}
            calendarDays={attendanceCalendarDays}
            onMoveWeek={moveWeek}
            onSelectDate={setSelectedDate}
            todayDraft={buildCurrentAttendanceDraft()}
            onTodayChange={patchTodayAttendanceDraft}
            onSaveToday={() => handleSetAttendance('attend')}
            onSetTodayAbsent={() => handleSetAttendance('absent')}
            onResetToday={handleResetAttendanceOverride}
            hasSelectedWeekdayTemplate={hasSelectedWeekdayTemplate}
            selectedWeekdayLabel={WEEKDAY_OPTIONS.find((option) => option.value === selectedWeekdayTemplateDay)?.label || '이 요일'}
            onApplySelectedWeekdayTemplateToToday={handleApplySelectedWeekdayTemplateToToday}
            selectedWeekday={selectedWeekdayTemplateDay}
            onSelectWeekday={setSelectedWeekdayTemplateDay}
            weekdayOptions={WEEKDAY_OPTIONS}
            weekdayDraft={weekdayDraft}
            onWeekdayChange={patchWeekdayAttendanceDraft}
            onCopyTodayToWeekday={handleCopyTodayAttendanceToWeekday}
            onSaveWeekday={handleSaveWeekdayAttendance}
            presetName={attendancePresetName}
            onPresetNameChange={setAttendancePresetName}
            onSavePreset={handleSaveAttendancePreset}
            savedRoutines={savedAttendanceRoutines}
            onApplyPresetToToday={handleApplyAttendancePresetToToday}
            onApplyPresetToWeekday={handleApplyAttendancePresetToWeekday}
            onDeletePreset={handleDeleteAttendancePreset}
            personalTasks={personalTasks as Array<WithId<StudyPlanItem>>}
            personalTaskDraft={newPersonalTask}
            onPersonalTaskDraftChange={setNewPersonalTask}
            onAddPersonalTask={() => handleAddTask(newPersonalTask, 'personal')}
            onTogglePersonalTask={(task) => handleToggleTask(task)}
            onDeletePersonalTask={(task) => handleDeleteTask(task)}
          />
        </>
      )}

      <Card className={cn("border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white ring-1 ring-black/[0.03]", isMobile && "rounded-[1.5rem]")}>
        <div className={cn("h-1.5 w-full bg-gradient-to-r", currentTier.gradient)} />
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
                    <div className={cn("p-10 text-white relative", `bg-gradient-to-br ${currentTier.gradient}`)}>
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
                    <DialogFooter className={cn("bg-muted/30", isMobile ? "p-5" : "p-8")}><Button onClick={() => handleAddTask(newRoutineTitle, 'schedule')} disabled={!newRoutineTitle.trim() || isSubmitting} className={cn("w-full h-14 rounded-2xl font-black text-lg shadow-xl text-white bg-gradient-to-br", currentTier.gradient)}>{isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : '루틴 생성'}</Button></DialogFooter>
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

