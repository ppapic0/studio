'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  increment,
  setDoc
} from 'firebase/firestore';
import { StudyLogDay, StudyPlanItem, WithId, GrowthProgress } from '@/lib/types';
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
  getDay,
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
  CircleDot
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
  DialogFooter,
  DialogTrigger,
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

const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

function ScheduleItemRow({ item, onUpdateTime, onDelete, isPast, isMobile }: any) {
  const [titlePart, timePart] = item.title.split(': ');
  
  const from24h = (t: string) => {
    if (!t || !t.includes(':')) return { hour: '09', minute: '00', period: '오전' as const };
    let [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return { hour: '09', minute: '00', period: '오전' as const };
    const p = h >= 12 ? '오후' : '오전';
    let h12 = h % 12 || 12;
    return { hour: h12.toString().padStart(2, '0'), minute: m.toString().padStart(2, '0'), period: p };
  };

  const initial = from24h(timePart);
  const [localHour, setLocalHour] = useState(initial.hour);
  const [localMinute, setLocalMinute] = useState(initial.minute);
  const [localPeriod, setLocalPeriod] = useState(initial.period);

  useEffect(() => {
    const remote = from24h(timePart);
    setLocalHour(remote.hour);
    setLocalMinute(remote.minute);
    setLocalPeriod(remote.period);
  }, [timePart]);

  const handleValueChange = (type: 'hour' | 'minute' | 'period', value: string) => {
    let h = localHour;
    let m = localMinute;
    let p = localPeriod;

    if (type === 'hour') { h = value; setLocalHour(value); }
    if (type === 'minute') { m = value; setLocalMinute(value); }
    if (type === 'period') { p = value as any; setLocalPeriod(p); }

    onUpdateTime(item.id, titlePart, `${h}:${m}`, p);
  };

  const getIcon = (title: string) => {
    if (title.includes('등원')) return MapPin;
    if (title.includes('하원')) return School;
    if (title.includes('점심') || title.includes('저녁') || title.includes('식사')) return Coffee;
    return Clock;
  };

  const Icon = getIcon(titlePart);

  return (
    <div className={cn(
      "flex flex-col transition-all border group relative bg-white shadow-sm hover:shadow-md w-full",
      isMobile ? "p-3 rounded-2xl border-border/40" : "p-5 rounded-2xl hover:border-primary/30"
    )}>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className={cn(
          "rounded-xl transition-all duration-500 shrink-0 flex items-center justify-center",
          isMobile ? "bg-primary/5 p-2" : "bg-primary/10 p-3 group-hover:bg-primary group-hover:text-white"
        )}>
          <Icon className={cn(isMobile ? "h-4 w-4 text-primary" : "h-5 w-5")} />
        </div>
        <div className="flex-1 min-w-0">
          <Label className={cn("font-black tracking-tight block truncate", isMobile ? "text-xs" : "text-base")}>{titlePart}</Label>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isPast ? (
            <Badge variant="outline" className="font-mono font-black text-primary border-primary/10 bg-primary/5 text-[9px] px-1.5 py-0.5">
              {timePart ? `${localPeriod} ${localHour}:${localMinute}` : '-'}
            </Badge>
          ) : (
            <div className="flex items-center bg-muted/20 p-0.5 rounded-lg border border-border/30">
               <Select value={localPeriod} onValueChange={(v) => handleValueChange('period', v)}>
                 <SelectTrigger className={cn("border-none bg-transparent font-black px-1 focus:ring-0 h-6 shadow-none", isMobile ? "w-[45px] text-[9px]" : "w-[65px] text-xs")}>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent className="rounded-xl border-none shadow-2xl">
                   <SelectItem value="오전">오전</SelectItem>
                   <SelectItem value="오후">오후</SelectItem>
                 </SelectContent>
               </Select>
               <div className="w-px h-2 bg-border/50 mx-0.5" />
               <Select value={localHour} onValueChange={(v) => handleValueChange('hour', v)}>
                 <SelectTrigger className={cn("border-none bg-transparent font-mono font-black px-1 focus:ring-0 h-6 shadow-none", isMobile ? "w-[32px] text-[10px]" : "w-[50px] text-sm")}>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent className="max-h-[200px]">{HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
               </Select>
               <span className="text-[9px] font-black opacity-30 px-0.5">:</span>
               <Select value={localMinute} onValueChange={(v) => handleValueChange('minute', v)}>
                 <SelectTrigger className={cn("border-none bg-transparent font-mono font-black px-1 focus:ring-0 h-6 shadow-none", isMobile ? "w-[32px] text-[10px]" : "w-[50px] text-sm")}>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent className="max-h-[200px]">{MINUTES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
               </Select>
            </div>
          )}
          {!isPast && <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 ml-0.5" onClick={() => onDelete(item)}><Trash2 className="h-3.5 w-3.5" /></Button>}
        </div>
      </div>
    </div>
  );
}

export default function StudyHistoryPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  
  const isMobile = viewMode === 'mobile';
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [selectedDateForPlan, setSelectedDateForPlan] = useState<Date | null>(null);
  const [newStudyTask, setNewStudyTask] = useState('');
  const [newPersonalTask, setNewPersonalTask] = useState('');
  const [newRoutineTitle, setNewRoutineTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);

  useEffect(() => { setCurrentDate(new Date()); }, []);

  const studyLogsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !activeMembership) return null;
    return query(collection(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days'), orderBy('dateKey', 'desc'));
  }, [firestore, user, activeMembership]);
  const { data: logs, isLoading: logsLoading } = useCollection<StudyLogDay>(studyLogsQuery);

  const weekKey = selectedDateForPlan ? format(selectedDateForPlan, "yyyy-'W'II") : currentDate ? format(currentDate, "yyyy-'W'II") : '';
  const plansQuery = useMemoFirebase(() => {
    if (!firestore || !user || !activeMembership || !weekKey) return null;
    return query(collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items'));
  }, [firestore, user, activeMembership, weekKey]);
  const { data: allPlans } = useCollection<StudyPlanItem>(plansQuery);

  const selectedDateKey = selectedDateForPlan ? format(selectedDateForPlan, 'yyyy-MM-dd') : null;
  const dailyPlans = useMemo(() => allPlans?.filter(p => p.dateKey === selectedDateKey) || [], [allPlans, selectedDateKey]);
  const scheduleItems = useMemo(() => dailyPlans.filter(p => p.category === 'schedule'), [dailyPlans]);
  const personalTasks = useMemo(() => dailyPlans.filter(p => p.category === 'personal'), [dailyPlans]);
  const studyTasks = useMemo(() => dailyPlans.filter(p => p.category === 'study' || !p.category), [dailyPlans]);

  const to24h = (time12h: string, period: '오전' | '오후') => {
    if (!time12h || !time12h.includes(':')) return time12h;
    let [hours, mins] = time12h.split(':').map(Number);
    if (isNaN(hours) || isNaN(mins)) return time12h;
    if (period === '오후' && hours < 12) hours += 12;
    if (period === '오전' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
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

  const getHeatmapColor = (minutes: number) => {
    if (minutes === 0) return 'bg-white';
    if (minutes < 60) return 'bg-emerald-50 text-emerald-700';
    if (minutes < 180) return 'bg-emerald-100 text-emerald-800';
    if (minutes < 300) return 'bg-emerald-200 text-emerald-900';
    if (minutes < 480) return 'bg-emerald-400 text-white';
    return 'bg-emerald-600 text-white shadow-inner';
  };

  const monthTotalMinutes = useMemo(() => {
    if (!logs || !currentDate) return 0;
    return logs.filter(log => isSameMonth(new Date(log.dateKey), currentDate)).reduce((acc, log) => acc + log.totalMinutes, 0);
  }, [logs, currentDate]);

  const handleAddTask = async (title: string, category: 'study' | 'personal' | 'schedule', defaultTime?: string) => {
    if (!firestore || !user || !activeMembership || !selectedDateForPlan || !title.trim()) return;
    setIsSubmitting(true);
    const dateKey = format(selectedDateForPlan, 'yyyy-MM-dd');
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
    const colRef = collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items');
    try {
      const finalTitle = category === 'schedule' ? `${title.trim()}: ${defaultTime || '09:00'}` : title.trim();
      await addDoc(colRef, { title: finalTitle, done: false, weight: category === 'schedule' ? 0 : 1, dateKey, category, studyPlanWeekId: weekKey, centerId: activeMembership.id, studentId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      if (category === 'study') setNewStudyTask(''); else if (category === 'personal') setNewPersonalTask(''); else { setNewRoutineTitle(''); setIsRoutineModalOpen(false); }
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  const handleUpdateScheduleTime = async (itemId: string, baseTitle: string, timeValue: string, periodValue: '오전' | '오후') => {
    if (!selectedDateForPlan || !firestore || !user || !activeMembership) return;
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
    await updateDoc(doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', itemId), { title: `${baseTitle}: ${to24h(timeValue, periodValue)}`, updatedAt: serverTimestamp() });
  };

  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (!firestore || !user || !activeMembership || !selectedDateForPlan) return;
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
    await updateDoc(doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id), { done: !item.done, updatedAt: serverTimestamp() });
    if (!item.done) {
      const progressRef = doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
      setDoc(progressRef, { stats: { achievement: increment(0.05) }, currentXp: increment(10), updatedAt: serverTimestamp() }, { merge: true });
    }
  };

  const handleDeleteTask = async (item: WithId<StudyPlanItem>) => {
    if (!firestore || !user || !activeMembership || !selectedDateForPlan) return;
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
    await deleteDoc(doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id));
  };

  const isActuallyPast = selectedDateForPlan ? isBefore(startOfDay(selectedDateForPlan), startOfDay(new Date())) : false;

  if (!currentDate) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className={cn("flex flex-col w-full max-w-5xl mx-auto pb-20", isMobile ? "gap-4 px-1" : "gap-10")}>
      <header className={cn("flex justify-between items-center px-2", isMobile ? "flex-col gap-4" : "flex-row")}>
        <div className="flex flex-col gap-1">
          <h1 className={cn("font-black tracking-tighter text-primary", isMobile ? "text-2xl" : "text-4xl")}>학습 기록</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Study Logs & History</p>
        </div>
        <div className="flex items-center gap-2 bg-white/80 p-1.5 rounded-2xl border shadow-xl">
           <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/5 transition-all" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="h-5 w-5" /></Button>
           <span className="font-black text-sm min-w-[120px] text-center tracking-tight">{format(currentDate, 'yyyy년 M월')}</span>
           <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/5 transition-all" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="h-5 w-5" /></Button>
        </div>
      </header>

      <div className={cn("grid gap-4", isMobile ? "grid-cols-1 px-1" : "md:grid-cols-3")}>
        <Card className="md:col-span-2 border-none shadow-2xl bg-primary text-primary-foreground rounded-[2.5rem] p-8">
          <div className="flex justify-between items-center mb-6">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Monthly Summary</span>
            <Badge className="bg-white/20 text-white border-none font-black text-[10px] px-2.5">이번 달 총 몰입</Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={cn("font-black tracking-tighter tabular-nums leading-none", isMobile ? "text-5xl" : "text-6xl")}>{formatMinutes(monthTotalMinutes)}</span>
            <span className="text-lg font-bold opacity-60">총 학습 완료</span>
          </div>
        </Card>
        {!isMobile && <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white p-8 flex flex-col justify-center gap-4"><h3 className="font-black text-sm uppercase text-primary/40 flex items-center gap-2"><Sparkles className="h-4 w-4" /> Mastery Tip</h3><p className="text-xs font-bold leading-relaxed text-foreground/70">매일 3시간 이상 학습 시 마스터리 경험치가 대폭 상승합니다.</p><Button asChild className="rounded-2xl font-black text-xs h-12 shadow-lg"><Link href="/dashboard/growth">보드 바로가기 <ChevronRight className="ml-2 h-4 w-4" /></Link></Button></Card>}
      </div>

      <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white mx-auto w-full">
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b bg-muted/10">
            {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
              <div key={day} className={cn("py-4 text-center text-[10px] font-black uppercase", i === 5 ? "text-blue-500" : i === 6 ? "text-red-500" : "text-muted-foreground")}>{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr">
            {logsLoading ? <div className="col-span-7 h-[300px] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div> : calendarData.days.map((day, idx) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const minutes = logs?.find(l => l.dateKey === dateKey)?.totalMinutes || 0;
              const hasPlans = allPlans?.some(p => p.dateKey === dateKey);
              const isCurrentMonth = calendarData.monthStart ? isSameMonth(day, calendarData.monthStart) : false;
              const isToday = isSameDay(day, new Date());
              return (
                <div key={dateKey} onClick={() => setSelectedDateForPlan(day)} className={cn("p-2 border-r border-b relative transition-all cursor-pointer bg-white overflow-hidden", isMobile ? "aspect-square" : "min-h-[120px]", !isCurrentMonth ? "opacity-10" : getHeatmapColor(minutes), isToday && "ring-2 ring-inset ring-primary/20 z-10")}>
                  <div className="flex justify-between items-start">
                    <span className={cn("text-[9px] font-black", idx % 7 === 5 && isCurrentMonth ? "text-blue-600" : idx % 7 === 6 && isCurrentMonth ? "text-red-600" : "")}>{format(day, 'd')}</span>
                    <div className="flex flex-col items-end gap-1">
                      {minutes >= 180 && <Zap className="h-2.5 w-2.5 text-yellow-500 fill-yellow-500" />}
                      {hasPlans && <div className="w-1 h-1 rounded-full bg-primary/30" />}
                    </div>
                  </div>
                  {minutes > 0 && <div className="mt-auto flex justify-center"><span className={cn("font-mono font-black tracking-tighter text-primary", isMobile ? "text-[10px]" : "text-xl")}>{formatMinutes(minutes)}</span></div>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedDateForPlan} onOpenChange={(open) => !open && setSelectedDateForPlan(null)}>
        <DialogContent className={cn("border-none shadow-2xl p-0 overflow-hidden", isMobile ? "fixed bottom-0 top-auto translate-y-0 left-0 right-0 max-w-none rounded-t-[2.5rem] rounded-b-none" : "sm:max-w-xl rounded-[3rem]")}>
          <div className="bg-primary p-8 text-white relative">
            <Sparkles className="absolute top-0 right-0 p-8 h-32 w-32 opacity-10" />
            <DialogHeader><DialogTitle className="text-2xl font-black tracking-tighter flex items-center gap-3"><ClipboardList className="h-6 w-6 text-accent" /> {selectedDateForPlan && format(selectedDateForPlan, 'M월 d일 (EEEE)', {locale: ko})}</DialogTitle></DialogHeader>
          </div>
          <div className={cn("bg-[#fafafa] overflow-y-auto custom-scrollbar", isMobile ? "max-h-[60vh]" : "max-h-[500px]")}>
            <Tabs defaultValue="schedule" className="w-full">
              <TabsList className="grid w-full grid-cols-3 rounded-none h-14 bg-muted/20 p-0 border-b">
                <TabsTrigger value="schedule" className="data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-primary font-black text-xs uppercase">ROUTINE</TabsTrigger>
                <TabsTrigger value="study" className="data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-emerald-500 font-black text-xs uppercase">STUDY</TabsTrigger>
                <TabsTrigger value="personal" className="data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-amber-500 font-black text-xs uppercase">LIFE</TabsTrigger>
              </TabsList>
              <div className="p-6 space-y-6">
                <TabsContent value="schedule" className="mt-0 space-y-3">
                  {!isActuallyPast && <div className="flex justify-end"><Dialog open={isRoutineModalOpen} onOpenChange={setIsRoutineModalOpen}><DialogTrigger asChild><Button variant="ghost" size="sm" className="h-7 text-[10px] font-black gap-1"><Plus className="h-3 w-3" /> 추가</Button></DialogTrigger><DialogContent className="rounded-3xl p-8"><DialogHeader><DialogTitle className="text-xl font-black">루틴 추가</DialogTitle></DialogHeader><Input placeholder="루틴 이름" value={newRoutineTitle} onChange={(e) => setNewRoutineTitle(e.target.value)} className="h-12 border-2" /><Button onClick={() => handleAddTask(newRoutineTitle, 'schedule')} className="w-full h-12 rounded-2xl font-black">추가하기</Button></DialogContent></Dialog></div>}
                  {scheduleItems.length === 0 ? <p className="text-center py-6 text-[10px] font-bold text-muted-foreground/40 italic">등록된 루틴이 없습니다.</p> : scheduleItems.map(item => <ScheduleItemRow key={item.id} item={item} onUpdateTime={handleUpdateScheduleTime} onDelete={handleDeleteTask} isPast={isActuallyPast} isMobile={isMobile} />)}
                </TabsContent>
                <TabsContent value="study" className="mt-0 space-y-3">
                  {studyTasks.map(task => <div key={task.id} className={cn("flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all", task.done ? "bg-emerald-50/20 border-emerald-100/50" : "bg-white shadow-sm")}><Checkbox checked={task.done} onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} disabled={isActuallyPast} /><Label className={cn("flex-1 text-sm font-bold transition-all", task.done && "line-through opacity-40")}>{task.title}</Label></div>)}
                  {!isActuallyPast && <div className="relative flex items-center bg-white border-2 border-emerald-100 rounded-2xl p-1 shadow-sm"><Input placeholder="공부 계획 추가..." value={newStudyTask} onChange={(e) => setNewStudyTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newStudyTask, 'study')} className="border-none shadow-none focus-visible:ring-0 font-bold h-9 text-xs" /><Button size="icon" onClick={() => handleAddTask(newStudyTask, 'study')} className="h-8 w-8 rounded-xl bg-emerald-500"><Plus className="h-4 w-4" /></Button></div>}
                </TabsContent>
                <TabsContent value="personal" className="mt-0 space-y-3">
                  {personalTasks.map(task => <div key={task.id} className={cn("flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all", task.done ? "bg-amber-50/20 border-amber-100/50" : "bg-white shadow-sm")}><Checkbox checked={task.done} onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} disabled={isActuallyPast} /><Label className={cn("flex-1 text-sm font-bold transition-all", task.done && "line-through opacity-40")}>{task.title}</Label></div>)}
                  {!isActuallyPast && <div className="relative flex items-center bg-white border-2 border-amber-100 rounded-2xl p-1 shadow-sm"><Input placeholder="일정 추가..." value={newPersonalTask} onChange={(e) => setNewPersonalTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newPersonalTask, 'personal')} className="border-none shadow-none focus-visible:ring-0 font-bold h-9 text-xs" /><Button variant="outline" size="icon" onClick={() => handleAddTask(newPersonalTask, 'personal')} className="h-8 w-8 rounded-xl border-2 border-amber-500 text-amber-600"><Plus className="h-4 w-4" /></Button></div>}
                </TabsContent>
              </div>
            </Tabs>
          </div>
          <DialogFooter className="p-6 bg-white border-t"><Button variant="ghost" className="w-full h-10 rounded-2xl font-black text-xs text-muted-foreground" onClick={() => setSelectedDateForPlan(null)}>닫기</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
