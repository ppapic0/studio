'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirestore, useCollection } from '@/firebase';
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
} from 'firebase/firestore';
import { StudyLogDay, StudyPlanItem, WithId } from '@/lib/types';
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
  CalendarPlus, 
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
  Sparkles
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

const SCHEDULE_TEMPLATES = [
  { title: '등원 시간', icon: MapPin },
  { title: '하원 시간', icon: School },
  { title: '점심 시간', icon: Coffee },
  { title: '저녁 시간', icon: Coffee },
  { title: '학원 시간', icon: Clock },
];

function ScheduleItemRow({ tpl, scheduleItems, onUpdate, isPast }: any) {
  const found = scheduleItems.find((p: any) => p.title.startsWith(tpl.title));
  const time24h = found ? found.title.split(': ')[1] : '';
  
  const from24h = (t: string) => {
    if (!t || !t.includes(':')) return { time: '', period: '오전' as const };
    let [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return { time: '', period: '오전' as const };
    const p = h >= 12 ? '오후' : '오전';
    let h12 = h % 12 || 12;
    return { time: `${h12.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`, period: p };
  };

  const initial = from24h(time24h);
  const [localTime, setLocalTime] = useState(initial.time);
  const [localPeriod, setLocalPeriod] = useState(initial.period);

  useEffect(() => {
    const remote = from24h(time24h);
    setLocalTime(remote.time);
    setLocalPeriod(remote.period);
  }, [time24h]);

  const handleBlur = () => {
    if (localTime !== initial.time) {
      onUpdate(tpl.title, localTime, localPeriod);
    }
  };

  const handlePeriodChange = (newP: any) => {
    setLocalPeriod(newP);
    onUpdate(tpl.title, localTime, newP);
  };

  return (
    <div className="flex flex-col gap-1.5 bg-muted/20 p-2.5 rounded-xl border group hover:border-primary/50 transition-all">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-1.5 rounded-lg group-hover:bg-primary/20 transition-colors">
          <tpl.icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <Label className="flex-1 font-bold text-xs">{tpl.title}</Label>
        {isPast ? (
          <span className="font-mono font-bold text-primary text-xs">{localTime ? `${localPeriod} ${localTime}` : '-'}</span>
        ) : (
          <div className="flex items-center gap-1.5">
             <Select value={localPeriod} onValueChange={handlePeriodChange}>
               <SelectTrigger className="w-[65px] h-8 text-[10px] border-none bg-transparent font-bold px-1">
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="오전">오전</SelectItem>
                 <SelectItem value="오후">오후</SelectItem>
               </SelectContent>
             </Select>
             <Input 
              placeholder="00:00"
              className="w-14 h-8 text-center bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary shadow-sm p-0 font-mono font-bold text-xs"
              value={localTime}
              onChange={(e) => setLocalTime(e.target.value)}
              onBlur={handleBlur}
            />
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
  
  const isMobile = viewMode === 'mobile';
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const [selectedDateForPlan, setSelectedDateForPlan] = useState<Date | null>(null);
  
  const [newStudyTask, setNewStudyTask] = useState('');
  const [newPersonalTask, setNewPersonalTask] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCurrentDate(new Date());
  }, []);

  const studyLogsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days'),
      orderBy('dateKey', 'desc')
    );
  }, [firestore, user, activeMembership]);

  const { data: logs, isLoading: logsLoading } = useCollection<StudyLogDay>(studyLogsQuery);

  const weekKey = selectedDateForPlan ? format(selectedDateForPlan, "yyyy-'W'II") : currentDate ? format(currentDate, "yyyy-'W'II") : '';
  
  const plansQuery = useMemoFirebase(() => {
    if (!firestore || !user || !activeMembership || !weekKey) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items')
    );
  }, [firestore, user, activeMembership, weekKey]);
  
  const { data: allPlans } = useCollection<StudyPlanItem>(plansQuery);

  const selectedDateKey = selectedDateForPlan ? format(selectedDateForPlan, 'yyyy-MM-dd') : null;
  
  const dailyPlans = useMemo(() => {
    if (!allPlans || !selectedDateKey) return [];
    return allPlans.filter(p => p.dateKey === selectedDateKey);
  }, [allPlans, selectedDateKey]);

  const scheduleItems = dailyPlans.filter(p => p.category === 'schedule');
  const personalTasks = dailyPlans.filter(p => p.category === 'personal');
  const studyTasks = dailyPlans.filter(p => p.category === 'study' || !p.category);

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

    return {
      days: eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
      monthStart: start
    };
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

  const prevMonth = () => currentDate && setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => currentDate && setCurrentDate(addMonths(currentDate, 1));

  const monthTotalMinutes = useMemo(() => {
    if (!logs || !currentDate) return 0;
    return logs
      .filter(log => isSameMonth(new Date(log.dateKey), currentDate))
      .reduce((acc, log) => acc + log.totalMinutes, 0);
  }, [logs, currentDate]);

  const handleAddTask = async (title: string, category: 'study' | 'personal') => {
    if (!firestore || !user || !activeMembership || !selectedDateForPlan || !title.trim()) return;
    setIsSubmitting(true);
    const dateKey = format(selectedDateForPlan, 'yyyy-MM-dd');
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
    const itemsCollectionRef = collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items');
    try {
      await addDoc(itemsCollectionRef, {
        title: title.trim(), done: false, weight: 1, dateKey, category, studyPlanWeekId: weekKey,
        centerId: activeMembership.id, studentId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      if (category === 'study') setNewStudyTask(''); else setNewPersonalTask('');
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const handleUpdateSchedule = async (title: string, timeValue: string, periodValue: '오전' | '오후') => {
    if (!firestore || !user || !activeMembership || !selectedDateForPlan) return;
    const dateKey = format(selectedDateForPlan, 'yyyy-MM-dd');
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
    const formattedTime = to24h(timeValue, periodValue);
    const existing = scheduleItems.find(p => p.title.startsWith(title));
    const itemsCollectionRef = collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items');
    if (existing) {
      await updateDoc(doc(itemsCollectionRef, existing.id), { title: `${title}: ${formattedTime}`, updatedAt: serverTimestamp() });
    } else {
      await addDoc(itemsCollectionRef, {
        title: `${title}: ${formattedTime}`, done: false, weight: 0, dateKey, category: 'schedule', studyPlanWeekId: weekKey,
        centerId: activeMembership.id, studentId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
  };

  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (!firestore || !user || !activeMembership || !selectedDateForPlan) return;
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
    await updateDoc(doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id), {
      done: !item.done, doneAt: !item.done ? serverTimestamp() : null, updatedAt: serverTimestamp(),
    });
  };

  const handleDeleteTask = async (item: WithId<StudyPlanItem>) => {
    if (!firestore || !user || !activeMembership || !selectedDateForPlan) return;
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
    await deleteDoc(doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id));
  };

  const handleApplyToAllWeekdays = async () => {
    if (!selectedDateForPlan || !firestore || !user || !activeMembership || dailyPlans.length === 0 || !currentDate) return;
    setIsSubmitting(true);
    const weekday = getDay(selectedDateForPlan);
    const targetDates = eachDayOfInterval({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) })
      .filter(d => getDay(d) === weekday && !isSameDay(d, selectedDateForPlan));
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
      toast({ title: "일정 복사 완료", description: `이번 달 모든 ${format(selectedDateForPlan, 'EEEE', {locale: ko})}에 계획이 복사되었습니다.` });
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const isActuallyPast = selectedDateForPlan ? isBefore(startOfDay(selectedDateForPlan), startOfDay(new Date())) : false;
  const weekdayName = selectedDateForPlan ? format(selectedDateForPlan, 'EEEE', {locale: ko}) : '';

  if (!currentDate) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className={cn("flex flex-col w-full max-w-5xl mx-auto pb-20", isMobile ? "gap-4 px-1" : "gap-6")}>
      <header className={cn("flex justify-between items-center", isMobile ? "flex-col gap-3 px-1" : "flex-row")}>
        <div className="flex flex-col gap-0.5">
          <h1 className={cn("font-black tracking-tighter text-primary", isMobile ? "text-2xl" : "text-3xl")}>학습 기록</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Study Logs & History</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border shadow-sm">
           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
           <span className="font-black text-sm min-w-[100px] text-center">{format(currentDate, 'yyyy년 M월')}</span>
           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </header>

      <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "md:grid-cols-3")}>
        <Card className="md:col-span-2 border-none shadow-xl bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-[2rem] overflow-hidden relative group p-6">
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 transition-transform group-hover:scale-110"><CalendarDays className="h-32 w-32" /></div>
          <div className="relative z-10 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Monthly Summary</span>
              <Badge className="bg-white/20 text-white border-none font-black text-[10px] px-2.5">이번 달 총 몰입</Badge>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("font-black tracking-tighter tabular-nums leading-none", isMobile ? "text-5xl" : "text-6xl")}>{formatMinutes(monthTotalMinutes)}</span>
              <span className="text-sm font-bold opacity-60">총 학습 완료</span>
            </div>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-400 rounded-sm" /><span className="text-[10px] font-bold">8시간+</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-200 rounded-sm" /><span className="text-[10px] font-bold">3시간+</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-white/20 rounded-sm border border-white/10" /><span className="text-[10px] font-bold">기록 없음</span></div>
            </div>
          </div>
        </Card>

        {!isMobile && (
          <Card className="rounded-[2rem] border-none shadow-xl bg-white p-6 flex flex-col justify-center gap-4">
            <div className="space-y-1">
              <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">Mastery Tip</h3>
              <p className="text-xs font-bold leading-relaxed text-foreground/70">매일 3시간 이상 학습 시 <Zap className="inline h-3 w-3 text-yellow-500 fill-yellow-500" /> 아이콘을 획득하며 마스터리 경험치가 대폭 상승합니다.</p>
            </div>
            <Button asChild variant="outline" className="w-full rounded-xl font-black text-xs h-10 border-2"><Link href="/dashboard/growth">마스터리 보러가기</Link></Button>
          </Card>
        )}
      </div>

      <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white ring-1 ring-black/[0.03]">
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b bg-muted/5">
            {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
              <div key={day} className={cn("py-3 text-center text-[10px] font-black uppercase tracking-widest", i === 5 ? "text-blue-500" : i === 6 ? "text-red-500" : "text-muted-foreground")}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-fr">
            {logsLoading ? (
              <div className="col-span-7 h-[300px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" /></div>
            ) : calendarData.days.map((day, idx) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const log = logs?.find(l => l.dateKey === dateKey);
              const minutes = log?.totalMinutes || 0;
              const hasPlans = allPlans?.some(p => p.dateKey === dateKey);
              const isCurrentMonth = calendarData.monthStart ? isSameMonth(day, calendarData.monthStart) : false;
              const isToday = isSameDay(day, new Date());
              
              return (
                <div 
                  key={dateKey} 
                  onClick={() => setSelectedDateForPlan(day)}
                  className={cn(
                    "p-1.5 sm:p-3 border-r border-b relative group transition-all cursor-pointer hover:z-20",
                    isMobile ? "aspect-square" : "min-h-[110px]",
                    !isCurrentMonth ? "bg-muted/5 opacity-10" : getHeatmapColor(minutes),
                    isToday && "ring-2 ring-inset ring-primary z-10"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <span className={cn("text-[9px] sm:text-[10px] font-black leading-none", idx % 7 === 5 && isCurrentMonth ? "text-blue-600" : idx % 7 === 6 && isCurrentMonth ? "text-red-600" : "")}>{format(day, 'd')}</span>
                    <div className="flex flex-col items-end gap-0.5 sm:gap-1">
                      {minutes >= 180 && <Zap className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-yellow-500 fill-yellow-500" />}
                      {hasPlans && <div className="w-1 h-1 rounded-full bg-primary/40" />}
                    </div>
                  </div>
                  {minutes > 0 && (
                    <div className="mt-1 sm:mt-3 flex justify-center">
                      <span className={cn("font-mono font-black tracking-tighter leading-none", isMobile ? "text-[10px]" : "text-lg")}>{formatMinutes(minutes)}</span>
                    </div>
                  )}
                  {isToday && (
                    <div className="absolute bottom-0.5 right-1 sm:bottom-1 sm:right-1.5">
                      <span className={cn("font-black uppercase tracking-tighter bg-primary text-white px-1 rounded-sm", isMobile ? "text-[5px]" : "text-[7px]")}>Today</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4 items-center px-4 py-3 bg-white border shadow-sm rounded-2xl text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
         <div className="flex items-center gap-1.5"><Zap className="h-3 w-3 text-yellow-500 fill-yellow-500" /><span>3시간 몰입 성공</span></div>
         <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-primary/40" /><span>계획 수립됨</span></div>
         <div className="ml-auto flex items-center gap-1"><Info className="h-3 w-3" /><span>날짜를 클릭하여 상세 기록을 관리하세요.</span></div>
      </div>

      <Dialog open={!!selectedDateForPlan} onOpenChange={(open) => !open && setSelectedDateForPlan(null)}>
        <DialogContent className={cn("border-none shadow-2xl p-0 overflow-hidden", isMobile ? "fixed bottom-0 top-auto translate-y-0 left-0 right-0 max-w-none rounded-t-[2.5rem] rounded-b-none" : "sm:max-w-lg rounded-[3rem]")}>
          <div className="bg-primary p-8 text-white relative">
            <Sparkles className="absolute top-0 right-0 p-8 h-32 w-32 opacity-10" />
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tighter flex items-center gap-2">
                <ClipboardList className="h-6 w-6" /> {selectedDateForPlan && format(selectedDateForPlan, 'M월 d일 (EEE)', {locale: ko})}
              </DialogTitle>
              <DialogDescription className="text-white/60 font-bold mt-1">학습 및 생활 루틴 상세 현황</DialogDescription>
            </DialogHeader>
          </div>
          
          <div className={cn("bg-[#fafafa]", isMobile ? "max-h-[60vh] overflow-y-auto" : "max-h-[500px] overflow-y-auto")}>
            {selectedDateForPlan && dailyPlans.length === 0 && isActuallyPast ? (
              <div className="py-20 text-center flex flex-col items-center gap-4 opacity-30">
                <CalendarX className="h-12 w-12" />
                <p className="font-black italic text-sm">작성된 기록이 없습니다.</p>
              </div>
            ) : (
              <Tabs defaultValue="schedule" className="w-full">
                <TabsList className="grid w-full grid-cols-3 rounded-none h-12 bg-muted/30 p-0 border-b">
                  <TabsTrigger value="schedule" className="data-[state=active]:bg-white rounded-none border-b-2 border-transparent data-[state=active]:border-primary font-black text-xs transition-all">시간표</TabsTrigger>
                  <TabsTrigger value="study" className="data-[state=active]:bg-white rounded-none border-b-2 border-transparent data-[state=active]:border-primary font-black text-xs transition-all">자습</TabsTrigger>
                  <TabsTrigger value="personal" className="data-[state=active]:bg-white rounded-none border-b-2 border-transparent data-[state=active]:border-primary font-black text-xs transition-all">개인</TabsTrigger>
                </TabsList>

                <div className="p-6 space-y-6">
                  <TabsContent value="schedule" className="mt-0 space-y-3">
                    {SCHEDULE_TEMPLATES.map((tpl) => (
                      <ScheduleItemRow key={tpl.title} tpl={tpl} scheduleItems={scheduleItems} onUpdate={handleUpdateSchedule} isPast={isActuallyPast} />
                    ))}
                  </TabsContent>

                  <TabsContent value="study" className="mt-0 space-y-3">
                    {studyTasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl border bg-white shadow-sm group">
                        <Checkbox id={task.id} checked={task.done} onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} disabled={isActuallyPast} className="rounded-md border-2" />
                        <Label htmlFor={task.id} className={cn("flex-1 text-sm font-bold transition-all", task.done && "line-through text-muted-foreground opacity-40")}>{task.title}</Label>
                        {!isActuallyPast && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {!isActuallyPast && (
                      <div className="flex items-center gap-2 pt-2">
                        <Input placeholder="오늘 할 자습 과제 입력..." value={newStudyTask} onChange={(e) => setNewStudyTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newStudyTask, 'study')} disabled={isSubmitting} className="rounded-xl h-11 border-2 font-bold text-sm" />
                        <Button size="icon" onClick={() => handleAddTask(newStudyTask, 'study')} disabled={isSubmitting || !newStudyTask.trim()} className="rounded-xl h-11 w-11 shrink-0"><Plus className="h-5 w-5" /></Button>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="personal" className="mt-0 space-y-3">
                    {personalTasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl border bg-white shadow-sm group">
                        <Checkbox id={task.id} checked={task.done} onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} disabled={isActuallyPast} className="rounded-md border-2" />
                        <Label htmlFor={task.id} className={cn("flex-1 text-sm font-bold transition-all", task.done && "line-through text-muted-foreground opacity-40")}>{task.title}</Label>
                        {!isActuallyPast && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {!isActuallyPast && (
                      <div className="flex items-center gap-2 pt-2">
                        <Input placeholder="공부 외 개인 일정 입력..." value={newPersonalTask} onChange={(e) => setNewPersonalTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newPersonalTask, 'personal')} disabled={isSubmitting} className="rounded-xl h-11 border-2 font-bold text-sm" />
                        <Button variant="outline" size="icon" onClick={() => handleAddTask(newPersonalTask, 'personal')} disabled={isSubmitting || !newPersonalTask.trim()} className="rounded-xl h-11 w-11 border-2 shrink-0"><Plus className="h-5 w-5" /></Button>
                      </div>
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            )}
          </div>
          
          <DialogFooter className="p-6 bg-white border-t flex-col gap-2">
            {!isActuallyPast && selectedDateForPlan && dailyPlans.length > 0 && (
              <Button variant="outline" className="w-full h-12 rounded-xl gap-2 text-xs font-black border-2" onClick={handleApplyToAllWeekdays} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Copy className="h-4 w-4" />}
                이 일정을 매주 {weekdayName}에 반복 설정
              </Button>
            )}
            <Button variant="ghost" className="w-full h-12 rounded-xl font-black text-xs" onClick={() => setSelectedDateForPlan(null)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
