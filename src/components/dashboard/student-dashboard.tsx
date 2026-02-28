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
  { name: '챌린저', color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200' },
  { name: '그랜드마스터', color: 'text-red-600', bg: 'bg-red-100', border: 'border-red-200' },
  { name: '다이아몬드', color: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200' },
  { name: '에메랄드', color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200' },
  { name: '플래티넘', color: 'text-cyan-600', bg: 'bg-cyan-100', border: 'border-cyan-200' },
  { name: '골드', color: 'text-yellow-600', bg: 'bg-yellow-100', border: 'border-yellow-200' },
  { name: '실버', color: 'text-gray-500', bg: 'bg-gray-200', border: 'border-gray-300' },
  { name: '브론즈', color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-200' },
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
        <Card className="cursor-pointer group relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] border border-border/50 bg-card/80 backdrop-blur-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-black transition-colors group-hover:text-primary">{title}</CardTitle>
            <div className="bg-primary/5 p-1.5 rounded-lg group-hover:bg-primary/10 transition-colors">
              <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:rotate-12 transition-all duration-300" />
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
                <div className="text-2xl font-black tracking-tight">{value}</div>
                <div className="flex items-center gap-1.5 mt-2">
                   <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full transition-transform group-hover:scale-110", rankData.current.bg, rankData.current.color)}>
                     {rankData.current.name}
                   </span>
                   <p className="text-[10px] font-bold text-muted-foreground/70">{evolution}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-[2.5rem] border-none shadow-2xl p-0">
        <div className="relative p-6 sm:p-8">
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/10 to-transparent -z-10" />
          
          <DialogHeader className="items-center text-center">
            <div className={cn("mx-auto p-5 rounded-3xl mb-4 animate-float shadow-xl bg-white", rankData.current.border)}>
              <Trophy className={cn("h-16 w-16", rankData.current.color)} />
            </div>
            <DialogTitle className="text-3xl font-black tracking-tighter">{gameTitle}</DialogTitle>
            <DialogDescription className="text-lg mt-2 font-bold">
              이번 시즌 티어: <span className={cn("font-black underline underline-offset-4 decoration-2", rankData.current.color)}>{rankData.current.name}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-8 py-6">
            <div className="rounded-3xl bg-secondary/30 p-6 border border-secondary shadow-inner space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/10 p-1.5 rounded-lg">
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-primary/70">오늘의 실시간 현황</span>
                </div>
                <span className="text-xl font-black text-primary font-mono">{dailyValue.toFixed(0)}{dailyUnit}</span>
              </div>
              <div className="space-y-2">
                <Progress 
                  value={type === 'attendance' ? Math.min(100, (dailyValue / 360) * 100) : dailyValue} 
                  className="h-3 rounded-full bg-white/50" 
                />
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                  <span>START</span>
                  <span>{type === 'attendance' ? '목표 360분' : '목표 100%'}</span>
                </div>
              </div>
            </div>

            {type === 'attendance' && (
              <Alert className="bg-destructive/5 border-destructive/20 text-destructive rounded-2xl py-3">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-[10px] font-black uppercase tracking-widest">엄격한 출석 인정 기준</AlertTitle>
                <AlertDescription className="text-[11px] leading-relaxed font-bold mt-1">
                  출석 등급은 일일 **3시간(180분) 이상** 학습을 완료한 날만 카운트됩니다.
                </AlertDescription>
              </Alert>
            )}

            {rankData.next && (
              <div className="space-y-4 px-2">
                <div className="flex justify-between text-xs font-black">
                  <span className="text-muted-foreground">다음 목표: {rankData.next.name}</span>
                  <span className="font-mono text-primary">{rankData.currentValue.toFixed(1)} / {rankData.nextThreshold}</span>
                </div>
                <Progress 
                  value={Math.min(100, (rankData.currentValue / rankData.nextThreshold) * 100)} 
                  className="h-3 rounded-full bg-secondary" 
                />
              </div>
            )}
          </div>
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
    setLastActiveCheckTime
  } = useAppContext();
  
  const [today, setToday] = useState<Date | null>(null);
  
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

  const daysUntilReset = useMemo(() => {
    if (!today) return 0;
    const nextMonth = startOfMonth(addMonths(today, 1));
    return differenceInDays(nextMonth, today);
  }, [today]);

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
    <div className="flex flex-col gap-6 pb-10">
      <AlertDialog open={showSessionAlert} onOpenChange={setShowSessionAlert}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black flex items-center gap-2">
              <History className="h-6 w-6 text-primary" />
              학습 세션을 유지할까요?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base font-bold text-muted-foreground pt-2">
              <span className="text-destructive font-black">{gracePeriod}초</span> 후 자동 저장됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => { setShowSessionAlert(false); setLastActiveCheckTime(Date.now()); }} className="rounded-2xl">유지하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <section className="group relative overflow-hidden rounded-[2.5rem] bg-primary p-6 sm:p-8 text-primary-foreground shadow-2xl">
        <div className="relative z-10 flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
          <div className="space-y-3">
            <h2 className="text-2xl font-black tracking-tighter sm:text-3xl leading-tight">
              {isTimerActive ? "몰입의 즐거움을\n경험하세요!" : "오늘의 성장을\n지금 시작할까요?"}
            </h2>
            <p className="flex items-center gap-2 text-primary-foreground/70 font-black bg-white/10 w-fit px-4 py-2 rounded-2xl text-[11px]">
              <MapPin className="h-3 w-3 text-accent animate-pulse" />
              {locationStatus === 'inside' ? "동백센터 구역 내" : "위치 확인 중..."}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            {isTimerActive && (
              <div className="flex flex-col items-center bg-white/10 backdrop-blur-xl px-7 py-4 rounded-3xl border border-white/20">
                <span className="text-4xl font-mono font-black tracking-tighter">
                  {formatTime(localSeconds)}
                </span>
              </div>
            )}
            
            <Button 
              size="lg" 
              className={cn(
                "h-16 w-full rounded-[1.5rem] px-10 text-xl font-black transition-all md:w-auto shadow-xl",
                isTimerActive ? "bg-destructive" : "bg-accent"
              )}
              disabled={!isTimerActive && locationStatus !== 'inside'}
              onClick={handleStudyStartStop}
            >
              {isTimerActive ? "학습 마침" : "학습 시작"}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-border/50 bg-card/80 rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black text-muted-foreground">오늘의 학습 시간</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tight text-primary">
              {h}시간 {m}분
            </div>
          </CardContent>
        </Card>

        <GamifiedStatCard 
          title="월간 완수율"
          icon={ClipboardCheck}
          value={`${Math.round(completionRate)}%`}
          numericValue={completionRate}
          dailyValue={todayCompletionRate}
          isLoading={dailyStatLoading}
          type="completion"
          gameTitle="완수 마스터"
        />
        
        <GamifiedStatCard 
          title="월간 출석 (3h+)"
          icon={Zap}
          value={`${attendanceDays} 일`}
          numericValue={attendanceDays}
          dailyValue={totalMinutes}
          dailyUnit="분"
          isLoading={dailyStatLoading}
          type="attendance"
          gameTitle="출석 킹"
        />

        <GamifiedStatCard 
          title="월간 성장 지수"
          icon={TrendingUp}
          value={`${Math.round(growthRate)}%`}
          numericValue={growthRate}
          dailyValue={growthRate}
          isLoading={dailyStatLoading}
          type="growth"
          gameTitle="성장 챔피언"
        />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden ring-1 ring-border/50">
          <CardHeader className="bg-muted/10 border-b p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl sm:text-2xl font-black flex items-center gap-2">
                  <ListTodo className="h-6 w-6 text-primary" /> 오늘의 학습 계획
                </CardTitle>
                <CardDescription className="font-bold text-xs text-muted-foreground uppercase tracking-widest">Today's Study Checklist</CardDescription>
              </div>
              <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-primary">{Math.round(todayCompletionRate)}%</span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">달성</span>
                </div>
                <Progress value={todayCompletionRate} className="w-full sm:w-32 h-2 rounded-full shadow-inner" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            {plansLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
            ) : !studyTasks || studyTasks.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center gap-4 bg-muted/5 rounded-[2.5rem] border-2 border-dashed border-border/50">
                <div className="bg-white p-4 rounded-full shadow-sm">
                  <ClipboardCheck className="h-10 w-10 text-muted-foreground opacity-20" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-muted-foreground/60 italic">오늘 등록된 자습 계획이 없습니다.</p>
                  <p className="text-[10px] font-medium text-muted-foreground/40">미리 계획을 세우면 집중력이 20% 향상됩니다.</p>
                </div>
                <Button asChild variant="outline" size="sm" className="rounded-xl font-black mt-2 border-2 px-6 h-10 hover:bg-primary hover:text-white transition-all">
                  <Link href="/dashboard/plan">계획 세우러 가기</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {studyTasks.slice(0, 6).map((task) => (
                  <div 
                    key={task.id} 
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 group",
                      task.done ? "bg-emerald-50/30 border-emerald-100/50" : "bg-white border-transparent hover:border-primary/10 hover:bg-muted/5 shadow-sm"
                    )}
                  >
                    <Checkbox 
                      id={task.id} 
                      checked={task.done} 
                      onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)}
                      className="h-5 w-5 rounded-lg border-2 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                    />
                    <Label 
                      htmlFor={task.id}
                      className={cn(
                        "flex-1 font-bold text-sm cursor-pointer transition-all",
                        task.done ? "line-through text-muted-foreground/50 italic" : "text-foreground"
                      )}
                    >
                      {task.title}
                    </Label>
                    {task.done && <CheckCircle2 className="h-4 w-4 text-emerald-500 animate-in zoom-in duration-300" />}
                  </div>
                ))}
                {studyTasks.length > 6 && (
                  <Button asChild variant="ghost" className="w-full mt-4 font-black text-xs text-muted-foreground/60 hover:text-primary transition-colors gap-2">
                    <Link href="/dashboard/plan">
                      나머지 {studyTasks.length - 6}개의 계획 더보기 <ChevronRight className="h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white flex flex-col ring-1 ring-border/50 overflow-hidden">
          <CardHeader className="p-6 sm:p-8">
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-primary" /> 생활 시간표
            </CardTitle>
            <CardDescription className="font-bold text-xs opacity-60 uppercase tracking-tighter">Daily Routine Summary</CardDescription>
          </CardHeader>
          <CardContent className="px-6 sm:px-8 pb-8 flex-1">
            {!scheduleItems || scheduleItems.length === 0 ? (
              <div className="h-full py-16 text-center text-muted-foreground/40 text-xs font-black border-2 border-dashed rounded-[2rem] flex flex-col items-center justify-center gap-2">
                <Clock className="h-8 w-8 opacity-10" />
                <span>시간표가 등록되지 않았습니다.</span>
              </div>
            ) : (
              <div className="space-y-4">
                {scheduleItems.map((item) => {
                  const [title, time] = item.title.split(': ');
                  return (
                    <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/10 border border-border/50 group hover:bg-white hover:shadow-md transition-all">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/5 p-2 rounded-xl group-hover:bg-primary/10 transition-colors">
                          <CircleDot className="h-3 w-3 text-primary/60" />
                        </div>
                        <span className="text-sm font-bold text-foreground/80">{title}</span>
                      </div>
                      <span className="text-xs font-black font-mono text-primary bg-white px-3 py-1 rounded-lg shadow-sm">{time || '-'}</span>
                    </div>
                  );
                })}
                <Button asChild variant="ghost" className="w-full mt-4 font-black text-[10px] text-primary/40 hover:text-primary transition-colors">
                  <Link href="/dashboard/plan">스케줄 편집하기</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
