'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Activity,
  Clock,
  Loader2,
  Play,
  Zap,
  Square,
  Timer,
  CalendarClock,
  AlertCircle,
  Check,
  CircleDot,
  ListTodo,
  Sparkles,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { DailyStudentStat, StudyPlanItem, WithId, StudyLogDay, GrowthProgress, StudentProfile } from '@/lib/types';
import { doc, collection, query, where, updateDoc, setDoc, serverTimestamp, increment, getDoc, Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '../ui/progress';
import { cn } from '@/lib/utils';

export function StudentDashboard({ isActive }: { isActive: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { 
    activeMembership, 
    isTimerActive, 
    setIsTimerActive, 
    startTime,
    setStartTime,
    viewMode
  } = useAppContext();
  
  const [today, setToday] = useState<Date | null>(null);
  const [localSeconds, setLocalSeconds] = useState(0);
  const isMobile = viewMode === 'mobile';
  
  useEffect(() => {
    setToday(new Date());
  }, []);

  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';
  const weekKey = today ? format(today, "yyyy-'W'II") : '';

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && startTime) {
      setLocalSeconds(Math.floor((Date.now() - startTime) / 1000));
      interval = setInterval(() => {
        setLocalSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setLocalSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, startTime]);

  const progressRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
  }, [firestore, activeMembership?.id, user?.uid]);
  const { data: progress } = useDoc<GrowthProgress>(progressRef, { enabled: isActive });

  const studyLogRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || !todayKey) return null;
    return doc(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days', todayKey);
  }, [firestore, activeMembership, user, todayKey]);
  const { data: todayStudyLog } = useDoc<StudyLogDay>(studyLogRef, { enabled: isActive });

  const allPlansRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || !weekKey || !todayKey) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items'),
      where('dateKey', '==', todayKey)
    );
  }, [firestore, activeMembership, user, weekKey, todayKey]);
  const { data: todayPlans } = useCollection<StudyPlanItem>(allPlansRef, { enabled: isActive });
  
  const scheduleItems = useMemo(() => todayPlans?.filter(p => p.category === 'schedule') || [], [todayPlans]);
  const studyTasks = useMemo(() => todayPlans?.filter(p => p.category === 'study' || !p.category) || [], [todayPlans]);

  const calculateFinalLp = (base: number) => {
    if (!progress) return base;
    const avgStat = Object.values(progress.stats).reduce((a, b) => a + b, 0) / 4;
    const masteryBoost = 1 + (progress.mastery / 100) * 0.10;
    const statBoost = 1 + (avgStat / 100) * 0.10;
    const totalBoost = Math.min(1.20, masteryBoost * statBoost);
    const bonus = Math.min(25, base * (totalBoost - 1));
    return Math.round(base + bonus);
  };

  const handleStudyStartStop = async () => {
    if (!firestore || !user || !activeMembership || !progressRef) return;

    if (isTimerActive) {
      // 종료 로직
      const nowTs = Date.now();
      const sessionMinutes = Math.floor((nowTs - (startTime || nowTs)) / 60000);
      
      const updateData: any = {
        updatedAt: serverTimestamp()
      };

      if (sessionMinutes > 0) {
        // 행동 보상 (성장 LP: 200) - 오늘 첫 100% 달성 시 등 조건 가능하나 일단 단순 시간 비례 합산
        const lpEarned = calculateFinalLp(sessionMinutes); // 예시: 1분당 가중치 적용
        updateData.seasonLp = increment(lpEarned);
        updateData.totalLpEarned = increment(lpEarned);
        updateData['stats.focus'] = increment(sessionMinutes / 1000);
        
        // 6시간 보너스 체크
        const totalNow = (todayStudyLog?.totalMinutes || 0) + sessionMinutes;
        if (totalNow >= 360 && !progress?.dailyLpStatus?.[todayKey]?.bonus6h) {
          const bonusLp = calculateFinalLp(200);
          updateData.seasonLp = increment(lpEarned + bonusLp);
          updateData[`dailyLpStatus.${todayKey}.bonus6h`] = true;
          updateData['stats.resilience'] = increment(0.5);
          toast({ title: "🏆 6시간 초몰입 보너스!", description: `+${bonusLp} LP 획득` });
        }

        // 로그 및 세션 저장
        const batch = writeBatch(firestore);
        batch.set(studyLogRef!, { totalMinutes: increment(sessionMinutes), updatedAt: serverTimestamp() }, { merge: true });
        const sessionRef = doc(collection(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days', todayKey, 'sessions'));
        batch.set(sessionRef, { startTime: Timestamp.fromMillis(startTime!), endTime: Timestamp.fromMillis(nowTs), durationMinutes: sessionMinutes, createdAt: serverTimestamp() });
        batch.update(progressRef, updateData);
        await batch.commit();
      }

      setIsTimerActive(false);
      setStartTime(null);
      toast({ title: "트랙 종료 및 학습 데이터가 동기화되었습니다." });
    } else {
      // 시작 로직
      const nowTs = Date.now();
      setStartTime(nowTs);
      setIsTimerActive(true);

      // 오늘 첫 출석 LP 지급 (200)
      if (!progress?.dailyLpStatus?.[todayKey]?.attendance) {
        const attendanceLp = calculateFinalLp(200);
        await updateDoc(progressRef, {
          seasonLp: increment(attendanceLp),
          totalLpEarned: increment(attendanceLp),
          [`dailyLpStatus.${todayKey}.attendance`]: true,
          'stats.consistency': increment(0.1),
          updatedAt: serverTimestamp()
        });
        toast({ title: "✅ 오늘 첫 입실 완료!", description: `+${attendanceLp} LP가 적립되었습니다.` });
      }
    }
  };

  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (!firestore || !user || !activeMembership || !progressRef || !weekKey) return;
    const itemRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id);
    const nextState = !item.done;
    
    updateDoc(itemRef, { done: nextState, updatedAt: serverTimestamp() });
    
    if (nextState) {
      // 개별 항목 완료 시 소량 상승
      updateDoc(progressRef, { 
        'stats.achievement': increment(0.05),
        updatedAt: serverTimestamp() 
      });

      // 전체 완료 체크 (계획 LP: 200)
      const allDone = studyTasks.every(t => t.id === item.id ? true : t.done);
      if (allDone && !progress?.dailyLpStatus?.[todayKey]?.plan) {
        const planLp = calculateFinalLp(200);
        updateDoc(progressRef, {
          seasonLp: increment(planLp),
          totalLpEarned: increment(planLp),
          [`dailyLpStatus.${todayKey}.plan`]: true,
          updatedAt: serverTimestamp()
        });
        toast({ title: "🎯 오늘의 계획 완벽 달성!", description: `+${planLp} LP 획득` });
      }
    }
  };

  if (!isActive) return null;

  const totalMinutes = (todayStudyLog?.totalMinutes || 0) + Math.floor(localSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  return (
    <div className={cn("flex flex-col gap-6 sm:gap-8 pb-20")}>
      <section className={cn("group relative overflow-hidden bg-primary text-primary-foreground shadow-2xl border-b-8 border-black/20 transition-all rounded-[2.5rem] p-8 sm:rounded-[3rem] sm:p-12")}>
        <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-10 rotate-12 transition-transform duration-700 group-hover:scale-110">
          <Zap className="h-48 w-48 sm:h-64 sm:w-64" />
        </div>
        
        <div className={cn("relative z-10 flex flex-col gap-8", isMobile ? "items-center text-center" : "md:flex-row md:justify-between md:text-left")}>
          <div className="space-y-4">
            <h2 className={cn("font-black tracking-tighter leading-[1.15]", isMobile ? "text-3xl" : "text-5xl")}>
              {isTimerActive ? "몰입의 정점에\n도착하셨네요!" : "오늘의 트랙을\n시작해볼까요?"}
            </h2>
            <div className={cn("flex items-center gap-2 bg-white/10 backdrop-blur-md w-fit px-4 py-2 rounded-full border border-white/10", isMobile ? "mx-auto" : "md:mx-0")}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 whitespace-nowrap">Live Study Tracker</span>
            </div>
          </div>
          
          <div className={cn("flex flex-col sm:flex-row items-center gap-5 sm:gap-6 w-full md:w-auto")}>
            {isTimerActive && (
              <div className={cn("flex flex-col items-center bg-white/10 backdrop-blur-2xl rounded-[2rem] border border-white/10 shadow-2xl shrink-0 w-full sm:w-auto px-8 py-5 sm:px-10 sm:py-6")}>
                <span className="text-[9px] font-black uppercase tracking-[0.25em] opacity-50 mb-1">Session Progress</span>
                <span className="font-mono font-black tracking-tighter tabular-nums text-accent text-5xl leading-none">
                  {Math.floor(localSeconds / 60).toString().padStart(2, '0')}:{(localSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
            )}
            
            <Button size="lg" className={cn("w-full rounded-[2.5rem] font-black transition-all md:w-auto shadow-2xl active:scale-95", isMobile ? "h-16 text-xl" : "h-20 px-12 text-2xl", isTimerActive ? "bg-destructive" : "bg-accent")} onClick={handleStudyStartStop}>
              {isTimerActive ? <>트랙 종료 <Square className="ml-2 h-6 w-6 fill-current" /></> : <>트랙 시작 <Play className="ml-2 h-6 w-6 fill-current" /></>}
            </Button>
          </div>
        </div>
      </section>

      <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-4")}>
        <Card className="border-none shadow-md bg-white rounded-[2rem] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-6 pt-6">
            <CardTitle className="font-black uppercase tracking-widest text-muted-foreground text-xs">오늘의 몰입</CardTitle>
            <div className="bg-primary/5 p-1.5 rounded-lg"><Clock className="h-4 w-4 text-primary/60" /></div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="font-black tracking-tighter text-primary text-4xl">
              {h}<span className="text-sm ml-1.5 opacity-40 font-bold">h</span> {m}<span className="text-sm ml-1.5 opacity-40 font-bold">m</span>
            </div>
            <p className="font-bold text-muted-foreground/60 text-[10px] mt-2.5">목표 시간 대비 {Math.round((totalMinutes/360)*100)}% 달성</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white rounded-[2rem] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-6 pt-6">
            <CardTitle className="font-black uppercase tracking-widest text-muted-foreground text-xs">시즌 러닝 포인트</CardTitle>
            <div className="bg-accent/5 p-1.5 rounded-lg"><Zap className="h-4 w-4 text-accent" /></div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="font-black tracking-tighter text-primary text-4xl">
              {(progress?.seasonLp || 0).toLocaleString()}<span className="text-sm ml-1.5 opacity-40 font-bold">LP</span>
            </div>
            <Progress value={Math.min(100, ((progress?.seasonLp || 0) / 25000) * 100)} className="h-1.5 mt-3" />
          </CardContent>
        </Card>
      </div>

      <div className={cn("grid gap-6 grid-cols-1 lg:grid-cols-3")}>
        <Card className={cn("border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.03] lg:col-span-2")}>
          <CardHeader className="bg-muted/10 border-b p-8">
            <CardTitle className="font-black flex items-center gap-3 tracking-tighter text-3xl">
              <ListTodo className="h-8 w-8 text-primary" /> 오늘의 학습 계획
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid gap-4">
              {studyTasks.length === 0 ? (
                <div className="py-10 text-center opacity-20 italic font-black text-sm">등록된 학습 계획이 없습니다.</div>
              ) : studyTasks.map((task) => (
                <div key={task.id} className={cn("flex items-center gap-5 p-6 rounded-[2rem] border-2 transition-all", task.done ? "bg-emerald-50/20 border-emerald-100/50" : "bg-white border-transparent shadow-sm")}>
                  <Checkbox id={task.id} checked={task.done} onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} className="h-8 w-8 rounded-xl border-2" />
                  <Label htmlFor={task.id} className={cn("flex-1 font-bold text-lg", task.done && "line-through text-muted-foreground/40 italic")}>{task.title}</Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-black/[0.03]">
          <CardHeader className="bg-accent/5 border-b p-8">
            <CardTitle className="font-black flex items-center gap-3 tracking-tighter text-accent">
              <Timer className="h-8 w-8" /> 오늘의 루틴
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-4">
              {scheduleItems.length === 0 ? (
                <div className="py-10 text-center opacity-20 italic font-black text-sm">등록된 루틴이 없습니다.</div>
              ) : scheduleItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-6 rounded-[2rem] bg-muted/20">
                  <span className="font-bold">{item.title.split(': ')[0]}</span>
                  <span className="font-mono font-black text-accent text-lg">{item.title.split(': ')[1] || '--:--'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
