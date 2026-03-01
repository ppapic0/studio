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
  ChevronRight,
  ListTodo,
  Activity
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

const SCHEDULE_TEMPLATES = [
  { title: '등원 시간', icon: MapPin },
  { title: '하원 시간', icon: School },
  { title: '점심 시간', icon: Coffee },
  { title: '저녁 시간', icon: Coffee },
  { title: '학원 시간', icon: Clock },
];

const HOURS = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

/**
 * 시간표 항목의 로컬 상태를 관리하는 컴포넌트 (선택형 UI)
 */
function ScheduleItemRow({ tpl, scheduleItems, onUpdate, isPast, isMobile }: any) {
  const found = scheduleItems.find((p: any) => p.title.startsWith(tpl.title));
  const time24h = found ? found.title.split(': ')[1] : '';
  
  const from24h = (t: string) => {
    if (!t || !t.includes(':')) return { hour: '09', minute: '00', period: '오전' as const };
    let [h, m] = t.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return { hour: '09', minute: '00', period: '오전' as const };
    const p = h >= 12 ? '오후' : '오전';
    let h12 = h % 12 || 12;
    return { 
      hour: h12.toString().padStart(2, '0'), 
      minute: m.toString().padStart(2, '0'), 
      period: p 
    };
  };

  const initial = from24h(time24h);
  const [localHour, setLocalHour] = useState(initial.hour);
  const [localMinute, setLocalMinute] = useState(initial.minute);
  const [localPeriod, setLocalPeriod] = useState(initial.period);

  useEffect(() => {
    const remote = from24h(time24h);
    setLocalHour(remote.hour);
    setLocalMinute(remote.minute);
    setLocalPeriod(remote.period);
  }, [time24h]);

  const handleValueChange = (type: 'hour' | 'minute' | 'period', value: string) => {
    let h = localHour;
    let m = localMinute;
    let p = localPeriod;

    if (type === 'hour') { h = value; setLocalHour(value); }
    if (type === 'minute') { m = value; setLocalMinute(value); }
    if (type === 'period') { p = value as any; setLocalPeriod(p); }

    onUpdate(tpl.title, `${h}:${m}`, p);
  };

  return (
    <div className={cn(
      "flex flex-col gap-2 transition-all border group",
      isMobile ? "p-3 rounded-2xl bg-white shadow-sm border-primary/5" : "p-4 rounded-xl bg-muted/20 hover:border-primary/50"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "rounded-xl transition-all duration-500",
          isMobile ? "bg-primary/5 p-2" : "bg-primary/10 p-2.5 group-hover:bg-primary group-hover:text-white"
        )}>
          <tpl.icon className={cn(isMobile ? "h-4 w-4" : "h-5 w-5")} />
        </div>
        <Label className={cn("flex-1 font-black tracking-tight", isMobile ? "text-xs" : "text-sm")}>{tpl.title}</Label>
        
        {isPast ? (
          <Badge variant="outline" className="font-mono font-black text-primary border-primary/20">
            {time24h ? `${localPeriod} ${localHour}:${localMinute}` : '-'}
          </Badge>
        ) : (
          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border/50">
             <Select value={localPeriod} onValueChange={(v) => handleValueChange('period', v)}>
               <SelectTrigger className={cn("border-none bg-transparent font-black px-2 focus:ring-0 focus:bg-white rounded-lg transition-all", isMobile ? "w-[65px] h-8 text-[10px]" : "w-[75px] h-9 text-xs")}>
                 <SelectValue />
               </SelectTrigger>
               <SelectContent className="rounded-xl border-none shadow-2xl">
                 <SelectItem value="오전">오전</SelectItem>
                 <SelectItem value="오후">오후</SelectItem>
               </SelectContent>
             </Select>

             <div className="w-px h-4 bg-border/50 mx-0.5" />

             <Select value={localHour} onValueChange={(v) => handleValueChange('hour', v)}>
               <SelectTrigger className={cn("border-none bg-transparent font-mono font-black px-2 focus:ring-0 focus:bg-white rounded-lg transition-all", isMobile ? "w-[50px] h-8 text-[11px]" : "w-[60px] h-9 text-sm")}>
                 <SelectValue />
               </SelectTrigger>
               <SelectContent className="rounded-xl border-none shadow-2xl max-h-[200px]">
                 {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
               </SelectContent>
             </Select>

             <span className="text-[10px] font-black opacity-30">:</span>

             <Select value={localMinute} onValueChange={(v) => handleValueChange('minute', v)}>
               <SelectTrigger className={cn("border-none bg-transparent font-mono font-black px-2 focus:ring-0 focus:bg-white rounded-lg transition-all", isMobile ? "w-[50px] h-8 text-[11px]" : "w-[60px] h-9 text-sm")}>
                 <SelectValue />
               </SelectTrigger>
               <SelectContent className="rounded-xl border-none shadow-2xl max-h-[200px]">
                 {MINUTES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
               </SelectContent>
             </Select>
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const scheduleItems = dailyPlans?.filter(p => p.category === 'schedule') || [];
  const personalTasks = dailyPlans?.filter(p => p.category === 'personal') || [];
  const studyTasks = dailyPlans?.filter(p => p.category === 'study' || !p.category) || [];

  const to24h = (time12h: string, period: '오전' | '오후') => {
    if (!time12h || !time12h.includes(':')) return time12h;
    let [hours, mins] = time12h.split(':').map(Number);
    if (isNaN(hours) || iisNaN(mins)) return time12h;
    
    if (period === '오후' && hours < 12) hours += 12;
    if (period === '오전' && hours === 12) hours = 0;
    
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const handleAddTask = async (title: string, category: 'study' | 'personal') => {
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
      await addDoc(itemsCollectionRef, {
        title: title.trim(),
        done: false,
        weight: 1,
        dateKey: selectedDateKey,
        category,
        studyPlanWeekId: weekKey,
        centerId: activeMembership.id,
        studentId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (category === 'study') setNewStudyTask('');
      else setNewPersonalTask('');
    } catch (error) {
      console.error("Error adding task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSchedule = async (title: string, timeValue: string, periodValue: '오전' | '오후') => {
    if (isPast || !firestore || !user || !activeMembership || !isStudent || !weekKey || !selectedDateKey) return;
    
    const formattedTime = to24h(timeValue, periodValue);
    const existing = scheduleItems.find(p => p.title.startsWith(title));
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

    if (existing) {
      const docRef = doc(itemsCollectionRef, existing.id);
      await updateDoc(docRef, {
        title: `${title}: ${formattedTime}`,
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(itemsCollectionRef, {
        title: `${title}: ${formattedTime}`,
        done: false,
        weight: 0,
        dateKey: selectedDateKey,
        category: 'schedule',
        studyPlanWeekId: weekKey,
        centerId: activeMembership.id,
        studentId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (isPast || !firestore || !user || !activeMembership || !isStudent || !weekKey) return;
    const itemRef = doc(
      firestore,
      'centers',
      activeMembership.id,
      'plans',
      user.uid,
      'weeks',
      weekKey,
      'items',
      item.id
    );
    
    updateDoc(itemRef, {
      done: !item.done,
      doneAt: !item.done ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
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
    if (isPast || !firestore || !user || !activeMembership || !isStudent || !weekKey) return;
    const itemRef = doc(
      firestore,
      'centers',
      activeMembership.id,
      'plans',
      user.uid,
      'weeks',
      weekKey,
      'items',
      item.id
    );
    await deleteDoc(itemRef);
  };

  const handleApplyToAllWeekdays = async () => {
    if (isPast || !selectedDate || !firestore || !user || !activeMembership || !dailyPlans || dailyPlans.length === 0) return;
    
    setIsSubmitting(true);
    const weekday = getDay(selectedDate);
    const monthDates = eachDayOfInterval({
      start: startOfMonth(selectedDate),
      end: endOfMonth(selectedDate)
    });
    
    const targetDates = monthDates.filter(d => getDay(d) === weekday && !isSameDay(d, selectedDate) && !isBefore(startOfDay(d), startOfDay(new Date())));
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

        dailyPlans.forEach(plan => {
          const newDocRef = doc(itemsCollectionRef);
          batch.set(newDocRef, {
            title: plan.title,
            done: false,
            weight: plan.weight,
            dateKey: targetDateKey,
            category: plan.category || 'study',
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
        title: "일정 복사 완료",
        description: `이번 달의 남은 ${format(selectedDate, 'EEEE', { locale: ko })}에 계획이 복사되었습니다.`,
      });
    } catch (error) {
      console.error("Error copying plans:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isStudent) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Card className="max-w-md w-full rounded-[2.5rem] border-none shadow-2xl">
          <CardHeader className="text-center">
            <CardTitle className="font-black text-2xl tracking-tighter">학생 전용 페이지</CardTitle>
            <CardDescription className="font-bold">학생 계정으로 로그인해야 학습 계획을 관리할 수 있습니다.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!selectedDate) {
    return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;
  }

  return (
    <div className={cn("flex flex-col w-full max-w-5xl mx-auto pb-24", isMobile ? "gap-4 px-1" : "gap-10")}>
      <header className={cn("flex flex-col", isMobile ? "gap-1 px-1" : "gap-2")}>
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className={cn("font-black tracking-tighter text-primary leading-none", isMobile ? "text-2xl" : "text-4xl")}>나의 학습 계획</h1>
            <p className={cn("font-bold text-muted-foreground mt-1", isMobile ? "text-[10px] uppercase tracking-[0.2em]" : "text-sm")}>
              {isPast ? 'Past records and archive' : 'Daily Study Matrix & Routine'}
            </p>
          </div>
          {isPast && (
            <Badge variant="destructive" className="rounded-full font-black text-[10px] px-3 py-1 shadow-lg shadow-destructive/20 animate-pulse">수정 불가</Badge>
          )}
        </div>
      </header>

      {/* 주간 날짜 선택 스트립 */}
      <div className={cn("grid grid-cols-7 gap-2", isMobile ? "px-1" : "gap-4")}>
        {weekDays.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          return (
            <Button
              key={day.toISOString()}
              variant={isSelected ? "default" : "outline"}
              className={cn(
                "flex flex-col transition-all duration-500 rounded-2xl sm:rounded-[2rem] border-2 h-auto",
                isMobile ? "py-3 px-0" : "py-6 px-4",
                isSelected ? "bg-primary border-primary shadow-[0_15px_35px_rgba(0,0,0,0.15)] scale-105 z-10" : "bg-white border-transparent hover:border-primary/20",
                isToday && !isSelected && "border-primary/30"
              )}
              onClick={() => setSelectedDate(day)}
            >
              <span className={cn(
                "font-black uppercase tracking-widest leading-none",
                isMobile ? "text-[8px] mb-1" : "text-[10px] mb-2",
                isSelected ? "text-white/60" : "text-muted-foreground/40"
              )}>
                {format(day, 'EEE', { locale: ko })}
              </span>
              <span className={cn(
                "font-black tracking-tighter tabular-nums leading-none",
                isMobile ? "text-xl" : "text-3xl",
                isSelected ? "text-white" : "text-primary"
              )}>
                {format(day, 'd')}
              </span>
              {isToday && (
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full mt-2 animate-pulse shadow-glow",
                  isSelected ? "bg-accent" : "bg-primary"
                )} />
              )}
            </Button>
          );
        })}
      </div>

      <div className={cn("grid gap-8", isMobile ? "grid-cols-1" : "md:grid-cols-12")}>
        {/* 일일 시간표 카드 */}
        <Card className={cn("border-none shadow-[0_20px_60px_rgba(0,0,0,0.05)] rounded-[2.5rem] overflow-hidden bg-white ring-1 ring-black/[0.03]", isMobile ? "md:col-span-12" : "md:col-span-5")}>
          <CardHeader className={cn("bg-muted/10 border-b", isMobile ? "p-6" : "p-10")}>
            <CardTitle className={cn("flex items-center gap-3 font-black tracking-tighter text-primary", isMobile ? "text-xl" : "text-2xl")}>
              <div className="bg-primary/5 p-2 rounded-xl"><Clock className="h-5 w-5 text-primary" /></div>
              생활 루틴
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Daily Routine Management</CardDescription>
          </CardHeader>
          <CardContent className={cn("bg-[#fafafa] flex flex-col gap-3", isMobile ? "p-5" : "p-8")}>
            {SCHEDULE_TEMPLATES.map((tpl) => (
              <ScheduleItemRow 
                key={tpl.title}
                tpl={tpl}
                scheduleItems={scheduleItems}
                onUpdate={handleUpdateSchedule}
                isPast={isPast}
                isMobile={isMobile}
              />
            ))}
          </CardContent>
        </Card>

        {/* 투두 리스트 영역 */}
        <div className={cn(isMobile ? "md:col-span-12" : "md:col-span-7")}>
          <Tabs defaultValue="study" className="w-full">
            <Card className="border-none shadow-[0_20px_60px_rgba(0,0,0,0.05)] rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/[0.03]">
              <CardHeader className="p-0 border-b bg-muted/10">
                <TabsList className="w-full justify-start rounded-none bg-transparent h-20 p-0 gap-0">
                  <TabsTrigger 
                    value="study" 
                    className="flex-1 h-full data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-primary transition-all font-black text-xs sm:text-base uppercase tracking-widest"
                  >
                    학습 To-do
                  </TabsTrigger>
                  <TabsTrigger 
                    value="personal" 
                    className="flex-1 h-full data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-primary transition-all font-black text-xs sm:text-base uppercase tracking-widest"
                  >
                    개인 일정
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className={cn("min-h-[450px]", isMobile ? "p-6" : "p-12")}>
                <TabsContent value="study" className="mt-0 space-y-8">
                  <div className="space-y-4">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] italic">Syncing Study Matrix...</p>
                      </div>
                    ) : studyTasks.length === 0 && isPast ? (
                      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground/20 gap-6">
                         <CalendarX className="h-20 w-20" />
                         <p className="text-lg font-black italic tracking-tighter">기록된 계획이 없습니다.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3.5">
                        {studyTasks.map((task) => (
                          <div key={task.id} className={cn(
                            "flex items-center gap-5 p-5 rounded-[2rem] border-2 transition-all duration-500 group relative",
                            task.done ? "bg-emerald-50/20 border-emerald-100/50" : "bg-white border-transparent hover:border-primary/10 shadow-sm"
                          )}>
                            <Checkbox 
                              id={task.id} 
                              checked={task.done} 
                              onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} 
                              disabled={isPast}
                              className="h-7 w-7 rounded-xl border-2 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 shadow-sm shrink-0"
                            />
                            <Label 
                              htmlFor={task.id}
                              className={cn(
                                "flex-1 font-bold leading-relaxed transition-all duration-500",
                                isMobile ? "text-base" : "text-lg",
                                !isPast && "cursor-pointer",
                                task.done && "line-through text-muted-foreground/40 italic"
                              )}
                            >
                              {task.title}
                            </Label>
                            {!isPast && (
                              <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all rounded-full shrink-0" onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}>
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {!isPast && (
                      <div className="flex items-center gap-3 pt-6 relative group">
                        <Input 
                          placeholder="어떤 공부를 시작할까요?" 
                          value={newStudyTask}
                          onChange={(e) => setNewStudyTask(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newStudyTask, 'study')}
                          disabled={isSubmitting}
                          className="rounded-[1.5rem] border-dashed border-2 h-16 pl-6 pr-16 font-bold text-base shadow-inner bg-muted/5 focus-visible:ring-primary/10 transition-all"
                        />
                        <Button 
                          size="icon" 
                          onClick={() => handleAddTask(newStudyTask, 'study')} 
                          disabled={isSubmitting || !newStudyTask.trim()} 
                          className="absolute right-2 h-12 w-12 rounded-[1rem] shadow-xl active:scale-95 bg-primary hover:bg-primary/90 transition-all"
                        >
                          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-6 w-6" />}
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="personal" className="mt-0 space-y-8">
                  <div className="space-y-4">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] italic">Accessing personal flow...</p>
                      </div>
                    ) : personalTasks.length === 0 && isPast ? (
                      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground/20 gap-6">
                         <CalendarX className="h-20 w-20" />
                         <p className="text-lg font-black italic tracking-tighter">기록된 일정이 없습니다.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3.5">
                        {personalTasks.map((task) => (
                          <div key={task.id} className={cn(
                            "flex items-center gap-5 p-5 rounded-[2rem] border-2 transition-all duration-500 group relative",
                            task.done ? "bg-amber-50/20 border-amber-100/50" : "bg-white border-transparent hover:border-primary/10 shadow-sm"
                          )}>
                            <Checkbox 
                              id={task.id} 
                              checked={task.done} 
                              onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} 
                              disabled={isPast}
                              className="h-7 w-7 rounded-xl border-2 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 shadow-sm shrink-0"
                            />
                            <Label 
                              htmlFor={task.id}
                              className={cn(
                                "flex-1 font-bold leading-relaxed transition-all duration-500",
                                isMobile ? "text-base" : "text-lg",
                                !isPast && "cursor-pointer",
                                task.done && "line-through text-muted-foreground/40 italic"
                              )}
                            >
                              {task.title}
                            </Label>
                            {!isPast && (
                              <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all rounded-full shrink-0" onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}>
                                <Trash2 className="h-5 w-5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {!isPast && (
                      <div className="flex items-center gap-3 pt-6 relative group">
                        <Input 
                          placeholder="개인적인 약속이나 일정을 적어주세요" 
                          value={newPersonalTask}
                          onChange={(e) => setNewPersonalTask(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newPersonalTask, 'personal')}
                          disabled={isSubmitting}
                          className="rounded-[1.5rem] border-dashed border-2 h-16 pl-6 pr-16 font-bold text-base shadow-inner bg-muted/5 focus-visible:ring-primary/10 transition-all"
                        />
                        <Button 
                          variant="outline"
                          size="icon" 
                          onClick={() => handleAddTask(newPersonalTask, 'personal')} 
                          disabled={isSubmitting || !newPersonalTask.trim()} 
                          className="absolute right-2 h-12 w-12 rounded-[1rem] border-2 shadow-sm bg-white hover:bg-muted/10 transition-all"
                        >
                          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-6 w-6 text-primary" />}
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </CardContent>
              <div className="p-8 bg-muted/5 border-t flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-3 bg-white/50 backdrop-blur-sm px-5 py-2 rounded-2xl border shadow-sm">
                  <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                  <p className="text-[11px] font-black text-primary/70 uppercase tracking-widest">
                    {format(selectedDate, 'yyyy. MM. dd (EEEE)', { locale: ko })}
                  </p>
                </div>
                {!isPast && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="rounded-[1.25rem] gap-2.5 text-[11px] font-black h-12 px-6 border-2 shadow-xl hover:bg-primary hover:text-white transition-all active:scale-95 group" 
                    onClick={handleApplyToAllWeekdays}
                    disabled={isSubmitting || !dailyPlans || dailyPlans.length === 0}
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Copy className="h-4 w-4 transition-transform group-hover:rotate-12" />}
                    이 달의 모든 {format(selectedDate, 'EEE', { locale: ko })}에 복사
                  </Button>
                )}
              </div>
            </Card>
          </Tabs>
        </div>
      </div>
      
      <footer className="px-4 py-6">
        <div className="flex flex-wrap gap-6 items-center justify-center text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/30">
           <div className="flex items-center gap-2">
             <CalendarDays className="h-3.5 w-3.5" />
             <span>Cloud Encrypted Sync</span>
           </div>
           {isPast ? (
             <div className="text-destructive/60 flex items-center gap-2">
               <Sparkles className="h-3.5 w-3.5" />
               <span>Read Only Archive</span>
             </div>
           ) : (
             <div className="text-emerald-600/60 flex items-center gap-2">
               <Activity className="h-3.5 w-3.5" />
               <span>Ready for Focus</span>
             </div>
           )}
        </div>
      </footer>
    </div>
  );
}
