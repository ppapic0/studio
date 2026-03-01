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
  ChevronRight,
  CircleDot
} from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
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
import { type StudyPlanItem, type WithId } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

function ScheduleItemRow({ item, onUpdateRange, onDelete, isPast, isMobile }: any) {
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
      end: from24h(parts[1] || parts[0]) // 종료시간 없으면 시작시간과 동일하게 초기화
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
    <div className="flex items-center bg-muted/20 p-0.5 rounded-lg border border-border/30">
      <Select value={p} onValueChange={(v) => handleValueChange(type, 'p', v)}>
        <SelectTrigger className={cn("border-none bg-transparent font-black px-1 focus:ring-0 h-6 shadow-none", isMobile ? "w-[42px] text-[9px]" : "w-[55px] text-xs")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-none shadow-2xl">
          <SelectItem value="오전">오전</SelectItem>
          <SelectItem value="오후">오후</SelectItem>
        </SelectContent>
      </Select>
      <div className="w-px h-2 bg-border/50 mx-0.5" />
      <Select value={h} onValueChange={(v) => handleValueChange(type, 'h', v)}>
        <SelectTrigger className={cn("border-none bg-transparent font-mono font-black px-1 focus:ring-0 h-6 shadow-none", isMobile ? "w-[30px] text-[10px]" : "w-[45px] text-sm")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[200px]">{HOURS.map(hour => <SelectItem key={hour} value={hour}>{hour}</SelectItem>)}</SelectContent>
      </Select>
      <span className="text-[9px] font-black opacity-30 px-0.5">:</span>
      <Select value={m} onValueChange={(v) => handleValueChange(type, 'm', v)}>
        <SelectTrigger className={cn("border-none bg-transparent font-mono font-black px-1 focus:ring-0 h-6 shadow-none", isMobile ? "w-[30px] text-[10px]" : "w-[45px] text-sm")}>
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
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all" onClick={() => onDelete(item)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
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

  const isMobile = viewMode === 'mobile';
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newStudyTask, setNewStudyTask] = useState('');
  const [newPersonalTask, setNewPersonalTask] = useState('');
  const [newRoutineTitle, setNewRoutineTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);

  useEffect(() => {
    setSelectedDate(new Date());
  }, []);

  const isStudent = activeMembership?.role === 'student';
  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const weekKey = selectedDate ? format(selectedDate, "yyyy-'W'II") : '';

  const isPast = selectedDate ? isBefore(startOfDay(selectedDate), startOfDay(new Date())) : false;

  const weekDays = useMemo(() => {
    if (!selectedDate) return [];
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return [...Array(7)].map((_, i) => addDays(start, i));
  }, [selectedDate]);

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

  const scheduleItems = useMemo(() => dailyPlans?.filter(p => p.category === 'schedule') || [], [dailyPlans]);
  const personalTasks = useMemo(() => dailyPlans?.filter(p => p.category === 'personal') || [], [dailyPlans]);
  const studyTasks = useMemo(() => dailyPlans?.filter(p => p.category === 'study' || !p.category) || [], [dailyPlans]);

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
      const finalTitle = category === 'schedule' ? `${title.trim()}: 09:00 ~ 10:00` : title.trim();
      await addDoc(itemsCollectionRef, {
        title: finalTitle,
        done: false,
        weight: category === 'schedule' ? 0 : 1,
        dateKey: selectedDateKey,
        category,
        studyPlanWeekId: weekKey,
        centerId: activeMembership.id,
        studentId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (category === 'study') setNewStudyTask('');
      else if (category === 'personal') setNewPersonalTask('');
      else {
        setNewRoutineTitle('');
        setIsRoutineModalOpen(false);
      }
    } catch (error) {
      console.error("Error adding task:", error);
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
  };

  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (isPast || !firestore || !user || !activeMembership || !isStudent || !weekKey) return;
    const itemRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id);
    updateDoc(itemRef, { done: !item.done, updatedAt: serverTimestamp() });
    if (!item.done) {
      const progressRef = doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
      setDoc(progressRef, { stats: { achievement: increment(0.05) }, currentXp: increment(10), updatedAt: serverTimestamp() }, { merge: true });
    }
  };

  const handleDeleteTask = async (item: WithId<StudyPlanItem>) => {
    if (isPast || !firestore || !user || !activeMembership || !isStudent || !weekKey) return;
    await deleteDoc(doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id));
  };

  const handleApplyToAllWeekdays = async () => {
    if (isPast || !selectedDate || !firestore || !user || !activeMembership || !dailyPlans || dailyPlans.length === 0) return;
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
        dailyPlans.forEach(plan => {
          batch.set(doc(itemsCollectionRef), {
            title: plan.title, done: false, weight: plan.weight, dateKey: targetDateKey, category: plan.category || 'study',
            studyPlanWeekId: targetWeekKey, centerId: activeMembership.id, studentId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
        });
      }
      await batch.commit();
      toast({ title: "일정 복사 완료", description: `이번 달의 남은 ${format(selectedDate, 'EEEE', { locale: ko })}에 계획이 복사되었습니다.` });
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  if (!isStudent) {
    return <div className="flex items-center justify-center h-[400px] px-4"><Card className="max-w-md w-full rounded-[2.5rem] border-none shadow-2xl"><CardHeader className="text-center"><CardTitle className="font-black text-2xl tracking-tighter">학생 전용 페이지</CardTitle><CardDescription className="font-bold">학생 계정으로 로그인해야 학습 계획을 관리할 수 있습니다.</CardDescription></CardHeader></Card></div>;
  }

  if (!selectedDate) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className={cn("flex flex-col w-full max-w-5xl mx-auto pb-24", isMobile ? "gap-5 px-0" : "gap-10")}>
      <header className={cn("flex flex-col", isMobile ? "gap-1 px-1" : "gap-2")}>
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className={cn("font-black tracking-tighter text-primary leading-none", isMobile ? "text-2xl" : "text-4xl")}>나의 학습 계획</h1>
            <p className={cn("font-bold text-muted-foreground mt-1.5", isMobile ? "text-[10px] uppercase tracking-[0.2em]" : "text-sm")}>
              {isPast ? 'Archive View' : 'Daily Study Matrix & Routine'}
            </p>
          </div>
          {isPast && <Badge variant="destructive" className="rounded-full font-black text-[10px] px-3 py-1 shadow-lg">History Mode</Badge>}
        </div>
      </header>

      <div className={cn("grid grid-cols-7 gap-1.5 sm:gap-4", isMobile ? "px-0" : "px-0")}>
        {weekDays.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          return (
            <Button
              key={day.toISOString()}
              variant={isSelected ? "default" : "outline"}
              className={cn(
                "flex flex-col transition-all duration-500 rounded-[1.25rem] sm:rounded-[2.5rem] border-2 h-auto py-3.5 sm:py-4",
                isMobile ? "px-0" : "px-4",
                isSelected ? "bg-primary border-primary shadow-lg scale-105 z-10" : "bg-white border-transparent hover:border-primary/20",
                isToday && !isSelected && "border-primary/30"
              )}
              onClick={() => setSelectedDate(day)}
            >
              <span className={cn("font-black uppercase tracking-widest leading-none", isMobile ? "text-[8px] mb-1.5" : "text-[10px] mb-2", isSelected ? "text-white/60" : "text-muted-foreground/40")}>{format(day, 'EEE', { locale: ko })}</span>
              <span className={cn("font-black tracking-tighter tabular-nums leading-none", isMobile ? "text-lg" : "text-2xl", isSelected ? "text-white" : "text-primary")}>{format(day, 'd')}</span>
            </Button>
          );
        })}
      </div>

      <div className={cn("grid gap-6 items-start", isMobile ? "grid-cols-1 px-0" : "md:grid-cols-12")}>
        {/* 생활 루틴 */}
        <Card className={cn("border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white ring-1 ring-black/[0.02] mx-auto w-full", isMobile ? "md:col-span-12" : "md:col-span-5")}>
          <CardHeader className={cn("bg-muted/5 border-b", isMobile ? "p-6" : "p-8")}>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className={cn("flex items-center gap-2 font-black tracking-tighter text-primary", isMobile ? "text-xl" : "text-2xl")}>
                  <div className="bg-primary/5 p-1.5 rounded-lg"><Clock className="h-5 w-5 text-primary" /></div>
                  생활 루틴
                </CardTitle>
              </div>
              {!isPast && (
                <Dialog open={isRoutineModalOpen} onOpenChange={setIsRoutineModalOpen}>
                  <DialogTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-primary/10 transition-all"><PlusCircle className="h-6 w-6" /></Button></DialogTrigger>
                  <DialogContent className={cn("rounded-[2.5rem] border-none shadow-2xl p-8", isMobile ? "max-w-[90vw]" : "sm:max-w-md")}>
                    <DialogHeader><DialogTitle className="text-2xl font-black tracking-tighter">새 루틴 추가</DialogTitle></DialogHeader>
                    <div className="space-y-6 pt-4">
                      <Input placeholder="예: 영어 학원, 점심 시간" value={newRoutineTitle} onChange={(e) => setNewRoutineTitle(e.target.value)} className="h-14 rounded-2xl border-2 font-bold text-base" />
                      <div className="flex flex-wrap gap-2">{['점심', '저녁', '학원', '독서실'].map(tag => <Badge key={tag} variant="secondary" className="cursor-pointer hover:bg-primary hover:text-white py-1.5 px-4 rounded-xl font-black text-xs" onClick={() => setNewRoutineTitle(tag)}>+{tag}</Badge>)}</div>
                    </div>
                    <DialogFooter className="pt-6"><Button onClick={() => handleAddTask(newRoutineTitle, 'schedule')} disabled={!newRoutineTitle.trim() || isSubmitting} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">{isSubmitting ? <Loader2 className="animate-spin h-6 w-6" /> : '루틴 생성'}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent className={cn("bg-[#fafafa] flex flex-col gap-4", isMobile ? "p-5" : "p-8")}>
            {isLoading ? <div className="py-16 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div> : scheduleItems.length === 0 ? <div className="py-16 text-center opacity-20 italic font-black text-sm">등록된 루틴이 없습니다.</div> :
              scheduleItems.sort((a,b) => (a.title.split(': ')[1] || '00:00').localeCompare(b.title.split(': ')[1] || '00:00')).map((item) => (
                <ScheduleItemRow key={item.id} item={item} onUpdateRange={handleUpdateScheduleRange} onDelete={handleDeleteTask} isPast={isPast} isMobile={isMobile} />
              ))
            }
          </CardContent>
        </Card>

        {/* 학습 & 개인 일정 */}
        <div className={cn("w-full mx-auto", isMobile ? "md:col-span-12" : "md:col-span-7")}>
          <Tabs defaultValue="study" className="w-full">
            <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.02]">
              <CardHeader className="p-0 border-b bg-muted/5">
                <TabsList className="w-full justify-start rounded-none bg-transparent h-16 p-0 gap-0">
                  <TabsTrigger value="study" className="flex-1 h-full data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 font-black text-xs sm:text-sm uppercase">학습 To-do</TabsTrigger>
                  <TabsTrigger value="personal" className="flex-1 h-full data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 font-black text-xs sm:text-sm uppercase">개인 일정</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className={cn("bg-[#fafafa]", isMobile ? "p-5" : "p-8")}>
                <TabsContent value="study" className="mt-0 space-y-4">
                  <div className="grid gap-3">
                    {studyTasks.map((task) => (
                      <div key={task.id} className={cn("flex items-center gap-4 p-5 rounded-[1.5rem] border-2 transition-all group", task.done ? "bg-emerald-50/30 border-emerald-100/50" : "bg-white border-transparent shadow-sm")}>
                        <Checkbox id={task.id} checked={task.done} onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} disabled={isPast} className="h-6 w-6 rounded-lg border-2 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" />
                        <Label htmlFor={task.id} className={cn("flex-1 font-bold text-sm sm:text-base leading-tight transition-all", task.done && "line-through text-muted-foreground/40 italic")}>{task.title}</Label>
                        {!isPast && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    ))}
                    {!isPast && (
                      <div className="relative flex items-center bg-white border-2 border-emerald-100 rounded-2xl p-1.5 shadow-sm mt-2">
                        <Input placeholder="오늘 할 공부 추가..." value={newStudyTask} onChange={(e) => setNewStudyTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newStudyTask, 'study')} disabled={isSubmitting} className="border-none bg-transparent shadow-none focus-visible:ring-0 font-bold h-11 text-sm sm:text-base" />
                        <Button size="icon" onClick={() => handleAddTask(newStudyTask, 'study')} disabled={isSubmitting || !newStudyTask.trim()} className="rounded-xl h-10 w-10 bg-emerald-500 hover:bg-emerald-600 text-white shrink-0 shadow-lg"><Plus className="h-5 w-5" /></Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="personal" className="mt-0 space-y-4">
                  <div className="grid gap-3">
                    {personalTasks.map((task) => (
                      <div key={task.id} className={cn("flex items-center gap-4 p-5 rounded-[1.5rem] border-2 transition-all group", task.done ? "bg-amber-50/30 border-amber-100/50" : "bg-white border-transparent shadow-sm")}>
                        <Checkbox id={task.id} checked={task.done} onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} disabled={isPast} className="h-6 w-6 rounded-lg border-2 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500" />
                        <Label htmlFor={task.id} className={cn("flex-1 font-bold text-sm sm:text-base leading-tight transition-all", task.done && "line-through text-muted-foreground/40 italic")}>{task.title}</Label>
                        {!isPast && <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    ))}
                    {!isPast && (
                      <div className="relative flex items-center bg-white border-2 border-amber-100 rounded-2xl p-1.5 shadow-sm mt-2">
                        <Input placeholder="개인 일정 추가..." value={newPersonalTask} onChange={(e) => setNewPersonalTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newPersonalTask, 'personal')} disabled={isSubmitting} className="border-none bg-transparent shadow-none focus-visible:ring-0 font-bold h-11 text-sm sm:text-base" />
                        <Button variant="outline" size="icon" onClick={() => handleAddTask(newPersonalTask, 'personal')} disabled={isSubmitting || !newPersonalTask.trim()} className="rounded-xl h-10 w-10 border-2 border-amber-500 text-amber-600 shrink-0 shadow-lg"><Plus className="h-5 w-5" /></Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </CardContent>
              <div className={cn("bg-muted/10 border-t flex flex-col sm:flex-row items-center justify-between gap-5", isMobile ? "p-6" : "p-8")}>
                <div className="flex items-center gap-2.5 bg-white/80 px-5 py-2.5 rounded-[1.25rem] border shadow-sm w-full sm:w-auto justify-center">
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  <p className="text-[11px] font-black text-primary/70 uppercase tracking-widest">{format(selectedDate, 'yyyy. MM. dd', { locale: ko })}</p>
                </div>
                {!isPast && (
                  <Button variant="outline" size="sm" className="rounded-[1.25rem] gap-2 text-[11px] font-black h-11 px-6 border-2 shadow-sm w-full sm:w-auto bg-white" onClick={handleApplyToAllWeekdays} disabled={isSubmitting || !dailyPlans?.length}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Copy className="h-4 w-4" />} 이 요일 반복 복사
                  </Button>
                )}
              </div>
            </Card>
          </Tabs>
        </div>
      </div>
      
      <footer className="px-4 py-8 text-center">
        <div className="flex items-center justify-center gap-5 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/30">
           <div className="flex items-center gap-2"><Activity className="h-3.5 w-3.5" /><span>Ready for Deep Work</span></div>
           <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/20" />
           <div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" /><span>AI Sync Active</span></div>
        </div>
      </footer>
    </div>
  );
}
