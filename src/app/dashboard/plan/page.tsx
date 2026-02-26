'use client';

import { useState, useMemo } from 'react';
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
  Loader2, 
  Plus, 
  Trash2, 
  Copy, 
  CalendarDays, 
  Clock, 
  MapPin, 
  Coffee, 
  School, 
  ClipboardList,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp,
  writeBatch,
  startOfMonth,
  endOfMonth
} from 'firebase/firestore';
import { 
  format, 
  addDays, 
  startOfWeek, 
  isSameDay, 
  getDay,
  eachDayOfInterval
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

export default function StudyPlanPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [newStudyTask, setNewStudyTask] = useState('');
  const [newPersonalTask, setNewPersonalTask] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isStudent = activeMembership?.role === 'student';
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const weekKey = format(selectedDate, "yyyy-'W'II");

  // 현재 선택된 주(Week)의 시작일부터 7일간의 날짜 배열 생성
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return [...Array(7)].map((_, i) => addDays(start, i));
  }, [selectedDate]);

  const planItemsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !activeMembership) return null;
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

  const handleAddTask = async (title: string, category: 'study' | 'personal') => {
    if (!firestore || !user || !activeMembership || !title.trim() || !isStudent) return;
    
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

  const handleUpdateSchedule = async (title: string, value: string) => {
    if (!firestore || !user || !activeMembership || !isStudent) return;
    
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
    if (!firestore || !user || !activeMembership || !isStudent) return;
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
    if (!firestore || !user || !activeMembership || !isStudent) return;
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
    if (!selectedDate || !firestore || !user || !activeMembership || !dailyPlans || dailyPlans.length === 0) return;
    
    setIsSubmitting(true);
    const weekday = getDay(selectedDate);
    const monthDates = eachDayOfInterval({
      start: startOfMonth(selectedDate),
      end: endOfMonth(selectedDate)
    });
    
    const targetDates = monthDates.filter(d => getDay(d) === weekday && !isSameDay(d, selectedDate));
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
        description: `이번 달 모든 ${format(selectedDate, 'EEEE', { locale: ko })}에 계획이 복사되었습니다.`,
      });
    } catch (error) {
      console.error("Error copying plans:", error);
      toast({
        variant: "destructive",
        title: "복사 실패",
        description: "일정을 복사하는 중 오류가 발생했습니다.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScheduleValue = (title: string) => {
    const found = scheduleItems.find(p => p.title.startsWith(title));
    if (!found) return '';
    return found.title.split(': ')[1] || '';
  };

  if (!isStudent) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>학생 전용 페이지</CardTitle>
            <CardDescription>학생 계정으로 로그인해야 학습 계획을 관리할 수 있습니다.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-headline font-bold">나의 학습 계획</h1>
          <p className="text-muted-foreground">일일 시간표와 자습 목표를 체계적으로 관리하세요.</p>
        </div>
      </div>

      {/* 주간 요일 선택기 */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          return (
            <Button
              key={day.toISOString()}
              variant={isSelected ? "default" : "outline"}
              className={cn(
                "flex flex-col h-16 sm:h-20 gap-1 rounded-xl transition-all",
                isSelected && "ring-2 ring-primary ring-offset-2"
              )}
              onClick={() => setSelectedDate(day)}
            >
              <span className="text-[10px] sm:text-xs font-medium uppercase opacity-60">
                {format(day, 'EEE', { locale: ko })}
              </span>
              <span className="text-lg sm:text-xl font-bold">
                {format(day, 'd')}
              </span>
            </Button>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        {/* 왼쪽: 시간표 관리 */}
        <Card className="md:col-span-5 shadow-sm overflow-hidden border-none sm:border">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-primary" />
              일일 시간표
            </CardTitle>
            <CardDescription>생활 루틴을 입력하세요.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            {SCHEDULE_TEMPLATES.map((tpl) => (
              <div key={tpl.title} className="flex items-center gap-3 bg-muted/20 p-3 rounded-xl border group hover:border-primary/50 transition-all">
                <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                  <tpl.icon className="h-4 w-4 text-primary" />
                </div>
                <Label className="flex-1 font-bold text-sm">{tpl.title}</Label>
                <Input 
                  placeholder="00:00"
                  className="w-24 h-9 text-center bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary shadow-sm"
                  value={getScheduleValue(tpl.title)}
                  onChange={(e) => handleUpdateSchedule(tpl.title, e.target.value)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 오른쪽: 자습 및 개인 일정 */}
        <div className="md:col-span-7 flex flex-col gap-6">
          <Tabs defaultValue="study" className="w-full">
            <Card className="shadow-sm border-none sm:border">
              <CardHeader className="p-0 border-b">
                <TabsList className="w-full justify-start rounded-none bg-transparent h-14 p-0">
                  <TabsTrigger 
                    value="study" 
                    className="flex-1 h-full data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary transition-all font-bold"
                  >
                    자습 To-do
                  </TabsTrigger>
                  <TabsTrigger 
                    value="personal" 
                    className="flex-1 h-full data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary transition-all font-bold"
                  >
                    개인 일정
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 min-h-[300px]">
                <TabsContent value="study" className="mt-0 space-y-4">
                  <div className="space-y-3">
                    {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> :
                      studyTasks.map((task) => (
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
                    {isLoading ? <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> :
                      personalTasks.map((task) => (
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
              </CardContent>
              <div className="p-4 bg-muted/30 border-t flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {format(selectedDate, 'yyyy년 M월 d일 (EEEE)', { locale: ko })} 계획
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2 text-xs h-8" 
                  onClick={handleApplyToAllWeekdays}
                  disabled={isSubmitting || !dailyPlans || dailyPlans.length === 0}
                >
                  {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin"/> : <Copy className="h-3 w-3" />}
                  매달 {format(selectedDate, 'EEEE', { locale: ko })} 반복 설정
                </Button>
              </div>
            </Card>
          </Tabs>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-4 items-center px-4 py-3 bg-muted/30 rounded-lg text-[11px] text-muted-foreground">
         <div className="flex items-center gap-1.5">
           <CalendarDays className="h-3 w-3 text-primary" />
           <span>모든 계획은 선생님 및 센터 관리자와 공유됩니다.</span>
         </div>
      </div>
    </div>
  );
}
