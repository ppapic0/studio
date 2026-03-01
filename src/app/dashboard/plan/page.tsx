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
  ListTodo
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

const SCHEDULE_TEMPLATES = [
  { title: '등원 시간', icon: MapPin },
  { title: '하원 시간', icon: School },
  { title: '점심 시간', icon: Coffee },
  { title: '저녁 시간', icon: Coffee },
  { title: '학원 시간', icon: Clock },
];

/**
 * 시간표 항목의 로컬 상태를 관리하는 컴포넌트
 */
function ScheduleItemRow({ tpl, scheduleItems, onUpdate, isPast, isMobile }: any) {
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
    <div className={cn(
      "flex flex-col gap-1.5 transition-all border group",
      isMobile ? "p-2.5 rounded-[1.25rem] bg-white shadow-sm border-primary/5" : "p-3 rounded-xl bg-muted/20 hover:border-primary/50"
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          "rounded-lg transition-colors",
          isMobile ? "bg-primary/5 p-1.5" : "bg-primary/10 p-2 group-hover:bg-primary/20"
        )}>
          <tpl.icon className={cn("text-primary", isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
        </div>
        <Label className={cn("flex-1 font-bold", isMobile ? "text-xs" : "text-sm")}>{tpl.title}</Label>
        {isPast ? (
          <span className={cn("font-mono font-black text-primary", isMobile ? "text-xs" : "text-sm")}>
            {localTime ? `${localPeriod} ${localTime}` : '-'}
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
             <Select value={localPeriod} onValueChange={handlePeriodChange}>
               <SelectTrigger className={cn("border-none bg-transparent font-black px-1 focus:ring-0", isMobile ? "w-[60px] h-8 text-[10px]" : "w-[75px] h-9 text-xs")}>
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="오전">오전</SelectItem>
                 <SelectItem value="오후">오후</SelectItem>
               </SelectContent>
             </Select>
             <Input 
              placeholder="00:00"
              className={cn(
                "text-center bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary shadow-inner p-0 font-mono font-black",
                isMobile ? "w-14 h-8 text-[11px]" : "w-16 h-9"
              )}
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
    if (isNaN(hours) || isNaN(mins)) return time12h;
    
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
        <Card className="max-w-md w-full rounded-[2rem] border-none shadow-2xl">
          <CardHeader>
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
    <div className={cn("flex flex-col w-full max-w-5xl mx-auto pb-24", isMobile ? "gap-4 px-1" : "gap-8")}>
      <header className={cn("flex flex-col", isMobile ? "gap-1 px-1" : "gap-2")}>
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className={cn("font-black tracking-tighter text-primary leading-none", isMobile ? "text-2xl" : "text-4xl")}>나의 학습 계획</h1>
            <p className={cn("font-bold text-muted-foreground mt-1", isMobile ? "text-[10px] uppercase tracking-widest" : "text-sm")}>
              {isPast ? 'Past records and archive' : 'Daily Study Matrix & Routine'}
            </p>
          </div>
          {isPast && (
            <Badge variant="destructive" className="rounded-full font-black text-[10px] px-2.5">수정 불가</Badge>
          )}
        </div>
      </header>

      {/* 주간 날짜 선택 스트립 */}
      <div className={cn("grid grid-cols-7 gap-1.5", isMobile ? "px-1" : "gap-3")}>
        {weekDays.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          return (
            <Button
              key={day.toISOString()}
              variant={isSelected ? "default" : "outline"}
              className={cn(
                "flex flex-col transition-all duration-500 rounded-2xl sm:rounded-3xl border-2",
                isMobile ? "h-16 px-0" : "h-24 px-4",
                isSelected ? "bg-primary border-primary shadow-xl shadow-primary/20 scale-105" : "bg-white border-transparent hover:border-primary/20",
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
                  "w-1 h-1 rounded-full mt-1.5 animate-pulse",
                  isSelected ? "bg-accent" : "bg-primary"
                )} />
              )}
            </Button>
          );
        })}
      </div>

      <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "md:grid-cols-12")}>
        {/* 일일 시간표 카드 */}
        <Card className={cn("border-none shadow-2xl rounded-[2rem] overflow-hidden bg-white ring-1 ring-black/[0.03]", isMobile ? "md:col-span-12" : "md:col-span-5")}>
          <CardHeader className={cn("bg-muted/10 border-b", isMobile ? "p-5" : "p-8")}>
            <CardTitle className={cn("flex items-center gap-2 font-black tracking-tighter text-primary", isMobile ? "text-lg" : "text-xl")}>
              <Clock className="h-5 w-5 opacity-40" />
              생활 루틴
            </CardTitle>
            <CardDescription className="text-[9px] font-bold uppercase tracking-widest">Daily Schedule Management</CardDescription>
          </CardHeader>
          <CardContent className={cn("bg-[#fafafa]", isMobile ? "p-4 space-y-2.5" : "p-8 space-y-4")}>
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
            <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.03]">
              <CardHeader className="p-0 border-b bg-muted/10">
                <TabsList className="w-full justify-start rounded-none bg-transparent h-16 p-0 gap-0">
                  <TabsTrigger 
                    value="study" 
                    className="flex-1 h-full data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-primary transition-all font-black text-xs sm:text-sm uppercase tracking-tighter"
                  >
                    학습 To-do
                  </TabsTrigger>
                  <TabsTrigger 
                    value="personal" 
                    className="flex-1 h-full data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-primary transition-all font-black text-xs sm:text-sm uppercase tracking-tighter"
                  >
                    개인 일정
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className={cn("min-h-[400px]", isMobile ? "p-5" : "p-10")}>
                <TabsContent value="study" className="mt-0 space-y-6">
                  <div className="space-y-3">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Accessing matrix...</p>
                      </div>
                    ) : studyTasks.length === 0 && isPast ? (
                      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/30 gap-4">
                         <CalendarX className="h-16 w-16" />
                         <p className="text-sm font-black italic">기록된 계획이 없습니다.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {studyTasks.map((task) => (
                          <div key={task.id} className={cn(
                            "flex items-center gap-4 p-4 rounded-[1.5rem] border-2 transition-all duration-500 group",
                            task.done ? "bg-emerald-50/20 border-emerald-100/50" : "bg-white border-transparent hover:border-primary/10 shadow-sm"
                          )}>
                            <Checkbox 
                              id={task.id} 
                              checked={task.done} 
                              onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} 
                              disabled={isPast}
                              className="h-6 w-6 rounded-lg border-2 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                            />
                            <Label 
                              htmlFor={task.id}
                              className={cn(
                                "flex-1 font-bold leading-tight transition-all duration-500",
                                isMobile ? "text-sm" : "text-base",
                                !isPast && "cursor-pointer",
                                task.done && "line-through text-muted-foreground/40 italic"
                              )}
                            >
                              {task.title}
                            </Label>
                            {!isPast && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all rounded-full" onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {!isPast && (
                      <div className="flex items-center gap-2 pt-4 relative group">
                        <Input 
                          placeholder="새로운 학습 과제 입력..." 
                          value={newStudyTask}
                          onChange={(e) => setNewStudyTask(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newStudyTask, 'study')}
                          disabled={isSubmitting}
                          className="rounded-2xl border-dashed border-2 h-14 pl-5 pr-14 font-bold text-sm shadow-sm focus-visible:ring-primary/20 transition-all"
                        />
                        <Button 
                          size="icon" 
                          onClick={() => handleAddTask(newStudyTask, 'study')} 
                          disabled={isSubmitting || !newStudyTask.trim()} 
                          className="absolute right-2 h-10 w-10 rounded-xl shadow-xl active:scale-95"
                        >
                          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="personal" className="mt-0 space-y-6">
                  <div className="space-y-3">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Accessing matrix...</p>
                      </div>
                    ) : personalTasks.length === 0 && isPast ? (
                      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/30 gap-4">
                         <CalendarX className="h-16 w-16" />
                         <p className="text-sm font-black italic">기록된 일정이 없습니다.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {personalTasks.map((task) => (
                          <div key={task.id} className={cn(
                            "flex items-center gap-4 p-4 rounded-[1.5rem] border-2 transition-all duration-500 group",
                            task.done ? "bg-amber-50/20 border-amber-100/50" : "bg-white border-transparent hover:border-primary/10 shadow-sm"
                          )}>
                            <Checkbox 
                              id={task.id} 
                              checked={task.done} 
                              onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} 
                              disabled={isPast}
                              className="h-6 w-6 rounded-lg border-2 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                            />
                            <Label 
                              htmlFor={task.id}
                              className={cn(
                                "flex-1 font-bold leading-tight transition-all duration-500",
                                isMobile ? "text-sm" : "text-base",
                                !isPast && "cursor-pointer",
                                task.done && "line-through text-muted-foreground/40 italic"
                              )}
                            >
                              {task.title}
                            </Label>
                            {!isPast && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all rounded-full" onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {!isPast && (
                      <div className="flex items-center gap-2 pt-4 relative group">
                        <Input 
                          placeholder="새로운 개인 일정 입력..." 
                          value={newPersonalTask}
                          onChange={(e) => setNewPersonalTask(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newPersonalTask, 'personal')}
                          disabled={isSubmitting}
                          className="rounded-2xl border-dashed border-2 h-14 pl-5 pr-14 font-bold text-sm shadow-sm focus-visible:ring-primary/20 transition-all"
                        />
                        <Button 
                          variant="outline"
                          size="icon" 
                          onClick={() => handleAddTask(newPersonalTask, 'personal')} 
                          disabled={isSubmitting || !newPersonalTask.trim()} 
                          className="absolute right-2 h-10 w-10 rounded-xl border-2 shadow-sm active:scale-95"
                        >
                          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5 text-primary" />}
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </CardContent>
              <div className="p-6 bg-muted/5 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary opacity-40" />
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    {format(selectedDate, 'yyyy. MM. dd (EEEE)', { locale: ko })}
                  </p>
                </div>
                {!isPast && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="rounded-xl gap-2 text-[10px] font-black h-10 px-5 border-2 shadow-sm active:scale-95 transition-all" 
                    onClick={handleApplyToAllWeekdays}
                    disabled={isSubmitting || !dailyPlans || dailyPlans.length === 0}
                  >
                    {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin"/> : <Copy className="h-3.5 w-3.5" />}
                    매주 {format(selectedDate, 'EEE', { locale: ko })} 반복 설정
                  </Button>
                )}
              </div>
            </Card>
          </Tabs>
        </div>
      </div>
      
      <footer className="px-2 py-4">
        <div className="flex flex-wrap gap-4 items-center justify-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
           <div className="flex items-center gap-1.5">
             <CalendarDays className="h-3 w-3" />
             <span>Real-time Sync with Center</span>
           </div>
           {isPast && (
             <div className="text-destructive flex items-center gap-1.5">
               <Sparkles className="h-3 w-3" />
               <span>Read Only Archive</span>
             </div>
           )}
        </div>
      </footer>
    </div>
  );
}
