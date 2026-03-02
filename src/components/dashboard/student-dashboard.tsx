
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
import { DailyStudentStat, StudyPlanItem, WithId, StudyLogDay, GrowthProgress, StudentProfile } from '@/lib/types';
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
  growth: [150, 140, 130, 120, 110, 100, 50, 0],
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
          <div className={cn("absolute top-0 left-0 w-1.5 h-full", rankData.current.iconColor.replace('text-', 'bg-'))} />
          <CardHeader className={cn("flex flex-row items-center justify-between space-y-0", isMobile ? "pb-1 px-5 pt-5" : "pb-2 px-6 pt-6")}>
            <CardTitle className={cn("font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors", isMobile ? "text-[10px]" : "text-xs")}>{title}</CardTitle>
            <div className={cn("rounded-lg transition-all duration-500 group-hover:scale-110", isMobile ? "p-1.5" : "p-2", rankData.current.bg)}>
              <Icon className={cn(isMobile ? "h-3.5 w-3.5" : "h-4 w-4", rankData.current.color)} />
            </div>
          </CardHeader>
          <CardContent className={isMobile ? "px-5 pb-5" : "px-6 pb-6"}>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-16 mt-1" />
                <Skeleton className="h-3 w-20 mt-2" />
              </div>
            ) : (
              <>
                <div className={cn("font-black tracking-tighter text-primary", isMobile ? "text-2xl" : "text-3xl")}>{value}</div>
                <div className={cn("flex items-center gap-1.5 mt-2 flex-nowrap overflow-hidden")}>
                   <Badge className={cn("font-black rounded-md border-none shadow-sm shrink-0", isMobile ? "text-[8px] px-1.5 py-0" : "text-[9px] px-2 py-0.5", rankData.current.bg, rankData.current.color)}>
                     {rankData.current.name}
                   </Badge>
                   <span className={cn("font-bold text-muted-foreground/60 whitespace-nowrap truncate", isMobile ? "text-[8px]" : "text-[10px]")}>{evolution}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className={cn("border-none shadow-2xl p-0 transition-all duration-500", isMobile ? "fixed bottom-0 top-auto translate-y-0 left-0 right-0 max-w-none rounded-t-[2.5rem] rounded-b-none" : "sm:max-w-md rounded-[3rem]")}>
        <div className={cn("relative", isMobile ? "p-8 pb-12" : "p-10")}>
          <div className={cn("absolute top-0 left-0 w-full h-40 bg-gradient-to-b opacity-10 -z-10", rankData.current.bg.replace('bg-', 'from-'))} />
          
          <DialogHeader className="items-center text-center">
            <div className={cn("mx-auto rounded-[2rem] shadow-2xl bg-white border-4 animate-float", isMobile ? "p-5 mb-5" : "p-6 mb-6", rankData.current.border)}>
              <Trophy className={cn(isMobile ? "h-14 w-14" : "h-16 w-16", rankData.current.color)} />
            </div>
            <DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-3xl" : "text-4xl")}>{gameTitle}</DialogTitle>
            <DialogDescription className={cn("mt-2 font-bold text-muted-foreground", isMobile ? "text-base" : "text-lg")}>
              현재 시즌 등급: <span className={cn("font-black underline underline-offset-8 decoration-2", rankData.current.color)}>{rankData.current.name}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className={cn("space-y-8 py-8", isMobile ? "py-6" : "py-10")}>
            <div className={cn("rounded-[2.5rem] bg-[#fafafa] border border-border/50 shadow-inner space-y-6", isMobile ? "p-6" : "p-8")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="bg-primary/5 p-2 rounded-xl">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-[0.15em] text-primary/60">실시간 현황</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={cn("font-black text-primary font-mono tabular-nums", isMobile ? "text-2xl" : "text-3xl")}>{dailyValue.toFixed(0)}</span>
                  <span className="text-[11px] font-black text-primary/40">{dailyUnit}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="relative h-4 w-full bg-white rounded-full overflow-hidden border-2 shadow-inner">
                  <div 
                    className={cn("absolute inset-y-0 left-0 transition-all duration-1000 ease-out rounded-full", rankData.current.iconColor.replace('text-', 'bg-'))}
                    style={{ width: `${Math.min(100, type === 'attendance' ? (dailyValue / 360) * 100 : dailyValue)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest px-1">
                  <span>시작</span>
                  <span>목표 {type === 'attendance' ? '360분' : '100%'}</span>
                </div>
              </div>
            </div>

            {rankData.next && (
              <div className="space-y-5 px-2">
                <div className="flex justify-between items-end">
                  <div className="grid gap-1">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">다음 단계 도전</span>
                    <span className="text-base font-black">{rankData.next.name} 등급</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black font-mono tabular-nums text-primary">{rankData.currentValue.toFixed(1)}</span>
                    <span className="text-[11px] font-black text-muted-foreground/40"> / {rankData.nextThreshold}</span>
                  </div>
                </div>
                <Progress 
                  value={Math.min(100, (rankData.currentValue / rankData.nextThreshold) * 100)} 
                  className="h-2.5 rounded-full bg-muted shadow-inner" 
                />
              </div>
            )}
          </div>
          
          <Button onClick={() => (document.querySelector('[data-state="open"]') as any)?.click()} className="w-full h-16 rounded-[1.75rem] font-black text-lg shadow-xl active:scale-95 transition-all">
            몰입 계속하기
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

  // 학생 프로필 정보 (좌석 번호 확인용)
  const studentProfileRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'students', user.uid);
  }, [firestore, activeMembership, user]);
  const { data: studentProfile } = useDoc<StudentProfile>(studentProfileRef, { enabled: isActive });

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
    
    // 1. 실시간 좌석 상태 업데이트 (부재로 변경)
    if (firestore && activeMembership && studentProfile?.seatNo) {
      const seatId = `seat_${studentProfile.seatNo.toString().padStart(3, '0')}`;
      const seatRef = doc(firestore, 'centers', activeMembership.id, 'attendanceCurrent', seatId);
      updateDoc(seatRef, { status: 'absent', updatedAt: serverTimestamp() });
    }

    saveStudyTime();
    setIsTimerActive(false);
    setStartTime(null);
    setLastActiveCheckTime(null);
    setShowSessionAlert(false);
  };

  const handleStudyStartStop = () => {
    if (!firestore || !user || !activeMembership || !studyLogRef) return;

    if (isTimerActive) {
      // 1. 실시간 좌석 상태 업데이트 (부재로 변경)
      if (studentProfile?.seatNo) {
        const seatId = `seat_${studentProfile.seatNo.toString().padStart(3, '0')}`;
        const seatRef = doc(firestore, 'centers', activeMembership.id, 'attendanceCurrent', seatId);
        updateDoc(seatRef, { status: 'absent', updatedAt: serverTimestamp() });
      }

      saveStudyTime();
      setIsTimerActive(false);
      setStartTime(null);
      setLastActiveCheckTime(null);
      setLocalSeconds(0);
      toast({ title: "트랙 종료 및 기록 완료" });
    } else {
      const now = Date.now();
      
      // 1. 실시간 좌석 상태 업데이트 (공부 중으로 변경)
      if (studentProfile?.seatNo) {
        const seatId = `seat_${studentProfile.seatNo.toString().padStart(3, '0')}`;
        const seatRef = doc(firestore, 'centers', activeMembership.id, 'attendanceCurrent', seatId);
        updateDoc(seatRef, { status: 'studying', updatedAt: serverTimestamp() });
      }

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

  const totalMinutes = (todayStudyLog?.totalMinutes || 0) + Math.floor(localSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  return (
    <div className={cn("flex flex-col gap-6 sm:gap-8 pb-20", isMobile ? "px-0" : "px-0")}>
      <AlertDialog open={showSessionAlert} onOpenChange={setShowSessionAlert}>
        <AlertDialogContent className={cn("border-none shadow-2xl transition-all", isMobile ? "rounded-t-[3rem] rounded-b-none p-8 bottom-0 top-auto translate-y-0 fixed left-0 right-0 max-w-none" : "rounded-[3rem] p-10")}>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn("font-black flex items-center gap-3 tracking-tighter", isMobile ? "text-2xl" : "text-3xl")}>
              <History className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
              세션 유지 확인
            </AlertDialogTitle>
            <AlertDialogDescription className={cn("font-bold text-muted-foreground pt-4 leading-relaxed", isMobile ? "text-base" : "text-lg")}>
              장시간 활동이 감지되지 않았습니다. <br/>
              <span className="text-destructive font-black underline underline-offset-4 decoration-2">{gracePeriod}초</span> 후 자동으로 종료됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8">
            <AlertDialogAction onClick={() => { setShowSessionAlert(false); setLastActiveCheckTime(Date.now()); }} className="h-14 sm:h-16 rounded-[1.5rem] sm:rounded-2xl font-black text-base px-10">몰입 계속하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <section className={cn("group relative overflow-hidden bg-primary text-primary-foreground shadow-2xl border-b-4 sm:border-b-8 border-black/20 transition-all", isMobile ? "rounded-[2.5rem] p-8 mx-0" : "rounded-[3rem] p-12")}>
        <div className="absolute top-0 right-0 p-8 sm:p-12 opacity-10 rotate-12 transition-transform duration-700 group-hover:scale-110">
          <Zap className="h-48 w-48 sm:h-64 sm:w-64" />
        </div>
        
        <div className={cn("relative z-10 flex flex-col gap-8", isMobile ? "items-center text-center" : "md:flex-row md:justify-between md:text-left")}>
          <div className="space-y-4">
            <h2 className={cn("font-black tracking-tighter leading-[1.15]", isMobile ? "text-3xl" : "text-5xl")}>
              {isTimerActive ? "몰입의 정점에\n도착하셨네요!" : "오늘의 트랙을\n시작해볼까요?"}
            </h2>
            <div className={cn("flex items-center gap-2 bg-white/10 backdrop-blur-md w-fit px-4 py-2 rounded-full border border-white/10", isMobile ? "mx-auto" : "md:mx-0")}>
              <Sparkles className="h-3.5 w-3.5 text-accent animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 whitespace-nowrap">
                Live Study Tracker
              </span>
            </div>
          </div>
          
          <div className={cn("flex flex-col sm:flex-row items-center gap-5 sm:gap-6 w-full md:w-auto")}>
            {isTimerActive && (
              <div className={cn("flex flex-col items-center bg-white/10 backdrop-blur-2xl rounded-[2rem] border border-white/10 shadow-2xl shrink-0 w-full sm:w-auto", isMobile ? "px-8 py-5" : "px-10 py-6")}>
                <span className="text-[9px] font-black uppercase tracking-[0.25em] opacity-50 mb-1">Session Progress</span>
                <span className={cn("font-mono font-black tracking-tighter tabular-nums text-accent leading-none", isMobile ? "text-5xl" : "text-5xl")}>
                  {formatTime(localSeconds)}
                </span>
              </div>
            )}
            
            <Button 
              size="lg" 
              className={cn(
                "w-full rounded-[2rem] sm:rounded-[2.5rem] font-black transition-all md:w-auto shadow-2xl active:scale-95 group",
                isMobile ? "h-16 text-xl" : "h-20 px-12 text-2xl",
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

      {/* 핵심 지표 그리드 */}
      <div className={cn("grid gap-4", isMobile ? "px-0 grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-4")}>
        <Card className="border-none shadow-md bg-white ring-1 ring-black/[0.03] rounded-[2rem] overflow-hidden">
          <CardHeader className={cn("flex flex-row items-center justify-between space-y-0", isMobile ? "pb-2 px-7 pt-7" : "pb-2 px-6 pt-6")}>
            <CardTitle className={cn("font-black uppercase tracking-widest text-muted-foreground", isMobile ? "text-[11px]" : "text-xs")}>오늘의 몰입</CardTitle>
            <div className="bg-primary/5 p-1.5 rounded-lg"><Clock className="h-4 w-4 text-primary/60" /></div>
          </CardHeader>
          <CardContent className={isMobile ? "px-7 pb-7" : "px-6 pb-6"}>
            <div className={cn("font-black tracking-tighter text-primary", isMobile ? "text-4xl" : "text-3xl")}>
              {h}<span className="text-sm ml-1.5 opacity-40 font-bold">h</span> {m}<span className="text-sm ml-1.5 opacity-40 font-bold">m</span>
            </div>
            <p className="font-bold text-muted-foreground/60 text-[10px] mt-2.5">일일 권장량 대비 {Math.round((totalMinutes/360)*100)}% 달성</p>
          </CardContent>
        </Card>

        {!isMobile ? (
          <>
            <GamifiedStatCard 
              title="시즌계획 완수" 
              icon={ClipboardCheck} 
              value={`${Math.round((dailyStat?.weeklyPlanCompletionRate || 0) * 100)}%`} 
              numericValue={(dailyStat?.weeklyPlanCompletionRate || 0) * 100}
              dailyValue={todayCompletionRate}
              evolution="최근 7일 평균" 
              isLoading={dailyStatLoading} 
              type="completion"
              gameTitle="계획 정복자"
              isMobile={isMobile}
            />
            <GamifiedStatCard 
              title="출석 완료" 
              icon={CalendarClock} 
              value={`${dailyStat?.attendanceStreakDays || 0}일`} 
              numericValue={dailyStat?.attendanceStreakDays || 0}
              dailyValue={totalMinutes}
              dailyUnit="분"
              evolution="이번 달 누적" 
              isLoading={dailyStatLoading} 
              type="attendance"
              gameTitle="꾸준함의 화신"
              isMobile={isMobile}
            />
            <GamifiedStatCard 
              title="성장 지수" 
              icon={TrendingUp} 
              value={`${Math.round((dailyStat?.studyTimeGrowthRate || 0) * 100)}%`} 
              numericValue={(dailyStat?.studyTimeGrowthRate || 0) * 100}
              dailyValue={(dailyStat?.studyTimeGrowthRate || 0) * 100}
              evolution="전주 대비 성장" 
              isLoading={dailyStatLoading} 
              type="growth"
              gameTitle="성장의 아이콘"
              isMobile={isMobile}
            />
          </>
        ) : (
          <div className="grid grid-cols-2 gap-4">
             <GamifiedStatCard 
              title="계획 완수" 
              icon={ClipboardCheck} 
              value={`${Math.round((dailyStat?.weeklyPlanCompletionRate || 0) * 100)}%`} 
              numericValue={(dailyStat?.weeklyPlanCompletionRate || 0) * 100}
              dailyValue={todayCompletionRate}
              evolution="7일 평균" 
              isLoading={dailyStatLoading} 
              type="completion"
              gameTitle="계획 정복자"
              isMobile={isMobile}
            />
            <GamifiedStatCard 
              title="성장 지수" 
              icon={TrendingUp} 
              value={`${Math.round((dailyStat?.studyTimeGrowthRate || 0) * 100)}%`} 
              numericValue={(dailyStat?.studyTimeGrowthRate || 0) * 100}
              dailyValue={(dailyStat?.studyTimeGrowthRate || 0) * 100}
              evolution="전주 대비" 
              isLoading={dailyStatLoading} 
              type="growth"
              gameTitle="성장의 아이콘"
              isMobile={isMobile}
            />
          </div>
        )}
      </div>

      <div className={cn("grid gap-6", isMobile ? "px-0 grid-cols-1" : "lg:grid-cols-3")}>
        <Card className={cn("border-none shadow-2xl rounded-[2.5rem] sm:rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/[0.03]", isMobile ? "col-span-1" : "lg:col-span-2")}>
          <CardHeader className={cn("bg-muted/10 border-b", isMobile ? "p-8" : "p-10")}>
            <div className={cn("flex flex-col gap-5", isMobile ? "items-start" : "sm:flex-row sm:items-center justify-between")}>
              <div className="space-y-1.5">
                <CardTitle className={cn("font-black flex items-center gap-3 tracking-tighter", isMobile ? "text-3xl" : "text-3xl")}>
                  <ListTodo className="h-8 w-8 text-primary" /> 오늘의 학습 계획
                </CardTitle>
                <CardDescription className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em] ml-1">Study Matrix</CardDescription>
              </div>
              <div className={cn("flex flex-col gap-3", isMobile ? "w-full" : "items-end sm:w-auto")}>
                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">달성률</span>
                  <Badge className="bg-primary text-white font-black px-3 py-1 rounded-lg border-none shadow-sm text-[12px]">{Math.round(todayCompletionRate)}%</Badge>
                </div>
                <Progress value={todayCompletionRate} className="w-full sm:w-48 h-2 rounded-full bg-muted shadow-inner" />
              </div>
            </div>
          </CardHeader>
          <CardContent className={isMobile ? "p-8" : "p-10"}>
            {plansLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /></div>
            ) : studyTasks.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center gap-5 bg-[#fafafa] rounded-[2rem] border-2 border-dashed border-border/50">
                <Sparkles className="h-12 w-12 text-primary opacity-10" />
                <div className="space-y-1">
                  <p className="text-lg font-black text-muted-foreground/60 tracking-tight">등록된 계획이 없습니다.</p>
                  <p className="text-xs font-bold text-muted-foreground/40">멋진 하루를 설계해 보세요!</p>
                </div>
                <Button asChild variant="outline" size="lg" className="rounded-2xl font-black mt-2 px-10 h-14 border-2 hover:bg-primary hover:text-white transition-all shadow-sm">
                  <Link href="/dashboard/plan">계획 수립하러 가기</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {studyTasks.map((task) => (
                  <div 
                    key={task.id} 
                    className={cn(
                      "flex items-center gap-5 p-6 rounded-[2rem] border-2 transition-all duration-500 group relative",
                      task.done ? "bg-emerald-50/20 border-emerald-100/50" : "bg-white border-transparent hover:border-primary/10 hover:shadow-xl shadow-sm"
                    )}
                  >
                    <Checkbox 
                      id={task.id} 
                      checked={task.done} 
                      onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)}
                      className="h-8 w-8 rounded-xl border-2 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 shadow-sm shrink-0"
                    />
                    <Label 
                      htmlFor={task.id}
                      className={cn(
                        "flex-1 font-bold transition-all duration-500 leading-tight",
                        isMobile ? "text-lg" : "text-lg",
                        task.done ? "line-through text-muted-foreground/40 italic" : "text-foreground"
                      )}
                    >
                      {task.title}
                    </Label>
                    {task.done && (
                      <div className="flex items-center gap-1.5 animate-in zoom-in duration-500 shrink-0">
                        <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn("border-none shadow-2xl rounded-[2.5rem] sm:rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/[0.03]", isMobile ? "col-span-1" : "")}>
          <CardHeader className={cn("bg-accent/5 border-b", isMobile ? "p-8" : "p-10")}>
            <CardTitle className="font-black flex items-center gap-3 tracking-tighter text-accent">
              <Timer className="h-8 w-8" /> 오늘의 루틴
            </CardTitle>
            <CardDescription className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em] ml-1">Routine Matrix</CardDescription>
          </CardHeader>
          <CardContent className={isMobile ? "p-8" : "p-10"}>
            {scheduleItems.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground/40 font-black italic border-2 border-dashed rounded-[2rem] bg-muted/5">
                등록된 루틴이 없습니다.
              </div>
            ) : (
              <div className="space-y-4">
                {scheduleItems.map((item) => {
                  const [title, time] = item.title.split(': ');
                  return (
                    <div key={item.id} className="flex items-center justify-between p-6 rounded-[2rem] bg-muted/20 border-2 border-transparent hover:border-accent/20 transition-all group">
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-2xl bg-white shadow-sm group-hover:bg-accent group-hover:text-white transition-colors">
                          <CircleDot className="h-4 w-4" />
                        </div>
                        <span className="font-bold text-foreground/80">{title}</span>
                      </div>
                      <span className="font-mono font-black text-accent text-lg">{time || '--:--'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
