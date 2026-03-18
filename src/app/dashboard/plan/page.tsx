
'use client';

import { useState, useMemo, useEffect } from 'react';
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
  ListTodo,
  Activity,
  PlusCircle,
  CheckCircle2,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  BarChart3,
  BookOpen,
  AlertCircle,
  XCircle,
  CalendarClock,
  Zap,
  Trophy,
  Crown,
  Info,
  Lock
} from 'lucide-react';
import { useCollection, useFirestore, useUser, useDoc } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { 
  collection, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp,
  writeBatch,
  setDoc,
  increment
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

const SUBJECTS = [
  { id: 'kor', label: '국어', color: 'bg-red-500', light: 'bg-red-50', text: 'text-red-600' },
  { id: 'math', label: '수학', color: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600' },
  { id: 'eng', label: '영어', color: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600' },
  { id: 'social', label: '사탐', color: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-600' },
  { id: 'science', label: '과탐', color: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-600' },
  { id: 'history', label: '한국사', color: 'bg-slate-700', light: 'bg-slate-100', text: 'text-slate-700' },
  { id: 'etc', label: '기타', color: 'bg-slate-400', light: 'bg-slate-50', text: 'text-slate-500' },
];

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
    if (isToday || isPast) return;
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
      (isToday || isPast) && "opacity-60 pointer-events-none"
    )}>
      <Select value={p} onValueChange={(v) => handleValueChange(type, 'p', v)} disabled={isToday || isPast}>
        <SelectTrigger className={cn("border-none bg-transparent font-black px-1 focus:ring-0 h-6 shadow-none", isMobile ? "w-[48px] text-[10px]" : "w-[55px] text-xs")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-none shadow-2xl">
          <SelectItem value="오전">오전</SelectItem>
          <SelectItem value="오후">오후</SelectItem>
        </SelectContent>
      </Select>
      <div className="w-px h-2 bg-border/50 mx-0.5" />
      <Select value={h} onValueChange={(v) => handleValueChange(type, 'h', v)} disabled={isToday || isPast}>
        <SelectTrigger className={cn("border-none bg-transparent font-mono font-black px-1 focus:ring-0 h-6 shadow-none", isMobile ? "w-[36px] text-[11px]" : "w-[45px] text-sm")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[200px]">{HOURS.map(hour => <SelectItem key={hour} value={hour}>{hour}</SelectItem>)}</SelectContent>
      </Select>
      <span className="text-[9px] font-black opacity-30 px-0.5">:</span>
      <Select value={m} onValueChange={(v) => handleValueChange(type, 'm', v)} disabled={isToday || isPast}>
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
        {!isPast && !isToday && (
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
        {isToday && <Lock className="h-3 w-3 text-muted-foreground/30" />}
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
  const { activeMembership, viewMode, currentTier } = useAppContext();
  const { toast } = useToast();

  const isMobile = viewMode === 'mobile';
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newStudyTask, setNewStudyTask] = useState('');
  const [newStudySubject, setNewStudySubject] = useState('math');
  const [newStudyMinutes, setNewStudyMinutes] = useState('60');
  const [newPersonalTask, setNewPersonalTask] = useState('');
  const [newRoutineTitle, setNewRoutineTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [isTaskCopyDialogOpen, setIsTaskCopyDialogOpen] = useState(false);
  const [isRoutineCopyDialogOpen, setIsRoutineCopyDialogOpen] = useState(false);
  const [taskCopyWeeks, setTaskCopyWeeks] = useState('4');
  const [routineCopyWeeks, setRoutineCopyWeeks] = useState('4');
  const [taskCopyDays, setTaskCopyDays] = useState<number[]>([]);
  const [routineCopyDays, setRoutineCopyDays] = useState<number[]>([]);

  const [inTime, setInTime] = useState('09:00');
  const [outTime, setOutTime] = useState('22:00');

  useEffect(() => {
    setSelectedDate(new Date());
  }, []);

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

  const moveWeek = (direction: -1 | 1) => {
    if (!selectedDate) return;
    setSelectedDate(addDays(selectedDate, direction * 7));
  };

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

  const scheduleItems = useMemo(() => dailyPlans?.filter(p => p.category === 'schedule') || [], [dailyPlans]);
  const personalTasks = useMemo(() => dailyPlans?.filter(p => p.category === 'personal') || [], [dailyPlans]);
  const studyTasks = useMemo(() => dailyPlans?.filter(p => p.category === 'study' || !p.category) || [], [dailyPlans]);
  const hasCopyableTasks = useMemo(() => dailyPlans?.some(p => p.category !== 'schedule') ?? false, [dailyPlans]);
  const hasCopyableRoutines = useMemo(() => dailyPlans?.some(p => p.category === 'schedule') ?? false, [dailyPlans]);

  const hasInPlan = useMemo(() => scheduleItems.some(i => i.title.includes('등원 예정')), [scheduleItems]);
  const hasOutPlan = useMemo(() => scheduleItems.some(i => i.title.includes('하원 예정')), [scheduleItems]);
  const isAbsentMode = useMemo(() => scheduleItems.some(i => i.title.includes('등원하지 않습니다')), [scheduleItems]);

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

  const to24h = (time12h: string, period: '오전' | '오후') => {
    if (!time12h || !time12h.includes(':')) return time12h;
    let [hours, mins] = time12h.split(':').map(Number);
    if (isNaN(hours) || isNaN(mins)) return time12h;
    if (period === '오후' && hours < 12) hours += 12;
    if (period === '오전' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const handleAddTask = async (title: string, category: 'study' | 'personal' | 'schedule') => {
    if (isPast || !firestore || !user || !activeMembership || !title.trim() || !isStudent || !weekKey || !selectedDateKey) return;
    
    // 당일 루틴 수정 금지 정책
    if (category === 'schedule' && isToday) {
      toast({ variant: "destructive", title: "수정 불가", description: "당일 루틴은 변경할 수 없습니다. 항상 미리 설정해 주세요." });
      return;
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
        data.subject = newStudySubject;
        data.targetMinutes = Number(newStudyMinutes) || 0;
      }

      await addDoc(itemsCollectionRef, data);
      
      if (category === 'study') {
        setNewStudyTask('');
      } else if (category === 'personal') {
        setNewPersonalTask('');
      } else {
        setNewRoutineTitle('');
        setIsRoutineModalOpen(false);
      }
    } catch (error) {
      console.error("Error adding task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetAttendance = async (type: 'attend' | 'absent') => {
    if (isPast || isToday || !firestore || !user || !activeMembership || !weekKey || !selectedDateKey) {
      if (isToday) toast({ variant: "destructive", title: "설정 불가", description: "오늘 출석 계획은 변경할 수 없습니다." });
      return;
    }
    setIsSubmitting(true);
    
    const batch = writeBatch(firestore);
    const colRef = collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items');

    try {
      scheduleItems.filter(i => i.title.includes('등원') || i.title.includes('하원')).forEach(i => {
        batch.delete(doc(colRef, i.id));
      });

      if (type === 'attend') {
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
      } else {
        batch.set(doc(colRef), {
          title: `이날 등원하지 않습니다`,
          done: false, weight: 0, dateKey: selectedDateKey, category: 'schedule',
          studyPlanWeekId: weekKey, centerId: activeMembership.id, studentId: user.uid,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      toast({ title: type === 'attend' ? "출석 일정이 등록되었습니다." : "미등원 처리가 완료되었습니다." });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateScheduleRange = async (itemId: string, baseTitle: string, start: {h: string, m: string, p: '오전' | '오후'}, end: {h: string, m: string, p: '오전' | '오후'}) => {
    if (isPast || isToday || !firestore || !user || !activeMembership || !weekKey) return;
    const formattedStart = to24h(`${start.h}:${start.m}`, start.p);
    const formattedEnd = to24h(`${end.h}:${end.m}`, end.p);
    const rangeStr = `${formattedStart} ~ ${formattedEnd}`;
    const docRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', itemId);
    await updateDoc(docRef, { title: `${baseTitle}: ${rangeStr}`, updatedAt: serverTimestamp() });
  };

  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (isPast || !firestore || !user || !activeMembership || !isStudent || !weekKey || !selectedDateKey) return;
    const itemRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id);
    const nextState = !item.done;
    
    await updateDoc(itemRef, { done: nextState, updatedAt: serverTimestamp() });
    
    if (nextState) {
      const batch = writeBatch(firestore);
      const achievementCount = progress?.dailyLpStatus?.[selectedDateKey]?.achievementCount || 0;
      const existingDayStatus = (progress?.dailyLpStatus?.[selectedDateKey] || {}) as Record<string, any>;
      const progressUpdate: Record<string, any> = {
        seasonLp: increment(10),
        dailyLpStatus: {
          [selectedDateKey]: {
            ...existingDayStatus,
            dailyLpAmount: increment(10),
          },
        },
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

  const handleDeleteTask = async (item: WithId<StudyPlanItem>) => {
    if (isPast || !firestore || !user || !activeMembership || !isStudent || !weekKey) return;
    
    // 당일 루틴 삭제 금지 정책
    if (item.category === 'schedule' && isToday) {
      toast({ variant: "destructive", title: "삭제 불가", description: "오늘의 루틴은 삭제할 수 없습니다." });
      return;
    }

    await deleteDoc(doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id));
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
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
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
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
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

  const copyPlansWithOptions = async (
    kind: 'task' | 'routine',
    options: { weeks: number; weekdays: number[] }
  ) => {
    if (isPast || !selectedDate || !firestore || !user || !activeMembership || !dailyPlans || dailyPlans.length === 0) return false;

    const sourcePlans = kind === 'task'
      ? dailyPlans.filter(p => p.category !== 'schedule')
      : dailyPlans.filter(p => p.category === 'schedule');

    if (sourcePlans.length === 0) {
      toast({
        variant: 'destructive',
        title: kind === 'task' ? '복사할 학습/개인 계획이 없습니다.' : '복사할 생활 루틴이 없습니다.',
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
    });
    if (copied) setIsTaskCopyDialogOpen(false);
  };

  const handleApplyRoutineToAllWeekdays = async () => {
    const copied = await copyPlansWithOptions('routine', {
      weeks: Number(routineCopyWeeks),
      weekdays: routineCopyDays,
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
        <Card className={cn(
          "border-none shadow-2xl overflow-hidden transition-all duration-700 bg-white ring-1 ring-black/[0.03]",
          "relative group",
          isMobile ? "rounded-[1.25rem]" : "rounded-[2.5rem]",
          isToday && "opacity-80"
        )}>
          <div className={cn("h-1.5 w-full bg-gradient-to-r", currentTier.gradient)} />
          <CardHeader className={cn("bg-muted/5 border-b", isMobile ? "p-4" : "p-8")}>
            <div className="flex items-center justify-between">
              <CardTitle className={cn("font-black tracking-tighter flex items-center gap-2", isMobile ? "text-base" : "text-2xl")}>
                <CalendarClock className={cn("text-primary", isMobile ? "h-5 w-5" : "h-7 w-7")} /> {isToday ? '오늘의 출석 정보 (수정 불가)' : '출석 설정'}
              </CardTitle>
              {isToday ? <Lock className="h-4 w-4 text-muted-foreground/40" /> : <Badge className={cn("bg-white text-primary border-none font-black text-[8px] uppercase tracking-widest px-2 py-0.5 shadow-sm")}>1단계</Badge>}
            </div>
          </CardHeader>
          <CardContent className={cn(isMobile ? "p-4" : "p-8 sm:p-10")}>
            {(!hasInPlan || !hasOutPlan) && !isAbsentMode ? (
              <div className={isMobile ? "space-y-6" : "flex flex-col gap-10"}>
                <div className={cn("grid gap-4 sm:gap-8", isMobile ? "grid-cols-1" : "md:grid-cols-2")}>
                  <div className={isMobile ? "space-y-3" : "space-y-4"}>
                    <div className="flex items-center gap-2 ml-1">
                      <Zap className={cn("text-amber-500 fill-amber-500", isMobile ? "h-3 w-3" : "h-4 w-4")} />
                      <Label className={cn("font-black text-primary uppercase tracking-widest", isMobile ? "text-[9px]" : "text-xs")}>등원 계획</Label>
                    </div>
                    <div className={cn("flex items-center gap-2 sm:gap-3", isMobile ? "flex-col" : "flex-row")}>
                      <div className="flex-1 grid grid-cols-2 gap-1 sm:gap-2 w-full">
                        <div className="space-y-1">
                          <span className={cn("font-black opacity-40 ml-1", isMobile ? "text-[7px]" : "text-[10px]")}>등원 예정</span>
                          <Input type="time" value={inTime} onChange={e => setInTime(e.target.value)} disabled={isToday} className={cn("rounded-xl border-2 font-black shadow-inner focus-visible:ring-primary/20", isMobile ? "h-9 text-xs px-2" : "h-14 text-xl")} />
                        </div>
                        <div className="space-y-1">
                          <span className={cn("font-black opacity-40 ml-1", isMobile ? "text-[7px]" : "text-[10px]")}>하원 예정</span>
                          <Input type="time" value={outTime} onChange={e => setOutTime(e.target.value)} disabled={isToday} className={cn("rounded-xl border-2 font-black shadow-inner focus-visible:ring-primary/20", isMobile ? "h-9 text-xs px-2" : "h-14 text-xl")} />
                        </div>
                      </div>
                      <Button onClick={() => handleSetAttendance('attend')} disabled={isSubmitting || isToday} className={cn("rounded-xl font-black shadow-xl active:scale-95 transition-all text-white bg-gradient-to-br", isMobile ? "w-full h-10 text-xs" : "h-14 px-10 mt-6 text-lg", currentTier.gradient)}>설정 완료</Button>
                    </div>
                  </div>
                  
                  <div className={cn("flex flex-col justify-center items-center", isMobile ? "border-t border-dashed pt-4" : "border-l border-dashed pl-8")}>
                    <p className={cn("font-bold text-muted-foreground mb-3", isMobile ? "text-[10px]" : "text-xs")}>오늘은 공부를 쉬어갑니다.</p>
                    <Button variant="outline" onClick={() => handleSetAttendance('absent')} disabled={isSubmitting || isToday} className={cn("w-full rounded-xl border-2 border-rose-200 text-rose-600 font-black hover:bg-rose-50 gap-2 transition-all active:scale-95", isMobile ? "h-11 text-sm" : "h-14 text-lg")}>
                      <XCircle className={cn(isMobile ? "h-4 w-4" : "h-6 w-6")} /> 이날 등원하지 않습니다
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className={cn("flex items-center justify-between rounded-[1.5rem] bg-[#fafafa] border-2 border-transparent shadow-inner relative group overflow-hidden", isMobile ? "p-4 gap-3" : "p-8")}>
                <div className={cn("absolute inset-0 opacity-[0.03] pointer-events-none bg-gradient-to-br", currentTier.gradient)} />
                <div className={cn("flex items-center gap-4 relative z-10", isMobile ? "flex-row text-left" : "flex-row")}>
                  <div className={cn("p-2.5 rounded-2xl shadow-lg text-white bg-gradient-to-br", isAbsentMode ? "from-rose-500 to-rose-700" : currentTier.gradient)}>
                    {isAbsentMode ? <XCircle className={cn(isMobile ? "h-5 w-5" : "h-8 w-8")} /> : <CheckCircle2 className={cn(isMobile ? "h-5 w-5" : "h-8 w-8")} />}
                  </div>
                  <div className="grid">
                    <span className={cn("font-black tracking-tighter text-primary", isMobile ? "text-sm" : "text-2xl")}>{isAbsentMode ? '오늘 휴무' : '출석 설정 완료'}</span>
                    {!isAbsentMode && <span className={cn("font-bold text-muted-foreground", isMobile ? "text-[10px]" : "text-sm")}>{inTime} ~ {outTime}</span>}
                  </div>
                </div>
                {!isToday && (
                  <button onClick={() => {
                    const batch = writeBatch(firestore!);
                    const colRef = collection(firestore!, 'centers', activeMembership!.id, 'plans', user!.uid, 'weeks', weekKey, 'items');
                    scheduleItems.filter(i => i.title.includes('등원') || i.title.includes('하원') || i.title.includes('등원하지 않습니다')).forEach(i => batch.delete(doc(colRef, i.id)));
                    batch.commit().then(() => toast({ title: "설정을 재설정합니다." }));
                  }} className={cn("font-black uppercase text-muted-foreground underline underline-offset-4 hover:text-primary transition-all relative z-10", isMobile ? "text-[8px]" : "text-[10px]")}>재설정</button>
                )}
                {isToday && <Lock className="h-4 w-4 text-muted-foreground/20" />}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className={cn("border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white ring-1 ring-black/[0.03] group hover:shadow-2xl transition-all duration-500", isMobile ? "rounded-[1.5rem]" : "")}>
        <div className={cn("h-1.5 w-full bg-gradient-to-r opacity-30", currentTier.gradient)} />
        <CardHeader className={cn(isMobile ? "p-4 pb-1" : "p-8 pb-4")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-primary/5 p-1.5 rounded-lg"><BarChart3 className={cn("text-primary", isMobile ? "h-4 w-4" : "h-5 w-5")} /></div>
              <CardTitle className={cn("font-black uppercase tracking-widest text-primary/60", isMobile ? "text-[8px]" : "text-sm")}>학습 균형 매트릭스</CardTitle>
            </div>
            {isToday && <Badge variant="outline" className="text-[8px] font-black border-dashed">오늘 계획 잠금</Badge>}
          </div>
        </CardHeader>
        <CardContent className={cn(isMobile ? "p-4 pt-1" : "p-8 pt-2")}>
          <div className={cn("flex flex-col", isMobile ? "gap-4" : "gap-8")}>
            <div className="flex items-baseline gap-2">
              <span className={cn("font-black tracking-tighter drop-shadow-sm text-primary", isMobile ? "text-3xl" : "text-6xl")}>
                {Math.floor(studyTimeSummary.total / 60)}<span className={cn("opacity-40 ml-0.5", isMobile ? "text-xs" : "text-xl")}>시간</span> {studyTimeSummary.total % 60}<span className={cn("opacity-40 ml-0.5", isMobile ? "text-xs" : "text-xl")}>분</span>
              </span>
              <span className={cn("font-bold text-muted-foreground uppercase tracking-widest opacity-60", isMobile ? "text-[7px]" : "text-[10px]")}>목표 학습량</span>
            </div>
            
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {SUBJECTS.map(subj => {
                const plannedTime = studyTimeSummary.breakdown[subj.id] || 0;
                if (plannedTime === 0) return null;
                return (
                  <div key={subj.id} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 transition-all shadow-sm", subj.light, subj.text, "border-transparent")}>
                    <div className={cn("w-1.5 h-1.5 rounded-full shadow-sm", subj.color)} />
                    <span className={cn("font-black tracking-tight", isMobile ? "text-[9px]" : "text-[11px]")}>{subj.label} {Math.floor(plannedTime / 60)}시간 {plannedTime % 60}분</span>
                  </div>
                );
              })}
              {studyTimeSummary.total === 0 && (
                <div className={cn("py-3 px-4 rounded-xl bg-muted/20 border-2 border-dashed border-muted-foreground/10 flex items-center gap-2 text-muted-foreground/40 italic font-bold w-full", isMobile ? "text-[9px]" : "text-[11px]")}>
                  <Info className="h-3.5 w-3.5" /> 학습 계획을 추가하여 시간 배분을 분석하세요.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
                      return (
                        <div key={task.id} className={cn("flex items-start gap-4 p-4 rounded-[1.5rem] border-2 transition-all group", task.done ? "bg-emerald-50/30 border-emerald-100/50" : "bg-white border-transparent shadow-sm hover:shadow-md", isMobile ? "p-4" : "p-6 rounded-[2rem]")}>
                          <Checkbox id={task.id} checked={task.done} onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} disabled={isPast} className={cn("rounded-xl border-2 mt-1", isMobile ? "h-6 w-6" : "h-7 w-7")} />
                          <div className="flex-1 grid gap-1">
                            <div className="flex items-center gap-2">
                              <Badge className={cn("rounded-md font-black text-[8px] px-1.5 py-0 border-none shadow-sm", subj?.color, "text-white")}>{subj?.label}</Badge>
                              {task.targetMinutes && <span className={cn("font-black text-muted-foreground/40 uppercase tracking-widest flex items-center gap-1", isMobile ? "text-[8px]" : "text-[10px]")}><Clock className="h-2.5 w-2.5" /> {task.targetMinutes}분 목표</span>}
                            </div>
                            <Label htmlFor={task.id} className={cn("font-black tracking-tight transition-all leading-snug break-keep", isMobile ? "text-sm" : "text-lg", task.done && "line-through text-muted-foreground/40 italic")}>{task.title}</Label>
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
                          <Button size="icon" onClick={() => handleAddTask(newStudyTask, 'study')} disabled={isSubmitting || !newStudyTask.trim()} className={cn("rounded-lg shrink-0 shadow-lg bg-emerald-500 hover:bg-emerald-600 text-white relative z-10", isMobile ? "h-10 w-10" : "h-8 w-8")}><Plus className="h-4 w-4" /></Button>
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
                        <Button variant="outline" size="icon" onClick={() => handleAddTask(newPersonalTask, 'personal')} disabled={isSubmitting || !newPersonalTask.trim()} className={cn("rounded-lg shrink-0 shadow-lg border-2 border-amber-500 text-amber-600 relative z-10", isMobile ? "h-10 w-10" : "h-8 w-8")}><Plus className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </CardContent>
              <div className={cn("bg-muted/10 border-t flex flex-col sm:flex-row items-center justify-between gap-4", isMobile ? "p-4" : "p-8")}>
                <div className="flex items-center gap-2 bg-white/80 px-4 py-2 rounded-xl border shadow-sm w-full sm:w-auto justify-center">
                  <CalendarCheck className="h-3.5 w-3.5 text-primary" />
                  <p className={cn("font-black text-primary/70 uppercase tracking-widest", isMobile ? "text-[9px]" : "text-[11px]")}>{format(selectedDate, 'yyyy. MM. dd', { locale: ko })}</p>
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
              {!isPast && !isToday && (
                <Dialog open={isRoutineModalOpen} onOpenChange={setIsRoutineModalOpen}>
                  <DialogTrigger asChild><Button variant="ghost" size="icon" className={cn("rounded-full hover:bg-primary/10 transition-all", isMobile ? "h-8 w-8" : "h-10 w-10")}><PlusCircle className={cn(isMobile ? "h-5 w-5" : "h-6 w-6")} /></Button></DialogTrigger>
                  <DialogContent className={cn("rounded-[2.5rem] border-none shadow-2xl p-8", isMobile ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-[380px] rounded-[2rem]" : "sm:max-w-md")}>
                    <div className={cn("p-10 text-white relative", `bg-gradient-to-br ${currentTier.gradient}`)}>
                      <Sparkles className="absolute top-0 right-0 p-10 h-40 w-40 opacity-10 rotate-12" />
                      <DialogHeader><DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-xl" : "text-2xl")}>새 루틴 추가</DialogTitle></DialogHeader>
                    </div>
                    <div className="space-y-6 p-8 bg-white">
                      <Input placeholder="예: 영어 학원, 점심 시간" value={newRoutineTitle} onChange={(e) => setNewRoutineTitle(e.target.value)} className="h-14 rounded-2xl border-2 font-bold text-base" />
                      <div className="flex flex-wrap gap-2">{['점심', '저녁', '학원', '독서실'].map(tag => <Badge key={tag} variant="secondary" className="cursor-pointer hover:bg-primary hover:text-white py-1.5 px-4 rounded-xl font-black text-xs" onClick={() => setNewRoutineTitle(tag)}>+{tag}</Badge>)}</div>
                    </div>
                    <DialogFooter className="p-8 bg-muted/30"><Button onClick={() => handleAddTask(newRoutineTitle, 'schedule')} disabled={!newRoutineTitle.trim() || isSubmitting} className={cn("w-full h-14 rounded-2xl font-black text-lg shadow-xl text-white bg-gradient-to-br", currentTier.gradient)}>{isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : '루틴 생성'}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
              {isToday && <Lock className="h-4 w-4 text-muted-foreground/30" />}
            </div>
          </CardHeader>
          <CardContent className={cn("bg-[#fafafa] flex flex-col gap-3", isMobile ? "p-4" : "p-8")}>
            {isToday && (
              <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 flex items-start gap-3 mb-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                <p className="text-[10px] font-bold text-amber-900 leading-relaxed">오늘의 루틴은 변경할 수 없습니다. 내일 이후의 계획을 미리 세워주세요.</p>
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
