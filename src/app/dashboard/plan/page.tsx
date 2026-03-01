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

function ScheduleItemRow({ item, onUpdateTime, onDelete, isPast, isMobile }: any) {
  const [titlePart, timePart] = item.title.split(': ');
  
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

  const handleAddTask = async (title: string, category: 'study' | 'personal' | 'schedule', defaultTime?: string) => {
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
      const finalTitle = category === 'schedule' ? `${title.trim()}: ${defaultTime || '09:00'}` : title.trim();
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

  const handleUpdateScheduleTime = async (itemId: string, baseTitle: string, timeValue: string, periodValue: '오전' | '오후') => {
    if (isPast || !firestore || !user || !activeMembership || !weekKey) return;
    
    const formattedTime = to24h(timeValue, periodValue);
    const docRef = doc(
      firestore,
      'centers',
      activeMembership.id,
      'plans',
      user.uid,
      'weeks',
      weekKey,
      'items',
      itemId
    );

    await updateDoc(docRef, {
      title: `${baseTitle}: ${formattedTime}`,
      updatedAt: serverTimestamp(),
    });
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

      <div className={cn("grid grid-cols-7 gap-2", isMobile ? "px-1" : "gap-4")}>
        {weekDays.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          return (
            <Button
              key={day.toISOString()}
              variant={isSelected ? "default" : "outline"}
              className={cn(
                "flex flex-col transition-all duration-500 rounded-[1.5rem] sm:rounded-[2.5rem] border-2 h-auto py-4",
                isMobile ? "px-0" : "px-4",
                isSelected ? "bg-primary border-primary shadow-xl scale-105 z-10" : "bg-white border-transparent hover:border-primary/20",
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
                isMobile ? "text-lg" : "text-2xl",
                isSelected ? "text-white" : "text-primary"
              )}>
                {format(day, 'd')}
              </span>
              {isToday && (
                <div className={cn(
                  "w-1 h-1 rounded-full mt-1.5",
                  isSelected ? "bg-accent" : "bg-primary"
                )} />
              )}
            </Button>
          );
        })}
      </div>

      <div className={cn("grid gap-8", isMobile ? "grid-cols-1" : "md:grid-cols-12")}>
        <Card className={cn("border-none shadow-xl rounded-[2.5rem] overflow-hidden bg-white ring-1 ring-black/[0.02]", isMobile ? "md:col-span-12" : "md:col-span-5")}>
          <CardHeader className={cn("bg-muted/5 border-b", isMobile ? "p-6" : "p-8")}>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className={cn("flex items-center gap-3 font-black tracking-tighter text-primary", isMobile ? "text-xl" : "text-2xl")}>
                  <div className="bg-primary/5 p-2 rounded-xl"><Clock className="h-5 w-5 text-primary" /></div>
                  생활 루틴
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Routine Management</CardDescription>
              </div>
              {!isPast && (
                <Dialog open={isRoutineModalOpen} onOpenChange={setIsRoutineModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-primary/10 hover:text-primary transition-all">
                      <PlusCircle className="h-6 w-6" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-black tracking-tighter">새 루틴 추가</DialogTitle>
                      <CardDescription className="font-bold pt-1">고정 일정을 추가해 보세요.</CardDescription>
                    </DialogHeader>
                    <div className="space-y-6 pt-4">
                      <div className="grid gap-2">
                        <Label className="text-[10px] font-black uppercase text-primary/70 ml-1">루틴 이름</Label>
                        <Input 
                          placeholder="예: 영어 학원, 점심 시간" 
                          value={newRoutineTitle} 
                          onChange={(e) => setNewRoutineTitle(e.target.value)}
                          className="h-14 rounded-xl border-2 font-bold"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {['점심', '저녁', '학원', '독서실'].map(tag => (
                          <Badge 
                            key={tag} 
                            variant="secondary" 
                            className="cursor-pointer hover:bg-primary hover:text-white transition-colors py-1.5 px-3 rounded-lg font-black"
                            onClick={() => setNewRoutineTitle(tag)}
                          >
                            +{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <DialogFooter className="pt-6">
                      <Button 
                        onClick={() => handleAddTask(newRoutineTitle, 'schedule')} 
                        disabled={!newRoutineTitle.trim() || isSubmitting}
                        className="w-full h-14 rounded-2xl font-black text-lg shadow-xl"
                      >
                        {isSubmitting ? <Loader2 className="animate-spin h-5 w-5" /> : '루틴 생성하기'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent className={cn("bg-[#fafafa] flex flex-col gap-3.5", isMobile ? "p-5" : "p-8")}>
            {isLoading ? (
              <div className="py-10 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-primary opacity-20" /></div>
            ) : scheduleItems.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center gap-3 opacity-20 italic font-black">
                <Clock className="h-12 w-12" />
                <p className="text-sm">등록된 루틴이 없습니다.</p>
              </div>
            ) : (
              scheduleItems.sort((a,b) => {
                const timeA = a.title.split(': ')[1] || '00:00';
                const timeB = b.title.split(': ')[1] || '00:00';
                return timeA.localeCompare(timeB);
              }).map((item) => (
                <ScheduleItemRow 
                  key={item.id}
                  item={item}
                  onUpdateTime={handleUpdateScheduleTime}
                  onDelete={handleDeleteTask}
                  isPast={isPast}
                  isMobile={isMobile}
                />
              ))
            )}
          </CardContent>
        </Card>

        <div className={cn(isMobile ? "md:col-span-12" : "md:col-span-7")}>
          <Tabs defaultValue="study" className="w-full">
            <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/[0.02]">
              <CardHeader className="p-0 border-b bg-muted/5">
                <TabsList className="w-full justify-start rounded-none bg-transparent h-20 p-0 gap-0">
                  <TabsTrigger 
                    value="study" 
                    className="flex-1 h-full data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600 transition-all font-black text-xs sm:text-base uppercase tracking-widest"
                  >
                    학습 To-do
                  </TabsTrigger>
                  <TabsTrigger 
                    value="personal" 
                    className="flex-1 h-full data-[state=active]:bg-white rounded-none border-b-4 border-transparent data-[state=active]:border-amber-500 data-[state=active]:text-amber-600 transition-all font-black text-xs sm:text-base uppercase tracking-widest"
                  >
                    개인 일정
                  </TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent className={cn("min-h-[450px] bg-[#fafafa]", isMobile ? "p-5" : "p-10")}>
                <TabsContent value="study" className="mt-0 space-y-6">
                  <div className="space-y-4">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] italic">Syncing Matrix...</p>
                      </div>
                    ) : studyTasks.length === 0 && isPast ? (
                      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground/20 gap-6">
                         <CalendarX className="h-20 w-20" />
                         <p className="text-lg font-black italic tracking-tighter">작성된 기록이 없습니다.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {studyTasks.map((task) => (
                          <div key={task.id} className={cn(
                            "flex items-center gap-4 p-4 rounded-[1.25rem] border-2 transition-all duration-500 group relative",
                            task.done ? "bg-emerald-50/30 border-emerald-100/50" : "bg-white border-transparent hover:border-emerald-100 shadow-sm"
                          )}>
                            <Checkbox 
                              id={task.id} 
                              checked={task.done} 
                              onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} 
                              disabled={isPast}
                              className="h-6 w-6 rounded-lg border-2 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 shadow-sm shrink-0"
                            />
                            <Label 
                              htmlFor={task.id}
                              className={cn(
                                "flex-1 font-bold leading-tight transition-all duration-500",
                                isMobile ? "text-base" : "text-lg",
                                !isPast && "cursor-pointer",
                                task.done && "line-through text-muted-foreground/40 italic"
                              )}
                            >
                              {task.title}
                            </Label>
                            {!isPast && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all rounded-full shrink-0" onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {!isPast && (
                      <div className="pt-4">
                        <div className="relative flex items-center bg-white border-2 border-emerald-100 rounded-[1.5rem] group focus-within:border-emerald-500 transition-all p-1 shadow-md">
                          <Input 
                            placeholder="공부 계획 추가..." 
                            value={newStudyTask}
                            onChange={(e) => setNewStudyTask(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newStudyTask, 'study')}
                            disabled={isSubmitting}
                            className={cn(
                              "border-none bg-transparent shadow-none focus-visible:ring-0 font-bold h-11",
                              isMobile ? "text-sm" : "text-base"
                            )}
                          />
                          <Button 
                            size="icon" 
                            onClick={() => handleAddTask(newStudyTask, 'study')} 
                            disabled={isSubmitting || !newStudyTask.trim()} 
                            className="rounded-xl h-10 w-10 bg-emerald-500 hover:bg-emerald-600 text-white shrink-0 shadow-lg active:scale-95 transition-all mr-0.5"
                          >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="personal" className="mt-0 space-y-6">
                  <div className="space-y-4">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] italic">Loading Routine...</p>
                      </div>
                    ) : personalTasks.length === 0 && isPast ? (
                      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground/20 gap-6">
                         <CalendarX className="h-20 w-20" />
                         <p className="text-lg font-black italic tracking-tighter">기록된 일정이 없습니다.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {personalTasks.map((task) => (
                          <div key={task.id} className={cn(
                            "flex items-center gap-4 p-4 rounded-[1.25rem] border-2 transition-all duration-500 group relative",
                            task.done ? "bg-amber-50/30 border-amber-100/50" : "bg-white border-transparent hover:border-amber-100 shadow-sm"
                          )}>
                            <Checkbox 
                              id={task.id} 
                              checked={task.done} 
                              onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} 
                              disabled={isPast}
                              className="h-6 w-6 rounded-lg border-2 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500 shadow-sm shrink-0"
                            />
                            <Label 
                              htmlFor={task.id}
                              className={cn(
                                "flex-1 font-bold leading-tight transition-all duration-500",
                                isMobile ? "text-base" : "text-lg",
                                !isPast && "cursor-pointer",
                                task.done && "line-through text-muted-foreground/40 italic"
                              )}
                            >
                              {task.title}
                            </Label>
                            {!isPast && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all rounded-full shrink-0" onClick={() => handleDeleteTask(task as WithId<StudyPlanItem>)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {!isPast && (
                      <div className="pt-4">
                        <div className="relative flex items-center bg-white border-2 border-amber-100 rounded-[1.5rem] group focus-within:border-amber-500 transition-all p-1 shadow-md">
                          <Input 
                            placeholder="개인 일정 추가..." 
                            value={newPersonalTask}
                            onChange={(e) => setNewPersonalTask(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTask(newPersonalTask, 'personal')}
                            disabled={isSubmitting}
                            className={cn(
                              "border-none bg-transparent shadow-none focus-visible:ring-0 font-bold h-11",
                              isMobile ? "text-sm" : "text-base"
                            )}
                          />
                          <Button 
                            variant="outline"
                            size="icon" 
                            onClick={() => handleAddTask(newPersonalTask, 'personal')} 
                            disabled={isSubmitting || !newPersonalTask.trim()} 
                            className="rounded-xl h-10 w-10 border-2 border-amber-500 text-amber-600 hover:bg-amber-50 shrink-0 shadow-lg active:scale-95 transition-all mr-0.5"
                          >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </CardContent>
              <div className={cn("bg-muted/10 border-t flex flex-col sm:flex-row items-center justify-between gap-6", isMobile ? "p-6" : "p-8")}>
                <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md px-5 py-2.5 rounded-2xl border shadow-sm ring-1 ring-black/[0.02]">
                  <CalendarCheck className="h-4 w-4 text-primary animate-pulse" />
                  <p className="text-[11px] font-black text-primary/70 uppercase tracking-widest">
                    {format(selectedDate, 'yyyy. MM. dd (EEEE)', { locale: ko })}
                  </p>
                </div>
                {!isPast && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="rounded-[1.25rem] gap-2.5 text-[11px] font-black h-12 px-6 border-2 shadow-sm hover:bg-primary hover:text-white transition-all active:scale-95 group w-full sm:w-auto" 
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
      
      <footer className="px-4 py-10">
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
