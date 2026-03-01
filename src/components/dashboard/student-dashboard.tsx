'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Activity,
  ArrowUpRight,
  ClipboardCheck,
  Clock,
  TrendingUp,
  Loader2,
  Play,
  Trophy,
  Zap,
  Square,
  Timer,
  Info,
  CalendarClock,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  CircleDot,
  History,
  RefreshCw,
  ListTodo,
  Sparkles,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { DailyStudentStat, StudyPlanItem, WithId, StudyLogDay, GrowthProgress } from '@/lib/types';
import { doc, collection, query, where, updateDoc, setDoc, serverTimestamp, increment, getDoc } from 'firebase/firestore';
import { format, startOfDay } from 'date-fns';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { Progress } from '../ui/progress';

const RANKS = [
  { name: '챌린저', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', iconColor: 'text-purple-500' },
  { name: '그랜드마스터', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', iconColor: 'text-red-500' },
  { name: '다이아몬드', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', iconColor: 'text-blue-500' },
  { name: '에메랄드', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', iconColor: 'text-emerald-500' },
  { name: '플래티넘', color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200', iconColor: 'text-cyan-500' },
  { name: '골드', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', iconColor: 'text-yellow-500' },
  { name: '실버', color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200', iconColor: 'text-slate-400' },
  { name: '브론즈', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', iconColor: 'text-orange-600' },
] as const;

type MetricType = 'completion' | 'attendance' | 'growth';

const RANK_THRESHOLDS: Record<MetricType, number[]> = {
  completion: [98, 95, 92, 88, 84, 75, 60, 0],
  attendance: [26, 24, 22, 20, 18, 15, 10, 0],
  growth: [50, 40, 30, 20, 10, 5, 0, -50],
};

const AUTO_TERMINATE_SECONDS = 7200; 
const GRACE_PERIOD_SECONDS = 60; 
const getNextLevelXp = (level: number) => 1000 + (level - 1) * 300;

function getRankData(value: number, type: MetricType) {
  const thresholds = RANK_THRESHOLDS[type];
  let rankIndex = thresholds.findIndex(t => value >= t);
  if (rankIndex === -1) rankIndex = RANKS.length - 1;

  const rank = RANKS[rankIndex];
  const nextRank = rankIndex > 0 ? RANKS[rankIndex - 1] : null;
  const nextThreshold = rankIndex > 0 ? thresholds[rankIndex - 1] : thresholds[0];

  return { 
    current: rank, 
    next: nextRank, 
    currentValue: value, 
    nextThreshold,
    rankIndex,
    allThresholds: thresholds
  };
}

function GamifiedStatCard({ 
  title, 
  icon: Icon, 
  value, 
  numericValue,
  dailyValue,
  dailyUnit = '%',
  evolution, 
  isLoading, 
  type,
  gameTitle,
  isMobile
}: { 
  title: string, 
  icon: React.ElementType, 
  value?: string, 
  numericValue: number,
  dailyValue: number,
  dailyUnit?: string,
  evolution?: string, 
  isLoading: boolean,
  type: MetricType,
  gameTitle: string,
  isMobile: boolean
}) {
  const rankData = getRankData(numericValue, type);
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="cursor-pointer group relative overflow-hidden transition-all duration-500 hover:shadow-xl active:scale-95 border-none shadow-md bg-white ring-1 ring-black/[0.03] rounded-[1.5rem] sm:rounded-[2rem]">
          <div className={cn("absolute top-0 left-0 w-1 sm:w-1.5 h-full", rankData.current.iconColor.replace('text-', 'bg-'))} />
          <CardHeader className={cn("flex flex-row items-center justify-between space-y-0", isMobile ? "pb-1 px-3.5 pt-3.5" : "pb-2 px-6 pt-6")}>
            <CardTitle className={cn("font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors whitespace-nowrap", isMobile ? "text-[8px]" : "text-xs")}>{title}</CardTitle>
            <div className={cn("rounded-lg transition-all duration-500 group-hover:scale-110", isMobile ? "p-1" : "p-2", rankData.current.bg)}>
              <Icon className={cn(isMobile ? "h-3 w-3" : "h-4 w-4", rankData.current.color)} />
            </div>
          </CardHeader>
          <CardContent className={isMobile ? "px-3.5 pb-3.5" : "px-6 pb-6"}>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-16 mt-1" />
                <Skeleton className="h-3 w-20 mt-2" />
              </div>
            ) : (
              <>
                <div className={cn("font-black tracking-tighter text-primary truncate", isMobile ? "text-xl" : "text-3xl")}>{value}</div>
                <div className={cn("flex items-center gap-1.5 mt-1.5 flex-nowrap overflow-hidden", isMobile ? "mt-1" : "mt-3")}>
                   <Badge className={cn("font-black rounded-md border-none shadow-sm shrink-0", isMobile ? "text-[7px] px-1 py-0" : "text-[9px] px-2 py-0.5", rankData.current.bg, rankData.current.color)}>
                     {rankData.current.name}
                   </Badge>
                   <span className={cn("font-bold text-muted-foreground/60 whitespace-nowrap truncate", isMobile ? "text-[7px]" : "text-[10px]")}>{evolution}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className={cn("border-none shadow-2xl p-0 transition-all duration-500", isMobile ? "fixed bottom-0 top-auto translate-y-0 left-0 right-0 max-w-none rounded-t-[2.5rem] rounded-b-none" : "sm:max-w-md rounded-[3rem]")}>
        <div className={cn("relative", isMobile ? "p-6 pb-10" : "p-10")}>
          <div className={cn("absolute top-0 left-0 w-full h-40 bg-gradient-to-b opacity-10 -z-10", rankData.current.bg.replace('bg-', 'from-'))} />
          
          <DialogHeader className="items-center text-center">
            <div className={cn("mx-auto rounded-[1.5rem] sm:rounded-[2rem] shadow-2xl bg-white border-4 animate-float", isMobile ? "p-3 mb-3" : "p-6 mb-6", rankData.current.border)}>
              <Trophy className={cn(isMobile ? "h-10 w-10" : "h-16 w-16", rankData.current.color)} />
            </div>
            <DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-2xl" : "text-4xl")}>{gameTitle}</DialogTitle>
            <DialogDescription className={cn("mt-1.5 font-bold text-muted-foreground", isMobile ? "text-sm" : "text-lg")}>
              현재 시즌 등급: <span className={cn("font-black underline underline-offset-4 decoration-2 sm:underline-offset-8 sm:decoration-4", rankData.current.color)}>{rankData.current.name}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className={cn("space-y-6 py-6", isMobile ? "space-y-5 py-5" : "space-y-10 py-10")}>
            <div className={cn("rounded-[2rem] bg-[#fafafa] border border-border/50 shadow-inner space-y-5", isMobile ? "p-5" : "p-8")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/5 p-1.5 rounded-lg">
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.1em] text-primary/60">실시간 현황</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={cn("font-black text-primary font-mono tabular-nums", isMobile ? "text-xl" : "text-3xl")}>{dailyValue.toFixed(0)}</span>
                  <span className="text-[10px] font-black text-primary/40">{dailyUnit}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="relative h-3 w-full bg-white rounded-full overflow-hidden border shadow-sm">
                  <div 
                    className={cn("absolute inset-y-0 left-0 transition-all duration-1000 ease-out rounded-full", rankData.current.iconColor.replace('text-', 'bg-'))}
                    style={{ width: `${Math.min(100, type === 'attendance' ? (dailyValue / 360) * 100 : dailyValue)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest px-0.5">
                  <span>시작</span>
                  <span>목표 {type === 'attendance' ? '360분' : '100%'}</span>
                </div>
              </div>
            </div>

            {rankData.next && (
              <div className="space-y-4 px-1">
                <div className="flex justify-between items-end">
                  <div className="grid gap-0.5">
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">다음 목표</span>
                    <span className="text-sm font-black">{rankData.next.name} 등급 도전 중</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-mono tabular-nums text-primary">{rankData.currentValue.toFixed(1)}</span>
                    <span className="text-[10px] font-black text-muted-foreground/40"> / {rankData.nextThreshold}</span>
                  </div>
                </div>
                <Progress 
                  value={Math.min(100, (rankData.currentValue / rankData.nextThreshold) * 100)} 
                  className="h-2 rounded-full bg-muted shadow-inner" 
                />
              </div>
            )}
          </div>
          
          <Button onClick={() => (document.querySelector('[data-state="open"]') as any)?.click()} className="w-full h-14 rounded-2xl font-black text-base shadow-xl active:scale-95 transition-all">
            몰입 시작하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
    lastActiveCheckTime,
    setLastActiveCheckTime,
    viewMode
  } = useAppContext();
  
  const [today, setToday] = useState<Date | null>(null);
  const isMobile = viewMode === 'mobile';
  
  useEffect(() => {
    setToday(new Date());
  }, []);

  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';
  const weekKey = today ? format(today, "yyyy-'W'II") : '';

  const [localSeconds, setLocalSeconds] = useState(0);
  const [showSessionAlert, setShowSessionAlert] = useState(false);
  const [gracePeriod, setGracePeriod] = useState(GRACE_PERIOD_SECONDS);

  const isLevelingUp = useRef(false);

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

  const dailyStatRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user || !todayKey) return null;
    return doc(firestore, 'centers', activeMembership.id, 'dailyStudentStats', todayKey, 'students', user.uid);
  }, [firestore, activeMembership, user, todayKey]);
  const { data: dailyStat, isLoading: dailyStatLoading } = useDoc<DailyStudentStat>(dailyStatRef, { enabled: isActive });

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
  const { data: todayPlans, isLoading: plansLoading } = useCollection<StudyPlanItem>(allPlansRef, { enabled: isActive });
  
  const scheduleItems = useMemo(() => todayPlans?.filter(p => p.category === 'schedule') || [], [todayPlans]);
  const studyTasks = useMemo(() => todayPlans?.filter(p => p.category === 'study' || !p.category) || [], [todayPlans]);

  const todayCompletionRate = useMemo(() => {
    if (!studyTasks || studyTasks.length === 0) return 0;
    const doneCount = studyTasks.filter(t => t.done).length;
    return (doneCount / studyTasks.length) * 100;
  }, [studyTasks]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && lastActiveCheckTime) {
      interval = setInterval(() => {
        const timeSinceLastCheck = Date.now() - lastActiveCheckTime;
        if (!showSessionAlert && timeSinceLastCheck >= AUTO_TERMINATE_SECONDS * 1000) {
          setShowSessionAlert(true);
          setGracePeriod(GRACE_PERIOD_SECONDS);
        }
      }, 5000); 
    }
    return () => clearInterval(interval);
  }, [isTimerActive, lastActiveCheckTime, showSessionAlert]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showSessionAlert && gracePeriod > 0) {
      interval = setInterval(() => {
        setGracePeriod(prev => prev - 1);
      }, 1000);
    } else if (showSessionAlert && gracePeriod === 0) {
      handleStudyEndAutomatically();
    }
    return () => clearInterval(interval);
  }, [showSessionAlert, gracePeriod]);

  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (!firestore || !user || !activeMembership || !weekKey) return;
    const itemRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id);
    
    updateDoc(itemRef, { done: !item.done, updatedAt: serverTimestamp() });

    if (!item.done) {
      const progressRef = doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
      setDoc(progressRef, {
        stats: { achievement: increment(0.05) }, 
        currentXp: increment(10),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  };

  const saveStudyTime = async () => {
    if (!firestore || !user || !activeMembership || !studyLogRef || !startTime || !todayKey) return;
    
    const sessionMinutes = Math.floor((Date.now() - startTime) / 60000);
    if (sessionMinutes <= 0) return;

    const data = {
      totalMinutes: increment(sessionMinutes),
      uid: user.uid,
      centerId: activeMembership.id,
      dateKey: todayKey,
      updatedAt: serverTimestamp(),
      studentId: user.uid,
      createdAt: serverTimestamp(),
    };

    setDoc(studyLogRef, data, { merge: true });

    const progressRef = doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
    const focusGain = (sessionMinutes / 1000); 
    
    await setDoc(progressRef, {
      stats: {
        focus: increment(Number(focusGain.toFixed(4))),
        consistency: increment(0.1), 
        resilience: sessionMinutes >= 360 ? increment(0.5) : increment(0) 
      },
      currentXp: increment(sessionMinutes), 
      updatedAt: serverTimestamp()
    }, { merge: true });

    const snap = await getDoc(progressRef);
    if (snap.exists() && !isLevelingUp.current) {
      const p = snap.data() as GrowthProgress;
      const currentThreshold = getNextLevelXp(Number(p.level) || 1);
      
      if (p.currentXp >= currentThreshold) {
        isLevelingUp.current = true;
        const overflow = p.currentXp - currentThreshold;
        const nextLevel = (Number(p.level) || 1) + 1;
        const nextThreshold = getNextLevelXp(nextLevel);
        
        await updateDoc(progressRef, {
          level: nextLevel,
          currentXp: overflow,
          nextLevelXp: nextThreshold,
          updatedAt: serverTimestamp()
        });
        toast({ title: "🎉 레벨 업!", description: `마스터리 Lv.${nextLevel} 도달!` });
        isLevelingUp.current = false;
      }
    }
  };

  const handleStudyEndAutomatically = () => {
    if (!isTimerActive) return;
    saveStudyTime();
    setIsTimerActive(false);
    setStartTime(null);
    setLastActiveCheckTime(null);
    setShowSessionAlert(false);
  };

  const handleStudyStartStop = () => {
    if (!firestore || !user || !activeMembership || !studyLogRef) return;

    if (isTimerActive) {
      saveStudyTime();
      setIsTimerActive(false);
      setStartTime(null);
      setLastActiveCheckTime(null);
      setLocalSeconds(0);
      toast({ title: "트랙 종료 및 기록 완료" });
    } else {
      const now = Date.now();
      setStartTime(now);
      setLastActiveCheckTime(now);
      setIsTimerActive(true);
      setLocalSeconds(0);
      toast({ title: "학습 트랙을 시작합니다!" });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isActive) return null;
  if (!today) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  const growthRate = (dailyStat?.studyTimeGrowthRate ?? 0) * 100;
  const completionRate = (dailyStat?.weeklyPlanCompletionRate ?? 0) * 100;
  const attendanceDays = dailyStat?.attendanceStreakDays ?? 0;

  const totalMinutes = (todayStudyLog?.totalMinutes || 0) + Math.floor(localSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  return (
    <div className={cn("flex flex-col gap-6 sm:gap-8 pb-20", isMobile ? "px-0.5" : "px-0")}>
      <AlertDialog open={showSessionAlert} onOpenChange={setShowSessionAlert}>
        <AlertDialogContent className={cn("border-none shadow-2xl transition-all", isMobile ? "rounded-t-[2.5rem] rounded-b-none p-6 bottom-0 top-auto translate-y-0 fixed left-0 right-0 max-w-none" : "rounded-[3rem] p-10")}>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn("font-black flex items-center gap-3 tracking-tighter", isMobile ? "text-xl" : "text-3xl")}>
              <History className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              세션 유지 확인
            </AlertDialogTitle>
            <AlertDialogDescription className={cn("font-bold text-muted-foreground pt-3 leading-relaxed", isMobile ? "text-sm" : "text-lg")}>
              장시간 활동이 감지되지 않았습니다. <br/>
              <span className="text-destructive font-black underline underline-offset-2">{gracePeriod}초</span> 후 자동 종료됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogAction onClick={() => { setShowSessionAlert(false); setLastActiveCheckTime(Date.now()); }} className="h-12 sm:h-14 rounded-xl sm:rounded-2xl font-black text-sm sm:text-base px-8">학습 유지하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <section className={cn("group relative overflow-hidden bg-primary text-primary-foreground shadow-2xl border-b-4 sm:border-b-8 border-black/20 transition-all", isMobile ? "rounded-[2rem] p-5 sm:p-6" : "rounded-[3rem] p-12")}>
        <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-10 rotate-12 transition-transform duration-700 group-hover:scale-110">
          <Zap className="h-48 w-48 sm:h-64 sm:w-64" />
        </div>
        
        <div className={cn("relative z-10 flex flex-col items-center gap-6 sm:gap-8 text-center md:flex-row md:justify-between md:text-left")}>
          <div className="space-y-3 sm:space-y-4">
            <h2 className={cn("font-black tracking-tighter leading-[1.1] whitespace-nowrap", isMobile ? "text-xl" : "text-5xl")}>
              {isTimerActive ? "몰입의 정점에\n도착하셨네요!" : "오늘의 트랙을\n시작해볼까요?"}
            </h2>
            <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md w-fit px-3.5 py-1.5 rounded-full border border-white/10 mx-auto md:mx-0">
              <Sparkles className="h-3 w-3 text-accent animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest opacity-80 whitespace-nowrap">
                실시간 학습 엔진 가동 중
              </span>
            </div>
          </div>
          
          <div className={cn("flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full md:w-auto", isMobile ? "mt-2" : "")}>
            {isTimerActive && (
              <div className={cn("flex flex-col items-center bg-white/5 backdrop-blur-2xl rounded-[1.5rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl shrink-0", isMobile ? "px-5 py-3" : "px-10 py-6")}>
                <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-[0.2em] opacity-40 mb-0.5">진행 시간</span>
                <span className={cn("font-mono font-black tracking-tighter tabular-nums text-accent leading-none", isMobile ? "text-3xl" : "text-5xl")}>
                  {formatTime(localSeconds)}
                </span>
              </div>
            )}
            
            <Button 
              size="lg" 
              className={cn(
                "w-full rounded-[1.5rem] sm:rounded-[2rem] font-black transition-all md:w-auto shadow-2xl active:scale-95 group",
                isMobile ? "h-14 text-lg" : "h-20 px-12 text-2xl",
                isTimerActive ? "bg-destructive hover:bg-destructive/90" : "bg-accent hover:bg-accent/90"
              )}
              onClick={handleStudyStartStop}
            >
              {isTimerActive ? (
                <>트랙 종료 <Square className="ml-2 h-5 w-5 sm:h-6 sm:w-6 fill-current" /></>
              ) : (
                <>트랙 시작 <Play className="ml-2 h-5 w-5 sm:h-6 sm:w-6 fill-current" /></>
              )}
            </Button>
          </div>
        </div>
      </section>

      <div className={cn("grid gap-3 sm:gap-6", isMobile ? "grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4")}>
        <Card className="border-none shadow-md bg-white ring-1 ring-black/[0.03] rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden">
          <CardHeader className={cn("flex flex-row items-center justify-between space-y-0", isMobile ? "pb-1 px-3.5 pt-3.5" : "pb-2 px-6 pt-6")}>
            <CardTitle className={cn("font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap", isMobile ? "text-[8px]" : "text-xs")}>오늘의 몰입</CardTitle>
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary/40" />
          </CardHeader>
          <CardContent className={isMobile ? "px-3.5 pb-3.5" : "px-6 pb-6"}>
            <div className={cn("font-black tracking-tighter text-primary whitespace-nowrap", isMobile ? "text-xl" : "text-3xl")}>
              {h}<span className="text-[9px] sm:text-[10px] ml-0.5 opacity-40 font-bold">h</span> {m}<span className="text-[9px] sm:text-[10px] ml-0.5 opacity-40 font-bold">m</span>
            </div>
            <p className={cn("font-bold text-muted-foreground/60 truncate", isMobile ? "text-[7px] mt-1" : "text-[10px] mt-2")}>일일 권장량 대비 {Math.round((totalMinutes/360)*100)}% 달성</p>
          </CardContent>
        </Card>

        <GamifiedStatCard 
          title="시즌 계획 완수"
          icon={ClipboardCheck}
          value={`${Math.round(completionRate)}%`}
          numericValue={completionRate}
          dailyValue={todayCompletionRate}
          isLoading={dailyStatLoading}
          type="completion"
          gameTitle="완수 마스터리"
          evolution="지난주 대비 +2%"
          isMobile={isMobile}
        />
        
        <GamifiedStatCard 
          title="출석 완료"
          icon={Zap}
          value={`${attendanceDays} 일`}
          numericValue={attendanceDays}
          dailyValue={totalMinutes}
          dailyUnit="분"
          isLoading={dailyStatLoading}
          type="attendance"
          gameTitle="성실의 정점"
          evolution="상위 5% 페이스"
          isMobile={isMobile}
        />

        <GamifiedStatCard 
          title="성장 지수"
          icon={TrendingUp}
          value={`${Math.round(growthRate)}%`}
          numericValue={growthRate}
          dailyValue={growthRate}
          isLoading={dailyStatLoading}
          type="growth"
          gameTitle="성장 챔피언"
          evolution="Lv.30 도전 중"
          isMobile={isMobile}
        />
      </div>

      <div className={cn("grid gap-6 sm:gap-8 grid-cols-1 lg:grid-cols-3 items-start")}>
        <Card className="lg:col-span-2 border-none shadow-2xl rounded-[2rem] sm:rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/[0.03]">
          <CardHeader className={cn("bg-muted/10 border-b", isMobile ? "p-5" : "p-10")}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className={cn("font-black flex items-center gap-2 tracking-tighter whitespace-nowrap", isMobile ? "text-lg" : "text-3xl")}>
                  <ListTodo className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /> 오늘의 학습 계획
                </CardTitle>
                <CardDescription className="font-bold text-[9px] text-muted-foreground uppercase tracking-widest ml-0.5">Daily Study Matrix</CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-white font-black px-2 py-0.5 rounded-md border-none shadow-sm text-[10px]">{Math.round(todayCompletionRate)}%</Badge>
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">달성 완료</span>
                </div>
                <Progress value={todayCompletionRate} className="w-full sm:w-32 h-1.5 rounded-full bg-muted shadow-inner" />
              </div>
            </div>
          </CardHeader>
          <CardContent className={isMobile ? "p-5" : "p-10"}>
            {plansLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
            ) : studyTasks.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center gap-4 bg-[#fafafa] rounded-[1.5rem] border-2 border-dashed border-border/50">
                <Sparkles className="h-8 w-8 text-primary opacity-10" />
                <p className="text-sm font-black text-muted-foreground/60 italic tracking-tight">오늘 등록된 계획이 없습니다.</p>
                <Button asChild variant="outline" size="sm" className="rounded-xl font-black mt-2 h-10 px-6 hover:bg-primary hover:text-white transition-all">
                  <Link href="/dashboard/plan">계획 수립하러 가기</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {studyTasks.slice(0, 6).map((task) => (
                  <div 
                    key={task.id} 
                    className={cn(
                      "flex items-center gap-3.5 p-4 rounded-[1.25rem] border-2 transition-all duration-500 group relative",
                      task.done ? "bg-emerald-50/20 border-emerald-100/50" : "bg-white border-transparent hover:border-primary/10 hover:shadow-lg shadow-sm"
                    )}
                  >
                    <Checkbox 
                      id={task.id} 
                      checked={task.done} 
                      onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)}
                      className="h-5 w-5 rounded-md border-2 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 shadow-sm shrink-0"
                    />
                    <Label 
                      htmlFor={task.id}
                      className={cn(
                        "flex-1 font-bold transition-all duration-500 leading-tight",
                        isMobile ? "text-xs" : "text-base",
                        task.done ? "line-through text-muted-foreground/40 italic" : "text-foreground"
                      )}
                    >
                      {task.title}
                    </Label>
                    {task.done && (
                      <div className="flex items-center gap-1.5 animate-in zoom-in duration-500 shrink-0">
                        {!isMobile && <span className="text-[8px] font-black text-emerald-600 uppercase">완료</span>}
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </div>
                    )}
                  </div>
                ))}
                {studyTasks.length > 6 && (
                  <Button asChild variant="ghost" className="w-full mt-4 h-10 rounded-xl font-black text-[10px] text-primary/40 hover:text-primary transition-all gap-1">
                    <Link href="/dashboard/plan">
                      전체 {studyTasks.length}개 계획 보기 <ChevronRight className="h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-2xl rounded-[2rem] sm:rounded-[3rem] bg-white flex flex-col ring-1 ring-black/[0.03] overflow-hidden">
          <CardHeader className={isMobile ? "p-5" : "p-10"}>
            <CardTitle className={cn("font-black flex items-center gap-2 tracking-tighter whitespace-nowrap", isMobile ? "text-lg" : "text-2xl")}>
              <CalendarClock className="h-6 w-6 sm:h-7 sm:w-7 text-primary" /> 오늘의 루틴
            </CardTitle>
            <CardDescription className="font-bold text-[9px] opacity-40 uppercase tracking-widest ml-0.5">Routine Summary</CardDescription>
          </CardHeader>
          <CardContent className={cn("pb-8 flex-1", isMobile ? "px-5" : "px-10")}>
            {scheduleItems.length === 0 ? (
              <div className="h-full py-16 text-center text-muted-foreground/30 text-[10px] font-black border-2 border-dashed rounded-[1.5rem] flex flex-col items-center justify-center gap-3 bg-[#fafafa]">
                <Timer className="h-8 w-8 opacity-10" />
                <span>기록된 시간표가 없습니다.</span>
              </div>
            ) : (
              <div className="space-y-3.5">
                {scheduleItems.map((item) => {
                  const [title, time] = item.title.split(': ');
                  return (
                    <div key={item.id} className="flex items-center justify-between p-4 rounded-[1.25rem] bg-[#fafafa] border border-border/50 group hover:bg-white hover:shadow-xl transition-all duration-500">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/5 p-2 rounded-lg">
                          <CircleDot className="h-3.5 w-3.5 text-primary/60" />
                        </div>
                        <span className="text-[11px] sm:text-sm font-black text-foreground/80 whitespace-nowrap">{title}</span>
                      </div>
                      <span className="text-[10px] sm:text-xs font-black font-mono text-primary bg-white px-3 py-1 rounded-lg shadow-sm border border-black/[0.02] whitespace-nowrap">{time || '-'}</span>
                    </div>
                  );
                })}
                <Button asChild variant="ghost" className="w-full mt-4 h-10 rounded-xl font-black text-[9px] text-primary/30 hover:text-primary transition-all uppercase tracking-widest">
                  <Link href="/dashboard/plan">루틴 관리하기</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
