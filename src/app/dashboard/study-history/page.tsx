'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, orderBy, addDoc, serverTimestamp, doc, updateDoc, getISOWeek, deleteDoc } from 'firebase/firestore';
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
  subMonths 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Zap, Plus, CheckCircle2, Circle, CalendarPlus, Trash2, Clock, MapPin, Coffee, School, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/dialog";
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateForPlan, setSelectedDateForPlan] = useState<Date | null>(null);
  
  const [newStudyTask, setNewStudyTask] = useState('');
  const [newPersonalTask, setNewPersonalTask] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const studyLogsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days'),
      orderBy('dateKey', 'desc')
    );
  }, [firestore, user, activeMembership]);

  const { data: logs, isLoading: logsLoading } = useCollection<StudyLogDay>(studyLogsQuery);

  const monthKey = format(currentDate, "yyyy-'W'II");
  const plansQuery = useMemoFirebase(() => {
    if (!firestore || !user || !activeMembership) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', monthKey, 'items')
    );
  }, [firestore, user, activeMembership, monthKey]);
  
  const { data: allPlans } = useCollection<StudyPlanItem>(plansQuery);

  const selectedDateKey = selectedDateForPlan ? format(selectedDateForPlan, 'yyyy-MM-dd') : null;
  
  const dailyPlans = useMemo(() => {
    if (!allPlans || !selectedDateKey) return [];
    return allPlans.filter(p => p.dateKey === selectedDateKey);
  }, [allPlans, selectedDateKey]);

  const scheduleItems = dailyPlans.filter(p => p.category === 'schedule');
  const personalTasks = dailyPlans.filter(p => p.category === 'personal');
  const studyTasks = dailyPlans.filter(p => p.category === 'study' || !p.category);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

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

  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const monthTotalMinutes = useMemo(() => {
    if (!logs) return 0;
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

  const handleUpdateSchedule = async (title: string, value: string) => {
    if (!firestore || !user || !activeMembership || !selectedDateForPlan) return;
    
    const dateKey = format(selectedDateForPlan, 'yyyy-MM-dd');
    const weekKey = format(selectedDateForPlan, "yyyy-'W'II");
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
        title: `${title}: ${value}`,
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(itemsCollectionRef, {
        title: `${title}: ${value}`,
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

  const getScheduleValue = (title: string) => {
    const found = scheduleItems.find(p => p.title.startsWith(title));
    if (!found) return '';
    return found.title.split(': ')[1] || '';
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-headline font-bold">학습 기록</h1>
          <p className="text-muted-foreground">날짜를 클릭하여 그날의 체계적인 학습 계획을 세워보세요.</p>
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
            ) : days.map((day, idx) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const log = logs?.find(l => l.dateKey === dateKey);
              const minutes = log?.totalMinutes || 0;
              const hasPlans = allPlans?.some(p => p.dateKey === dateKey);
              
              const isCurrentMonth = isSameMonth(day, currentDate);
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
              {selectedDateForPlan && format(selectedDateForPlan, 'yyyy년 M월 d일')} 계획
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80 text-sm">
              상세 학습 및 생활 계획을 체계적으로 관리하세요.
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="schedule" className="w-full">
            <TabsList className="grid w-full grid-cols-3 rounded-none bg-muted/50 p-0 h-12">
              <TabsTrigger value="schedule" className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary transition-all">시간표</TabsTrigger>
              <TabsTrigger value="study" className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary transition-all">자습 To-do</TabsTrigger>
              <TabsTrigger value="personal" className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary transition-all">개인 일정</TabsTrigger>
            </TabsList>

            <div className="max-h-[60vh] overflow-y-auto p-6 space-y-6">
              <TabsContent value="schedule" className="mt-0 space-y-4">
                <div className="grid gap-4">
                  {SCHEDULE_TEMPLATES.map((tpl) => (
                    <div key={tpl.title} className="flex items-center gap-3 bg-muted/20 p-3 rounded-xl border group hover:border-primary/50 transition-all">
                      <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                        <tpl.icon className="h-4 w-4 text-primary" />
                      </div>
                      <Label className="flex-1 font-bold text-sm">{tpl.title}</Label>
                      <Input 
                        placeholder="00:00"
                        className="w-24 h-9 text-center bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                        defaultValue={getScheduleValue(tpl.title)}
                        onBlur={(e) => handleUpdateSchedule(tpl.title, e.target.value)}
                      />
                    </div>
                  ))}
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
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
                </div>
              </TabsContent>
            </div>
          </Tabs>
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
           <InfoIcon className="h-3 w-3" />
           <span>날짜를 클릭하여 체계적인 일별 학습 계획을 관리하세요.</span>
         </div>
      </div>
    </div>
  );
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
