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
      "flex flex-col transition-all border group relative bg-white shadow-sm hover:shadow-md",
      isMobile ? "p-4 rounded-[1.5rem] border-border/40" : "p-5 rounded-2xl hover:border-primary/30"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "rounded-xl transition-all duration-500 shrink-0 flex items-center justify-center",
          isMobile ? "bg-primary/5 p-2.5" : "bg-primary/10 p-3 group-hover:bg-primary group-hover:text-white"
        )}>
          <Icon className={cn(isMobile ? "h-4 w-4 text-primary" : "h-5 w-5")} />
        </div>
        
        <div className="flex-1 min-w-0">
          <Label className={cn("font-black tracking-tight block truncate", isMobile ? "text-sm" : "text-base")}>{titlePart}</Label>
        </div>

        <div className="flex items-center gap-1">
          {isPast ? (
            <Badge variant="outline" className="font-mono font-black text-primary border-primary/10 bg-primary/5 text-[10px] px-2 py-1">
              {timePart ? `${localPeriod} ${localHour}:${localMinute}` : '-'}
            </Badge>
          ) : (
            <div className="flex items-center gap-0.5 bg-muted/20 p-1 rounded-xl border border-border/30">
               <Select value={localPeriod} onValueChange={(v) => handleValueChange('period', v)}>
                 <SelectTrigger className={cn("border-none bg-transparent font-black px-1.5 focus:ring-0 focus:bg-white rounded-lg transition-all h-7 shadow-none", isMobile ? "w-[52px] text-[10px]" : "w-[65px] text-xs")}>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent className="rounded-xl border-none shadow-2xl">
                   <SelectItem value="오전">오전</SelectItem>
                   <SelectItem value="오후">오후</SelectItem>
                 </SelectContent>
               </Select>

               <div className="w-px h-3 bg-border/50 mx-0.5" />

               <Select value={localHour} onValueChange={(v) => handleValueChange('hour', v)}>
                 <SelectTrigger className={cn("border-none bg-transparent font-mono font-black px-1.5 focus:ring-0 focus:bg-white rounded-lg transition-all h-7 shadow-none", isMobile ? "w-[38px] text-[11px]" : "w-[50px] text-sm")}>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent className="rounded-xl border-none shadow-2xl max-h-[200px]">
                   {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                 </SelectContent>
               </Select>

               <span className="text-[10px] font-black opacity-30 px-0.5">:</span>

               <Select value={localMinute} onValueChange={(v) => handleValueChange('minute', v)}>
                 <SelectTrigger className={cn("border-none bg-transparent font-mono font-black px-1.5 focus:ring-0 focus:bg-white rounded-lg transition-all h-7 shadow-none", isMobile ? "w-[38px] text-[11px]" : "w-[50px] text-sm")}>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent className="rounded-xl border-none shadow-2xl max-h-[200px]">
                   {MINUTES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                 </SelectContent>
               </Select>
            </div>
          )}
          
          {!isPast && (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0 ml-1" onClick={() => onDelete(item)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
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

  const handleAddTask = async (title: string, category: 'study' | 'personal' | 'schedule', defaultTime?: string) => {
    if (!firestore || !user || !activeMembership || !selectedDateForPlan || !title.trim()) return;
    setIsSubmitting(true);
    const dateKey = format(selectedDateForPlan, 'yyyy-MM-dd');
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
    const itemsCollectionRef = collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items');
    try {
      const finalTitle = category === 'schedule' ? `${title.trim()}: ${defaultTime || '09:00'}` : title.trim();
      await addDoc(itemsCollectionRef, {
        title: finalTitle, done: false, weight: category === 'schedule' ? 0 : 1, dateKey, category, studyPlanWeekId: weekKey,
        centerId: activeMembership.id, studentId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      if (category === 'study') setNewStudyTask(''); 
      else if (category === 'personal') setNewPersonalTask('');
      else {
        setNewRoutineTitle('');
        setIsRoutineModalOpen(false);
      }
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const handleUpdateScheduleTime = async (itemId: string, baseTitle: string, timeValue: string, periodValue: '오전' | '오후') => {
    if (!selectedDateForPlan || !firestore || !user || !activeMembership) return;
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
    const formattedTime = to24h(timeValue, periodValue);
    await updateDoc(doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', itemId), { 
      title: `${baseTitle}: ${formattedTime}`, 
      updatedAt: serverTimestamp() 
    });
  };

  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (!firestore || !user || !activeMembership || !selectedDateForPlan) return;
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
    const itemRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id);
    
    await updateDoc(itemRef, {
      done: !item.done, doneAt: !item.done ? serverTimestamp() : null, updatedAt: serverTimestamp(),
    });

    if (!item.done) {
      const progressRef = doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
      setDoc(progressRef, {
        stats: { achievement: increment(0.05) },
        currentXp: increment(10),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
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
    <div className={cn("flex flex-col w-full max-w-5xl mx-auto pb-20", isMobile ? "gap-4 px-1" : "gap-10")}>
      <header className={cn("flex justify-between items-center", isMobile ? "flex-col gap-4 px-1" : "flex-row")}>
        <div className="flex flex-col gap-1">
          <h1 className={cn("font-black tracking-tighter text-primary", isMobile ? "text-2xl" : "text-4xl")}>학습 기록</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">Study Logs & History Matrix</p>
        </div>
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border shadow-xl">
           <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/5 transition-all" onClick={prevMonth}><ChevronLeft className="h-5 w-5" /></Button>
           <span className="font-black text-sm min-w-[120px] text-center tracking-tight">{format(currentDate, 'yyyy년 M월')}</span>
           <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-primary/5 transition-all" onClick={nextMonth}><ChevronRight className="h-5 w-5" /></Button>
        </div>
      </header>

      <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-3")}>
        <Card className="md:col-span-2 border-none shadow-2xl bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-[2.5rem] overflow-hidden relative group p-8">
          <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12 transition-transform duration-700 group-hover:scale-110"><CalendarDays className="h-40 w-40" /></div>
          <div className="relative z-10 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                <Activity className="h-3 w-3 text-accent animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest opacity-80">Monthly Summary</span>
              </div>
              <Badge className="bg-white/20 text-white border-none font-black text-[10px] px-3 py-1 rounded-lg">이번 달 총 몰입</Badge>
            </div>
            <div className="flex items-baseline gap-3">
              <span className={cn("font-black tracking-tighter tabular-nums leading-none", isMobile ? "text-5xl" : "text-7xl")}>{formatMinutes(monthTotalMinutes)}</span>
              <span className="text-lg font-bold opacity-60">총 학습 완료</span>
            </div>
            <div className="flex gap-5 mt-2">
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-400 rounded-sm shadow-sm" /><span className="text-[11px] font-black opacity-80">8시간+</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-200 rounded-sm shadow-sm" /><span className="text-[11px] font-black opacity-80">3시간+</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 bg-white/20 rounded-sm border border-white/10 shadow-sm" /><span className="text-[11px] font-black opacity-80">기록 없음</span></div>
            </div>
          </div>
        </Card>

        {!isMobile && (
          <Card className="rounded-[2.5rem] border-none shadow-2xl bg-white p-8 flex flex-col justify-center gap-6">
            <div className="space-y-2">
              <h3 className="font-black text-sm uppercase tracking-widest text-primary/40 flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Mastery Tip
              </h3>
              <p className="text-sm font-bold leading-relaxed text-foreground/70">
                매일 3시간 이상 학습 시 <Zap className="inline h-3.5 w-3.5 text-yellow-500 fill-yellow-500" /> 아이콘을 획득하며 마스터리 경험치가 대폭 상승합니다.
              </p>
            </div>
            <Button asChild className="w-full rounded-2xl font-black text-sm h-14 shadow-lg active:scale-95 transition-all"><Link href="/dashboard/growth">마스터리 보드 바로가기 <ChevronRight className="ml-2 h-4 w-4" /></Link></Button>
          </Card>
        )}
      </div>

      <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white">
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b bg-muted/10">
            {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
              <div key={day} className={cn("py-4 text-center text-[11px] font-black uppercase tracking-widest", i === 5 ? "text-blue-500" : i === 6 ? "text-red-500" : "text-muted-foreground")}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-fr">
            {logsLoading ? (
              <div className="col-span-7 h-[400px] flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" /></div>
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
                    "p-2 sm:p-4 border-r border-b relative group transition-all cursor-pointer hover:z-20 hover:scale-[1.02] hover:shadow-2xl bg-white",
                    isMobile ? "aspect-square" : "min-h-[130px]",
                    !isCurrentMonth ? "bg-muted/5 opacity-10" : getHeatmapColor(minutes),
                    isToday && "ring-4 ring-inset ring-primary/20 z-10"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <span className={cn("text-[10px] sm:text-xs font-black leading-none tabular-nums", idx % 7 === 5 && isCurrentMonth ? "text-blue-600" : idx % 7 === 6 && isCurrentMonth ? "text-red-600" : "")}>{format(day, 'd')}</span>
                    <div className="flex flex-col items-end gap-1 sm:gap-1.5">
                      {minutes >= 180 && <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500 fill-yellow-500 drop-shadow-sm" />}
                      {hasPlans && <div className="w-1.5 h-1.5 rounded-full bg-primary/30" />}
                    </div>
                  </div>
                  {minutes > 0 && (
                    <div className="mt-2 sm:mt-5 flex justify-center">
                      <span className={cn("font-mono font-black tracking-tighter leading-none text-primary", isMobile ? "text-[11px]" : "text-2xl")}>{formatMinutes(minutes)}</span>
                    </div>
                  )}
                  {isToday && (
                    <div className="absolute bottom-1 right-1.5 sm:bottom-2 sm:right-3">
                      <span className={cn("font-black uppercase tracking-[0.1em] bg-primary text-white px-1.5 py-0.5 rounded-md shadow-sm", isMobile ? "text-[6px]" : "text-[8px]")}>Today</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-5 items-center px-6 py-4 bg-white/80 backdrop-blur-md border shadow-xl rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
         <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-500 fill-yellow-500" /><span>3시간 몰입 달성</span></div>
         <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary/30" /><span>계획 수립 완료</span></div>
         <div className="ml-auto flex items-center gap-2"><Info className="h-4 w-4" /><span>날짜를 클릭해 상세 로그를 확인하세요.</span></div>
      </div>

      <Dialog open={!!selectedDateForPlan} onOpenChange={(open) => !open && setSelectedDateForPlan(null)}>
        <DialogContent className={cn("border-none shadow-2xl p-0 overflow-hidden transition-all duration-500", isMobile ? "fixed bottom-0 top-auto translate-y-0 left-0 right-0 max-w-none rounded-t-[3rem] rounded-b-none" : "sm:max-w-xl rounded-[3.5rem]")}>
          <div className="bg-primary p-10 text-white relative overflow-hidden">
            <Sparkles className="absolute top-0 right-0 p-10 h-48 w-48 opacity-10 rotate-12" />
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-3xl font-black tracking-tighter flex items-center gap-3">
                <ClipboardList className="h-8 w-8 text-accent" /> {selectedDateForPlan && format(selectedDateForPlan, 'M월 d일 (EEEE)', {locale: ko})}
              </DialogTitle>
              <DialogDescription className="text-white/60 font-bold mt-2 text-base">당신의 성장 데이터와 일일 리포트입니다.</DialogDescription>
            </DialogHeader>
          </div>
          
          <div className={cn("bg-[#fafafa] custom-scrollbar", isMobile ? "max-h-[60vh] overflow-y-auto" : "max-h-[600px] overflow-y-auto")}>
            {selectedDateForPlan && dailyPlans.length === 0 && isActuallyPast ? (
              <div className="py-24 text-center flex flex-col items-center gap-6 opacity-30">
                <CalendarX className="h-20 w-20" />
                <p className="font-black italic text-lg tracking-tight">작성된 기록이 발견되지 않았습니다.</p>
              </div>
            ) : (
              <Tabs defaultValue="schedule" className="w-full">
                <TabsList className="grid w-full grid-cols-3 rounded-none h-16 bg-muted/20 p-0 border-b">
                  <TabsTrigger value="schedule" className="data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-primary font-black text-sm transition-all tracking-widest">ROUTINE</TabsTrigger>
                  <TabsTrigger value="study" className="data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-emerald-500 font-black text-sm transition-all tracking-widest">STUDY</TabsTrigger>
                  <TabsTrigger value="personal" className="data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-amber-500 font-black text-sm transition-all tracking-widest">LIFE</TabsTrigger>
                </TabsList>

                <div className="p-8 space-y-8">
                  <TabsContent value="schedule" className="mt-0 space-y-4">
                    <div className="flex justify-between items-center px-1 mb-2">
                      <h4 className="text-[10px] font-black uppercase text-primary/40 tracking-widest">Today's Routine</h4>
                      {!isActuallyPast && (
                        <Dialog open={isRoutineModalOpen} onOpenChange={setIsRoutineModalOpen}>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 rounded-lg font-black text-[10px] gap-1 hover:bg-primary/5">
                              <Plus className="h-3 w-3" /> 추가
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-[2rem] border-none shadow-2xl p-8">
                            <DialogHeader>
                              <DialogTitle className="text-2xl font-black tracking-tighter">새 루틴 추가</DialogTitle>
                              <DialogDescription className="font-bold pt-1">고정 일정을 추가하세요.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-6 pt-4">
                              <div className="grid gap-2">
                                <Label className="text-[10px] font-black uppercase text-primary/70 ml-1">루틴 이름</Label>
                                <Input placeholder="예: 영어 학원, 점심 시간" value={newRoutineTitle} onChange={(e) => setNewRoutineTitle(e.target.value)} className="h-14 rounded-xl border-2 font-bold" />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {['점심', '저녁', '학원', '독서실'].map(tag => (
                                  <Badge key={tag} variant="secondary" className="cursor-pointer hover:bg-primary hover:text-white transition-colors py-1.5 px-3 rounded-lg font-black" onClick={() => setNewRoutineTitle(tag)}>+{tag}</Badge>
                                ))}
                              </div>
                            </div>
                            <DialogFooter className="pt-6">
                              <Button onClick={() => handleAddTask(newRoutineTitle, 'schedule')} disabled={!newRoutineTitle.trim() || isSubmitting} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">
                                {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : '루틴 생성하기'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                    {scheduleItems.length === 0 ? (
                      <p className="text-center py-6 text-xs font-bold text-muted-foreground/40 italic">등록된 루틴이 없습니다.</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {scheduleItems.sort((a,b) => {
                          const timeA = a.title.split(': ')[1] || '00:00';
                          const timeB = b.title.split(': ')[1] || '00:00';
                          return timeA.localeCompare(timeB);
                        }).map((item) => (
                          <ScheduleItemRow key={item.id} item={item} onUpdateTime={handleUpdateScheduleTime} onDelete={handleDeleteTask} isPast={isActuallyPast} isMobile={isMobile} />
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="study" className="mt-0 space-y-6">
                    <div className="grid gap-3">
                      {studyTasks.map((task) => (
                        <div key={task.id} className={cn(
                          "flex items-center gap-4 p-4 rounded-[1.25rem] border-2 transition-all duration-500 group relative",
                          task.done ? "bg-emerald-50/20 border-emerald-100/50" : "bg-white border-transparent hover:border-emerald-100 shadow-sm"
                        )}>
                          <Checkbox id={task.id} checked={task.done} onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} disabled={isActuallyPast} className="h-6 w-6 rounded-lg border-2 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" />
                          <Label htmlFor={task.id} className={cn("flex-1 text-base font-bold transition-all", task.done && "line-through text-muted-foreground opacity-40")}>{task.title}</Label>
                          {!isActuallyPast && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all rounded-full" onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {!isActuallyPast && (
                      <div className="pt-4">
                        <div className="relative flex items-center bg-white border-2 border-emerald-100 rounded-[1.5rem] group focus-within:border-emerald-500 transition-all p-1 shadow-md">
                          <Input 
                            placeholder="공부 계획 추가..." 
                            value={newStudyTask} 
                            onChange={(e) => setNewStudyTask(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newStudyTask, 'study')} 
                            disabled={isSubmitting} 
                            className="border-none bg-transparent shadow-none focus-visible:ring-0 font-bold h-11 text-sm" 
                          />
                          <Button 
                            size="icon" 
                            onClick={() => handleAddTask(newStudyTask, 'study')} 
                            disabled={isSubmitting || !newStudyTask.trim()} 
                            className="h-10 w-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shrink-0 shadow-lg mr-0.5"
                          >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="personal" className="mt-0 space-y-6">
                    <div className="grid gap-3">
                      {personalTasks.map((task) => (
                        <div key={task.id} className={cn(
                          "flex items-center gap-4 p-4 rounded-[1.25rem] border-2 transition-all duration-500 group relative",
                          task.done ? "bg-amber-50/20 border-amber-100/50" : "bg-white border-transparent hover:border-amber-100 shadow-sm"
                        )}>
                          <Checkbox id={task.id} checked={task.done} onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} disabled={isActuallyPast} className="h-6 w-6 rounded-lg border-2 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500" />
                          <Label htmlFor={task.id} className={cn("flex-1 text-base font-bold transition-all", task.done && "line-through text-muted-foreground opacity-40")}>{task.title}</Label>
                          {!isActuallyPast && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all rounded-full" onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {!isActuallyPast && (
                      <div className="pt-4">
                        <div className="relative flex items-center bg-white border-2 border-amber-100 rounded-[1.5rem] group focus-within:border-amber-500 transition-all p-1 shadow-md">
                          <Input 
                            placeholder="개인 일정 추가..." 
                            value={newPersonalTask} 
                            onChange={(e) => setNewPersonalTask(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newPersonalTask, 'personal')} 
                            disabled={isSubmitting} 
                            className="border-none bg-transparent shadow-none focus-visible:ring-0 font-bold h-11 text-sm" 
                          />
                          <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={() => handleAddTask(newPersonalTask, 'personal')} 
                            disabled={isSubmitting || !newPersonalTask.trim()} 
                            className="h-10 w-10 rounded-xl border-2 border-amber-500 text-amber-600 hover:bg-amber-50 shrink-0 shadow-lg mr-0.5"
                          >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            )}
          </div>
          
          <DialogFooter className="p-8 bg-white border-t flex-col gap-3">
            {!isActuallyPast && selectedDateForPlan && dailyPlans.length > 0 && (
              <Button variant="outline" className="w-full h-14 rounded-2xl gap-3 text-sm font-black border-2 shadow-sm hover:bg-primary hover:text-white transition-all active:scale-95" onClick={handleApplyToAllWeekdays} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin"/> : <Copy className="h-5 w-5" />}
                이 일정을 매주 {weekdayName}에 반복 설정
              </Button>
            )}
            <Button variant="ghost" className="w-full h-12 rounded-2xl font-black text-sm text-muted-foreground" onClick={() => setSelectedDateForPlan(null)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
