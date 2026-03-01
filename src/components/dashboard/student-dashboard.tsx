
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
  MapPin,
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
import { useDoc, useCollection, useFirestore, useUser, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { DailyStudentStat, StudyPlanItem, WithId, StudyLogDay, GrowthProgress } from '@/lib/types';
import { doc, collection, query, where, updateDoc, setDoc, serverTimestamp, increment, getDoc } from 'firebase/firestore';
import { format, startOfMonth, differenceInDays, addMonths } from 'date-fns';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

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

const TARGET_LAT = 37.2762;
const TARGET_LON = 127.1522;
const DISTANCE_THRESHOLD_KM = 1.0;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
}) {
  const rankData = getRankData(numericValue, type);
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="cursor-pointer group relative overflow-hidden transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] hover:-translate-y-1.5 active:scale-95 border-none shadow-md bg-white ring-1 ring-black/[0.03]">
          <div className={cn("absolute top-0 left-0 w-1.5 h-full", rankData.current.iconColor.replace('text-', 'bg-'))} />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary transition-colors">{title}</CardTitle>
            <div className={cn("p-2 rounded-xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-12", rankData.current.bg)}>
              <Icon className={cn("h-4 w-4", rankData.current.color)} />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-24 mt-1" />
                <Skeleton className="h-4 w-32 mt-2" />
              </div>
            ) : (
              <>
                <div className="text-3xl font-black tracking-tighter text-primary">{value}</div>
                <div className="flex items-center gap-2 mt-3">
                   <Badge className={cn("text-[9px] font-black px-2.5 py-0.5 rounded-lg border-none shadow-sm", rankData.current.bg, rankData.current.color)}>
                     {rankData.current.name}
                   </Badge>
                   <span className="text-[10px] font-bold text-muted-foreground/60">{evolution}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-[3rem] border-none shadow-2xl p-0 transition-all duration-500">
        <div className="relative p-10">
          <div className={cn("absolute top-0 left-0 w-full h-40 bg-gradient-to-b opacity-10 -z-10", rankData.current.bg.replace('bg-', 'from-'))} />
          
          <DialogHeader className="items-center text-center">
            <div className={cn("mx-auto p-6 rounded-[2rem] mb-6 shadow-2xl bg-white border-4 animate-float", rankData.current.border)}>
              <Trophy className={cn("h-16 w-16", rankData.current.color)} />
            </div>
            <DialogTitle className="text-4xl font-black tracking-tighter">{gameTitle}</DialogTitle>
            <DialogDescription className="text-lg mt-2 font-bold text-muted-foreground">
              현재 시즌 티어: <span className={cn("font-black underline underline-offset-8 decoration-4", rankData.current.color)}>{rankData.current.name}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-10 py-10">
            <div className="rounded-[2.5rem] bg-[#fafafa] p-8 border border-border/50 shadow-inner space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/5 p-2 rounded-xl">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-primary/60">Today's Live Tracking</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-primary font-mono tabular-nums">{dailyValue.toFixed(0)}</span>
                  <span className="text-xs font-black text-primary/40">{dailyUnit}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="relative h-4 w-full bg-white rounded-full overflow-hidden border shadow-sm">
                  <div 
                    className={cn("absolute inset-y-0 left-0 transition-all duration-1000 ease-out rounded-full", rankData.current.iconColor.replace('text-', 'bg-'))}
                    style={{ width: `${Math.min(100, type === 'attendance' ? (dailyValue / 360) * 100 : dailyValue)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest px-1">
                  <span>Start</span>
                  <span>Target {type === 'attendance' ? '360m' : '100%'}</span>
                </div>
              </div>
            </div>

            {type === 'attendance' && (
              <div className="bg-rose-50/50 border-2 border-rose-100/50 text-rose-700 rounded-[2rem] p-6 flex items-start gap-4">
                <div className="bg-white p-2 rounded-xl shadow-sm"><AlertCircle className="h-5 w-5 text-rose-500" /></div>
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest">Attendance Standards</p>
                  <p className="text-[11px] leading-relaxed font-bold opacity-80">
                    일일 **3시간(180분)** 이상 학습 몰입을 달성한 날만 출석 등급에 반영됩니다.
                  </p>
                </div>
              </div>
            )}

            {rankData.next && (
              <div className="space-y-5 px-2">
                <div className="flex justify-between items-end">
                  <div className="grid gap-0.5">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Next Achievement</span>
                    <span className="text-base font-black">{rankData.next.name} 티어 도전 중</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black font-mono tabular-nums text-primary">{rankData.currentValue.toFixed(1)}</span>
                    <span className="text-xs font-black text-muted-foreground/40"> / {rankData.nextThreshold}</span>
                  </div>
                </div>
                <Progress 
                  value={Math.min(100, (rankData.currentValue / rankData.nextThreshold) * 100)} 
                  className="h-3 rounded-full bg-muted shadow-inner" 
                />
              </div>
            )}
          </div>
          
          <Button onClick={() => (document.querySelector('[data-state="open"]') as any)?.click()} className="w-full h-16 rounded-[1.5rem] font-black text-lg shadow-xl active:scale-95 transition-all">
            목표 달성을 위해 몰입하기
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
  const [locationStatus, setLocationStatus] = useState<'checking' | 'inside' | 'outside' | 'error'>('checking');
  const [distance, setDistance] = useState<number | null>(null);
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
  const { data: todayStudyLog, isLoading: todayStudyLogLoading } = useDoc<StudyLogDay>(studyLogRef, { enabled: isActive });

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

  const checkLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setLocationStatus('error');
      return;
    }

    setLocationStatus('checking');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const dist = calculateDistance(position.coords.latitude, position.coords.longitude, TARGET_LAT, TARGET_LON);
        setDistance(dist);
        setLocationStatus(dist <= DISTANCE_THRESHOLD_KM ? 'inside' : 'outside');
      },
      () => setLocationStatus('error'),
      { enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    if (isActive) checkLocation();
  }, [isActive, checkLocation]);
  
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
      toast({ title: "공부 종료 및 기록 완료" });
    } else {
      const now = Date.now();
      setStartTime(now);
      setLastActiveCheckTime(now);
      setIsTimerActive(true);
      setLocalSeconds(0);
      toast({ title: "공부 모드 시작!" });
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
    <div className="flex flex-col gap-8 pb-20">
      <AlertDialog open={showSessionAlert} onOpenChange={setShowSessionAlert}>
        <AlertDialogContent className="rounded-[3rem] border-none shadow-2xl p-10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-3xl font-black flex items-center gap-3 tracking-tighter">
              <History className="h-8 w-8 text-primary" />
              학습 세션 유지 확인
            </AlertDialogTitle>
            <AlertDialogDescription className="text-lg font-bold text-muted-foreground pt-4 leading-relaxed">
              장시간 활동이 감지되지 않았습니다. <br/>
              <span className="text-destructive font-black underline underline-offset-4">{gracePeriod}초</span> 후 세션이 자동 종료되고 저장됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8">
            <AlertDialogAction onClick={() => { setShowSessionAlert(false); setLastActiveCheckTime(Date.now()); }} className="h-14 rounded-2xl font-black text-base px-8">학습 유지하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <section className="group relative overflow-hidden rounded-[3rem] bg-primary p-8 sm:p-12 text-primary-foreground shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] border-b-8 border-black/20">
        <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12 transition-transform duration-700 group-hover:scale-110">
          <Zap className="h-64 w-64" />
        </div>
        
        <div className="relative z-10 flex flex-col items-center gap-8 text-center md:flex-row md:justify-between md:text-left">
          <div className="space-y-4">
            <h2 className="text-3xl font-black tracking-tighter sm:text-5xl leading-tight">
              {isTimerActive ? "몰입의 정점에\n도착하셨네요!" : "오늘의 마스터리를\n시작해볼까요?"}
            </h2>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md w-fit px-5 py-2.5 rounded-[1.25rem] border border-white/10">
              <MapPin className={cn("h-4 w-4 text-accent", locationStatus === 'inside' && "animate-pulse")} />
              <span className="text-xs font-black uppercase tracking-widest opacity-80">
                {locationStatus === 'inside' ? "Study Center Authorized" : "Searching for Center..."}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 w-full md:w-auto">
            {isTimerActive && (
              <div className="flex flex-col items-center bg-white/5 backdrop-blur-2xl px-10 py-6 rounded-[2.5rem] border border-white/10 shadow-2xl">
                <span className="text-10px font-black uppercase tracking-[0.3em] opacity-40 mb-1">Session Duration</span>
                <span className="text-5xl font-mono font-black tracking-tighter tabular-nums text-accent">
                  {formatTime(localSeconds)}
                </span>
              </div>
            )}
            
            <Button 
              size="lg" 
              className={cn(
                "h-20 w-full rounded-[2rem] px-12 text-2xl font-black transition-all md:w-auto shadow-2xl active:scale-95 group",
                isTimerActive ? "bg-destructive hover:bg-destructive/90" : "bg-accent hover:bg-accent/90"
              )}
              disabled={!isTimerActive && locationStatus !== 'inside'}
              onClick={handleStudyStartStop}
            >
              {isTimerActive ? (
                <>종료 및 저장 <Square className="ml-3 h-6 w-6 fill-current" /></>
              ) : (
                <>몰입 시작 <Play className="ml-3 h-6 w-6 fill-current" /></>
              )}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:gap-6 grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-md bg-white ring-1 ring-black/[0.03] rounded-[2rem] overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Today's Focus</CardTitle>
            <Clock className="h-4 w-4 text-primary/40" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-primary">
              {h}<span className="text-xs ml-0.5 opacity-40">h</span> {m}<span className="text-xs ml-0.5 opacity-40">m</span>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground/60 mt-2">목표 시간 대비 {Math.round((totalMinutes/360)*100)}% 달성</p>
          </CardContent>
        </Card>

        <GamifiedStatCard 
          title="Season Completion"
          icon={ClipboardCheck}
          value={`${Math.round(completionRate)}%`}
          numericValue={completionRate}
          dailyValue={todayCompletionRate}
          isLoading={dailyStatLoading}
          type="completion"
          gameTitle="완수 마스터리"
          evolution="지난주 대비 +2%"
        />
        
        <GamifiedStatCard 
          title="Attendance Streak"
          icon={Zap}
          value={`${attendanceDays} 일`}
          numericValue={attendanceDays}
          dailyValue={totalMinutes}
          dailyUnit="분"
          isLoading={dailyStatLoading}
          type="attendance"
          gameTitle="성실의 정점"
          evolution="상위 5% 페이스"
        />

        <GamifiedStatCard 
          title="Growth Index"
          icon={TrendingUp}
          value={`${Math.round(growthRate)}%`}
          numericValue={growthRate}
          dailyValue={growthRate}
          isLoading={dailyStatLoading}
          type="growth"
          gameTitle="성장 챔피언"
          evolution="Lv.30 도전 중"
        />
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-3 items-start">
        <Card className="lg:col-span-2 border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden ring-1 ring-black/[0.03]">
          <CardHeader className="bg-muted/10 border-b p-8 sm:p-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="space-y-1.5">
                <CardTitle className="text-2xl sm:text-3xl font-black flex items-center gap-3 tracking-tighter">
                  <ListTodo className="h-8 w-8 text-primary" /> 오늘 자습 계획
                </CardTitle>
                <CardDescription className="font-bold text-[10px] text-muted-foreground uppercase tracking-[0.2em] ml-1">Daily Study Matrix</CardDescription>
              </div>
              <div className="flex flex-col items-end gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2.5">
                  <Badge className="bg-primary text-white font-black px-3 py-1 rounded-full border-none shadow-md">{Math.round(todayCompletionRate)}%</Badge>
                  <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Completed</span>
                </div>
                <Progress value={todayCompletionRate} className="w-full sm:w-40 h-2.5 rounded-full bg-muted shadow-inner" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 sm:p-10">
            {plansLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /></div>
            ) : studyTasks.length === 0 ? (
              <div className="py-24 text-center flex flex-col items-center gap-6 bg-[#fafafa] rounded-[2.5rem] border-2 border-dashed border-border/50">
                <div className="bg-white p-6 rounded-3xl shadow-sm border">
                  <Sparkles className="h-12 w-12 text-primary opacity-10" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-black text-muted-foreground/60 italic tracking-tight">오늘 등록된 계획이 없습니다.</p>
                  <p className="text-xs font-bold text-muted-foreground/30 uppercase tracking-widest">Plan your success today</p>
                </div>
                <Button asChild variant="outline" size="lg" className="rounded-2xl font-black mt-4 border-2 px-10 h-14 hover:bg-primary hover:text-white transition-all shadow-sm">
                  <Link href="/dashboard/plan">계획 수립하러 가기</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {studyTasks.slice(0, 6).map((task) => (
                  <div 
                    key={task.id} 
                    className={cn(
                      "flex items-center gap-5 p-5 rounded-3xl border-2 transition-all duration-500 group relative",
                      task.done ? "bg-emerald-50/20 border-emerald-100/50" : "bg-white border-transparent hover:border-primary/10 hover:shadow-xl shadow-sm"
                    )}
                  >
                    <Checkbox 
                      id={task.id} 
                      checked={task.done} 
                      onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)}
                      className="h-6 w-6 rounded-xl border-2 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 shadow-sm"
                    />
                    <Label 
                      htmlFor={task.id}
                      className={cn(
                        "flex-1 font-bold text-base cursor-pointer transition-all duration-500",
                        task.done ? "line-through text-muted-foreground/40 italic" : "text-foreground"
                      )}
                    >
                      {task.title}
                    </Label>
                    {task.done && (
                      <div className="absolute right-5 flex items-center gap-2 animate-in zoom-in duration-500">
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">Verified</span>
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </div>
                    )}
                  </div>
                ))}
                {studyTasks.length > 6 && (
                  <Button asChild variant="ghost" className="w-full mt-6 h-12 rounded-2xl font-black text-xs text-primary/40 hover:text-primary transition-all gap-2">
                    <Link href="/dashboard/plan">
                      전체 {studyTasks.length}개 계획 보기 <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-2xl rounded-[3rem] bg-white flex flex-col ring-1 ring-black/[0.03] overflow-hidden">
          <CardHeader className="p-8 sm:p-10">
            <CardTitle className="text-2xl font-black flex items-center gap-3 tracking-tighter">
              <CalendarClock className="h-7 w-7 text-primary" /> 생활 루틴
            </CardTitle>
            <CardDescription className="font-bold text-[10px] opacity-40 uppercase tracking-[0.2em] ml-1">Routine Summary</CardDescription>
          </CardHeader>
          <CardContent className="px-8 sm:px-10 pb-10 flex-1">
            {scheduleItems.length === 0 ? (
              <div className="h-full py-20 text-center text-muted-foreground/30 text-xs font-black border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center gap-4 bg-[#fafafa]">
                <Timer className="h-10 w-10 opacity-10" />
                <span>시간표가 없습니다.</span>
              </div>
            ) : (
              <div className="space-y-5">
                {scheduleItems.map((item) => {
                  const [title, time] = item.title.split(': ');
                  return (
                    <div key={item.id} className="flex items-center justify-between p-5 rounded-[1.75rem] bg-[#fafafa] border border-border/50 group hover:bg-white hover:shadow-xl transition-all duration-500 hover:-translate-x-1">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary/5 p-2.5 rounded-xl group-hover:bg-primary/10 transition-colors">
                          <CircleDot className="h-4 w-4 text-primary/60" />
                        </div>
                        <span className="text-sm font-black text-foreground/80">{title}</span>
                      </div>
                      <span className="text-xs font-black font-mono text-primary bg-white px-4 py-1.5 rounded-xl shadow-sm ring-1 ring-black/[0.02]">{time || '-'}</span>
                    </div>
                  );
                })}
                <Button asChild variant="ghost" className="w-full mt-6 h-12 rounded-2xl font-black text-[10px] text-primary/30 hover:text-primary transition-all uppercase tracking-widest">
                  <Link href="/dashboard/plan">Edit My Routine</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
