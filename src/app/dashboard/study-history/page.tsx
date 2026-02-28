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
  CalendarX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

const SCHEDULE_TEMPLATES = [
  { title: '등원 시간', icon: MapPin },
  { title: '하원 시간', icon: School },
  { title: '점심 시간', icon: Coffee },
  { title: '저녁 시간', icon: Coffee },
  { title: '학원 시간', icon: Clock },
];

export default function StudyHistoryPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();
  
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

  const from24h = (time24h: string) => {
    if (!time24h || !time24h.includes(':')) return { time: '', period: '오전' as const };
    let [hours, mins] = time24h.split(':').map(Number);
    if (isNaN(hours) || isNaN(mins)) return { time: '', period: '오전' as const };

    const period = hours >= 12 ? '오후' : '오전';
    let hours12 = hours % 12;
    if (hours12 === 0) hours12 = 12;
    
    return { 
      time: `${hours12.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`, 
      period 
    };
  };

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr || !timeStr.includes(':')) return '-';
    const { time, period } = from24h(timeStr);
    return `${period} ${time}`;
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
    if (minutes < 300) return 'bg-emerald-300 text-emerald-900';
    if (minutes < 480) return 'bg-emerald-500 text-white';
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
        dateKey,
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
    if (!firestore || !user || !activeMembership || !selectedDateForPlan) return;
    
    const dateKey = format(selectedDateForPlan, 'yyyy-MM-dd');
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
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
        dateKey,
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
    if (!firestore || !user || !activeMembership || !selectedDateForPlan) return;
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
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
    await updateDoc(itemRef, {
      done: !item.done,
      doneAt: !item.done ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
    });
  };

  const handleDeleteTask = async (item: WithId<StudyPlanItem>) => {
    if (!firestore || !user || !activeMembership || !selectedDateForPlan) return;
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
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
    if (!selectedDateForPlan || !firestore || !user || !activeMembership || dailyPlans.length === 0 || !currentDate) return;
    
    setIsSubmitting(true);
    const weekday = getDay(selectedDateForPlan);
    const monthDates = eachDayOfInterval({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate)
    });
    
    const targetDates = monthDates.filter(d => getDay(d) === weekday && !isSameDay(d, selectedDateForPlan));
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
        description: `이번 달 모든 ${format(selectedDateForPlan, 'EEEE')}에 계획이 복사되었습니다.`,
      });
    } catch (error) {
      console.error("Error copying plans:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScheduleParts = (title: string) => {
    const found = scheduleItems.find(p => p.title.startsWith(title));
    const time24h = found ? found.title.split(': ')[1] : '';
    return from24h(time24h);
  };

  const isActuallyPast = selectedDateForPlan ? isBefore(startOfDay(selectedDateForPlan), startOfDay(new Date())) : false;
  const weekdayName = selectedDateForPlan ? format(selectedDateForPlan, 'EEEE') : '';

  if (!currentDate) {
    return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-headline font-bold">학습 기록</h1>
          <p className="text-muted-foreground">날짜를 클릭하여 그날의 학습 현황을 확인하거나 새로운 계획을 세워보세요.</p>
        </div>
        <div className="flex items-center gap-4 bg-card p-1 rounded-xl border shadow-sm">
           <Button variant="ghost" size="icon" onClick={prevMonth}>
             <ChevronLeft className="h-5 w-5" />
           </Button>
           <span className="font-bold text-lg min-w-[120px] text-center">
             {format(currentDate, 'yyyy년 M월')}
           </span>
           <Button variant="ghost" size="icon" onClick={nextMonth}>
             <ChevronRight className="h-5 w-5" />
           </Button>
        </div>
      </div>

      <Card className="border-none shadow-xl overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-4">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
             <div className="flex flex-wrap items-center gap-4">
               <div className="flex items-center gap-1.5">
                 <div className="w-3 h-3 bg-emerald-600 rounded-sm" />
                 <span className="text-[10px] font-medium">8시간+</span>
               </div>
               <div className="flex items-center gap-1.5">
                 <div className="w-3 h-3 bg-emerald-300 rounded-sm" />
                 <span className="text-[10px] font-medium">3시간+</span>
               </div>
               <div className="flex items-center gap-1.5 text-muted-foreground/60">
                 <div className="w-3 h-3 bg-white border rounded-sm" />
                 <span className="text-[10px] font-medium">기록 없음</span>
               </div>
             </div>
             <div className="flex items-baseline gap-2">
               <span className="text-sm text-muted-foreground">이달의 총 학습 몰입:</span>
               <span className="text-2xl font-bold text-primary">{formatMinutes(monthTotalMinutes)}</span>
             </div>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-7 border-b bg-muted/10">
            {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
              <div key={day} className={cn(
                "py-3 text-center text-[11px] font-bold uppercase tracking-wider",
                i === 5 ? "text-blue-500" : i === 6 ? "text-red-500" : "text-muted-foreground"
              )}>
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 auto-rows-fr">
            {logsLoading ? (
              <div className="col-span-7 h-[400px] flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
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
                    "min-h-[90px] sm:min-h-[110px] p-2 border-r border-b relative group transition-all cursor-pointer hover:ring-2 hover:ring-primary/30 hover:z-20",
                    !isCurrentMonth ? "bg-muted/10 opacity-20" : getHeatmapColor(minutes),
                    isToday && "ring-2 ring-inset ring-primary z-10"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <span className={cn(
                      "text-xs font-bold",
                      idx % 7 === 5 && isCurrentMonth ? "text-blue-600" : 
                      idx % 7 === 6 && isCurrentMonth ? "text-red-600" : ""
                    )}>
                      {format(day, 'd')}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                      {minutes >= 180 && (
                        <Zap className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      )}
                      {hasPlans && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      )}
                    </div>
                  </div>
                  
                  {minutes > 0 && (
                    <div className="mt-3 flex flex-col items-center justify-center">
                      <span className="text-base sm:text-xl font-mono font-extrabold tracking-tighter">
                        {formatMinutes(minutes)}
                      </span>
                    </div>
                  )}

                  {isToday && (
                    <div className="absolute bottom-1 right-1.5">
                       <span className="text-[9px] font-bold uppercase tracking-tighter bg-primary text-white px-1 rounded">Today</span>
                    </div>
                  )}
                  
                  <div className="absolute bottom-1 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <CalendarPlus className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedDateForPlan} onOpenChange={(open) => !open && setSelectedDateForPlan(null)}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="p-6 bg-primary text-primary-foreground">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ClipboardList className="h-6 w-6" />
              {selectedDateForPlan && format(selectedDateForPlan, 'yyyy년 M월 d일')} 현황
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80 text-sm">
              기록된 학습 및 생활 계획을 확인하세요.
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[60vh] overflow-y-auto bg-background">
            {selectedDateForPlan && dailyPlans.length === 0 && isBefore(selectedDateForPlan, startOfDay(new Date())) ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4">
                <div className="bg-muted p-4 rounded-full">
                  <CalendarX className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-muted-foreground">당일 작성한 계획이 없습니다.</p>
                <p className="text-sm text-muted-foreground/60">학습 계획을 미리 세워 루틴을 관리해보세요.</p>
              </div>
            ) : (
              <Tabs defaultValue="schedule" className="w-full">
                <TabsList className="grid w-full grid-cols-3 rounded-none bg-muted/50 p-0 h-12">
                  <TabsTrigger value="schedule" className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary transition-all">시간표</TabsTrigger>
                  <TabsTrigger value="study" className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary transition-all">자습 To-do</TabsTrigger>
                  <TabsTrigger value="personal" className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary transition-all">개인 일정</TabsTrigger>
                </TabsList>

                <div className="p-6 space-y-6">
                  <TabsContent value="schedule" className="mt-0 space-y-4">
                    <div className="grid gap-4">
                      {SCHEDULE_TEMPLATES.map((tpl) => {
                        const { time, period } = getScheduleParts(tpl.title);
                        if (!time && isActuallyPast) return null;
                        return (
                          <div key={tpl.title} className="flex flex-col gap-1.5 bg-muted/20 p-3 rounded-xl border group hover:border-primary/50 transition-all">
                            <div className="items-center gap-3 flex">
                              <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                                <tpl.icon className="h-4 w-4 text-primary" />
                              </div>
                              <Label className="flex-1 font-bold text-sm">{tpl.title}</Label>
                              {isActuallyPast && time ? (
                                <span className="font-mono font-bold text-primary">{formatDisplayTime(to24h(time, period))}</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Select 
                                    value={period} 
                                    onValueChange={(val: any) => handleUpdateSchedule(tpl.title, time, val)}
                                  >
                                    <SelectTrigger className="w-[70px] h-9 text-xs border-none bg-transparent font-bold">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="오전">오전</SelectItem>
                                      <SelectItem value="오후">오후</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input 
                                    placeholder="00:00"
                                    className="w-16 h-9 text-center bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary shadow-sm p-0 font-mono font-bold"
                                    value={time}
                                    onChange={(e) => handleUpdateSchedule(tpl.title, e.target.value, period)}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {isActuallyPast && scheduleItems.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground py-4">기록된 시간표가 없습니다.</p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="study" className="mt-0 space-y-4">
                    <div className="space-y-3">
                      {studyTasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/10 group hover:shadow-sm transition-all">
                          <Checkbox 
                            id={task.id} 
                            checked={task.done} 
                            onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} 
                            disabled={isActuallyPast}
                          />
                          <Label 
                            htmlFor={task.id}
                            className={cn(
                              "flex-1 text-sm font-medium cursor-pointer transition-all",
                              task.done && "line-through text-muted-foreground opacity-60"
                            )}
                          >
                            {task.title}
                          </Label>
                          {!isActuallyPast && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {!isActuallyPast && (
                        <div className="flex items-center gap-2 pt-2">
                          <Input 
                            placeholder="오늘 할 자습 과제 입력..." 
                            value={newStudyTask}
                            onChange={(e) => setNewStudyTask(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newStudyTask, 'study')}
                            disabled={isSubmitting}
                            className="rounded-xl border-dashed"
                          />
                          <Button size="icon" onClick={() => handleAddTask(newStudyTask, 'study')} disabled={isSubmitting || !newStudyTask.trim()} className="rounded-xl">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {isActuallyPast && studyTasks.length === 0 && (
                         <p className="text-center text-sm text-muted-foreground py-4">기록된 자습 내용이 없습니다.</p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="personal" className="mt-0 space-y-4">
                     <div className="space-y-3">
                      {personalTasks.map((task) => (
                        <div key={task.id} className="flex items-center gap-3 p-3 rounded-xl border bg-accent/5 group hover:shadow-sm transition-all">
                          <Checkbox 
                            id={task.id} 
                            checked={task.done} 
                            onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} 
                            disabled={isActuallyPast}
                          />
                          <Label 
                            htmlFor={task.id}
                            className={cn(
                              "flex-1 text-sm font-medium cursor-pointer",
                              task.done && "line-through text-muted-foreground opacity-60"
                            )}
                          >
                            {task.title}
                          </Label>
                          {!isActuallyPast && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {!isActuallyPast && (
                        <div className="flex items-center gap-2 pt-2">
                          <Input 
                            placeholder="공부 외 개인 일정 입력..." 
                            value={newPersonalTask}
                            onChange={(e) => setNewPersonalTask(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newPersonalTask, 'personal')}
                            disabled={isSubmitting}
                            className="rounded-xl border-dashed"
                          />
                          <Button size="icon" onClick={() => handleAddTask(newPersonalTask, 'personal')} disabled={isSubmitting || !newPersonalTask.trim()} className="rounded-xl" variant="outline">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {isActuallyPast && personalTasks.length === 0 && (
                         <p className="text-center text-sm text-muted-foreground py-4">기록된 개인 일정이 없습니다.</p>
                      )}
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            )}
          </div>
          
          <DialogFooter className="p-4 bg-muted/30 border-t flex-col sm:flex-row gap-2">
            {!isActuallyPast && selectedDateForPlan && dailyPlans.length > 0 && (
              <Button 
                variant="outline" 
                className="w-full sm:w-auto gap-2 text-xs" 
                onClick={handleApplyToAllWeekdays}
                disabled={isSubmitting}
              >
                {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin"/> : <Copy className="h-3 w-3" />}
                이 일정을 이번 달 모든 {weekdayName}에 복사
              </Button>
            )}
            <Button variant="ghost" className="w-full sm:w-auto text-xs" onClick={() => setSelectedDateForPlan(null)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="flex flex-wrap gap-4 items-center px-4 py-3 bg-muted/30 rounded-lg text-[11px] text-muted-foreground">
         <div className="flex items-center gap-1.5">
           <Zap className="h-3 w-3 text-yellow-500" />
           <span>3시간 이상 학습 성공</span>
         </div>
         <div className="flex items-center gap-1.5">
           <div className="w-1.5 h-1.5 rounded-full bg-primary" />
           <span>학습 계획 수립됨</span>
         </div>
         <div className="ml-auto flex items-center gap-1">
           <Info className="h-3 w-3" />
           <span>날짜를 클릭하여 체계적인 일별 학습 현황을 관리하세요.</span>
         </div>
      </div>
    </div>
  );
}
