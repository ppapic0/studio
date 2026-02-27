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
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { DailyStudentStat, StudyPlanItem, WithId, StudyLogDay } from '@/lib/types';
import { doc, collection, query, where, updateDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { format, startOfMonth, differenceInDays, addMonths } from 'date-fns';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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

const AUTO_TERMINATE_SECONDS = 7200; // 2시간
const GRACE_PERIOD_SECONDS = 60; // 1분

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
                  value={type === 'attendance' ? Math.min(100, (dailyValue / 180) * 100) : dailyValue} 
                  className="h-3 rounded-full bg-white/50" 
                />
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
                  <span>START</span>
                  <span>{type === 'attendance' ? '목표 180분' : '목표 100%'}</span>
                </div>
              </div>
              <p className="text-[11px] text-center font-bold text-primary/60 italic">
                {type === 'completion' && (dailyValue >= 100 ? "🎉 오늘 계획 마스터! 완벽합니다." : `오늘 남은 계획을 마쳐서 ${dailyValue.toFixed(0)}%를 채우세요!`)}
                {type === 'attendance' && (dailyValue >= 180 ? "⚡ 3시간 몰입 성공! 출석 인정되었습니다." : `앞으로 ${(180 - dailyValue).toFixed(0)}분만 더 공부하면 출석이 인정돼요!`)}
                {type === 'growth' && (dailyValue > 0 ? "📈 어제보다 더 성장하고 있습니다. 페이스를 유지하세요!" : "오늘의 학습을 시작하여 성장 지수를 높여보세요!")}
              </p>
            </div>

            {type === 'attendance' && (
              <Alert className="bg-destructive/5 border-destructive/20 text-destructive rounded-2xl py-3">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-[10px] font-black uppercase tracking-widest">엄격한 출석 인정 기준 (3시간 룰)</AlertTitle>
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

            <div className="rounded-3xl border border-border/50 bg-muted/20 overflow-hidden">
              <div className="bg-muted/40 px-6 py-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary/70">
                  <Info className="h-4 w-4" />
                  <span>시즌 등급 달성 조건</span>
                </div>
                <span className="text-[10px] font-black text-muted-foreground/60">단위: {type === 'attendance' ? '일' : '%'}</span>
              </div>
              <div className="p-3 space-y-1.5">
                {RANKS.map((r, idx) => (
                  <div key={r.name} className={cn(
                    "flex items-center justify-between px-4 py-2.5 rounded-2xl text-xs transition-all duration-300",
                    rankData.current.name === r.name 
                      ? cn("bg-white shadow-lg ring-1 scale-[1.03] z-10", r.border) 
                      : "opacity-40 grayscale-[0.2]"
                  )}>
                    <div className="flex items-center gap-3">
                      <div className={cn("h-2.5 w-2.5 rounded-full shadow-sm", r.bg.replace('bg-', 'bg-opacity-100 bg-'))} />
                      <span className={cn("font-black tracking-tight", r.color)}>{r.name}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono font-black">
                      <span className="text-muted-foreground text-[10px] mr-1 font-bold">이상</span>
                      {RANK_THRESHOLDS[type][idx]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
    secondsElapsed, 
    setSecondsElapsed,
    startTime,
    setStartTime,
    lastActiveCheckTime,
    setLastActiveCheckTime
  } = useAppContext();
  
  const today = useMemo(() => new Date(), []);
  const todayKey = format(today, 'yyyy-MM-dd');
  const weekKey = format(today, "yyyy-'W'II");

  const [locationStatus, setLocationStatus] = useState<'checking' | 'inside' | 'outside' | 'error'>('checking');
  const [distance, setDistance] = useState<number | null>(null);

  const [showSessionAlert, setShowSessionAlert] = useState(false);
  const [gracePeriod, setGracePeriod] = useState(GRACE_PERIOD_SECONDS);

  const daysUntilReset = useMemo(() => {
    const nextMonth = startOfMonth(addMonths(today, 1));
    return differenceInDays(nextMonth, today);
  }, [today]);

  const dailyStatRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'dailyStudentStats', todayKey, 'students', user.uid);
  }, [firestore, activeMembership, user, todayKey]);
  const { data: dailyStat, isLoading: dailyStatLoading } = useDoc<DailyStudentStat>(dailyStatRef, { enabled: isActive });

  const studyLogRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days', todayKey);
  }, [firestore, activeMembership, user, todayKey]);
  const { data: todayStudyLog, isLoading: todayStudyLogLoading } = useDoc<StudyLogDay>(studyLogRef, { enabled: isActive });

  const allPlansRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
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
    if (!navigator.geolocation) {
      setLocationStatus('error');
      return;
    }

    setLocationStatus('checking');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const dist = calculateDistance(
          position.coords.latitude,
          position.coords.longitude,
          TARGET_LAT,
          TARGET_LON
        );
        setDistance(dist);
        if (dist <= DISTANCE_THRESHOLD_KM) {
          setLocationStatus('inside');
        } else {
          setLocationStatus('outside');
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationStatus('error');
      },
      { enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    if (isActive) {
      checkLocation();
    }
  }, [isActive, checkLocation]);
  
  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (!firestore || !user || !activeMembership) return;
    const itemRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id);
    
    updateDoc(itemRef, {
      done: !item.done,
      updatedAt: serverTimestamp(),
    }).catch(e => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: itemRef.path,
        operation: 'update',
        requestResourceData: { done: !item.done }
      }));
    });

    if (!item.done) {
      const progressRef = doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
      setDoc(progressRef, {
        stats: { achievement: increment(0.2) },
        currentXp: increment(20),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  };

  const handleStudyEndAutomatically = () => {
    if (!isTimerActive) return;
    saveStudyTime();
    setIsTimerActive(false);
    setStartTime(null);
    setLastActiveCheckTime(null);
    setShowSessionAlert(false);
    toast({
      title: "장시간 미응답으로 자동 종료",
      description: "2시간 세션이 만료되어 학습 시간이 저장되었습니다.",
    });
  };

  const saveStudyTime = () => {
    if (!firestore || !user || !activeMembership || !studyLogRef) return;
    
    const sessionMinutes = Math.floor(secondsElapsed / 60);
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

    setDoc(studyLogRef, data, { merge: true })
      .catch((e) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: studyLogRef.path,
          operation: 'write',
          requestResourceData: data
        }));
      });

    const progressRef = doc(firestore, 'centers', activeMembership.id, 'growthProgress', user.uid);
    const focusGain = (sessionMinutes / 60); 
    
    setDoc(progressRef, {
      stats: {
        focus: increment(Number(focusGain.toFixed(2))),
        consistency: increment(0.2),
        resilience: sessionMinutes >= 180 ? increment(1) : increment(0)
      },
      currentXp: increment(sessionMinutes),
      updatedAt: serverTimestamp()
    }, { merge: true });
  };

  const handleStudyStartStop = () => {
    if (!firestore || !user || !activeMembership || !studyLogRef) return;

    if (isTimerActive) {
      const sessionMinutes = Math.floor(secondsElapsed / 60);
      saveStudyTime();
      setIsTimerActive(false);
      setStartTime(null);
      setLastActiveCheckTime(null);
      setSecondsElapsed(0);
      toast({
        title: "공부 종료 및 기록 완료",
        description: `이번 세션에서 ${sessionMinutes}분 동안 학습하셨습니다.`,
      });
    } else {
      const now = Date.now();
      setStartTime(now);
      setLastActiveCheckTime(now);
      setIsTimerActive(true);
      setSecondsElapsed(0);
      toast({
        title: "공부 모드 시작!",
        description: "동백센터 학습 구역에 입장하셨습니다. 집중력을 발휘해 보세요!",
      });
    }
  };

  const handleMaintainSession = () => {
    setShowSessionAlert(false);
    setLastActiveCheckTime(Date.now());
    toast({
      title: "학습 세션 유지",
      description: "집중을 계속 이어가세요! 화이팅!",
    });
  };

  const handleManualSessionReset = () => {
    setLastActiveCheckTime(Date.now());
    toast({
      title: "세션 연장 완료",
      description: "2시간이 다시 충전되었습니다.",
    });
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isActive) {
    return null;
  }

  const growthRate = (dailyStat?.studyTimeGrowthRate ?? 0) * 100;
  const growthSign = growthRate >= 0 ? '+' : '';
  const completionRate = (dailyStat?.weeklyPlanCompletionRate ?? 0) * 100;
  const attendanceDays = dailyStat?.attendanceStreakDays ?? 0;

  // 학습 시간 포맷팅 (0시간 0분 스타일)
  const totalMinutes = todayStudyLog?.totalMinutes || 0;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  return (
    <div className="flex flex-col gap-6 pb-10">
      <AlertDialog open={showSessionAlert} onOpenChange={setShowSessionAlert}>
        <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-black flex items-center gap-2">
              <History className="h-6 w-6 text-primary animate-spin-slow" />
              학습 세션을 유지할까요?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base font-bold text-muted-foreground pt-2">
              어느덧 2시간이 지났습니다! 아직 집중하고 계신가요?<br />
              <span className="text-destructive font-black">
                {gracePeriod}초
              </span> 후 응답이 없으면 학습이 자동으로 저장되고 종료됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-4">
            <AlertDialogAction 
              onClick={handleMaintainSession}
              className="bg-primary text-primary-foreground font-black px-8 h-12 rounded-2xl hover:scale-105 transition-all"
            >
              학습세션 유지
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="bg-primary/5 border border-primary/10 rounded-3xl p-4 flex items-center justify-between backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-2xl">
            <CalendarClock className="h-5 w-5 text-primary" />
          </div>
          <div className="text-sm font-bold">
            <span className="font-black text-primary text-base">{format(today, 'M월')} 시즌</span> 진행 중
          </div>
        </div>
        <div className="text-[11px] font-black text-muted-foreground bg-white/50 px-4 py-2 rounded-2xl border border-border/50">
          시즌 종료까지 <span className="text-primary font-black">{daysUntilReset}일</span>
        </div>
      </div>

      <section className="group relative overflow-hidden rounded-[2.5rem] bg-primary p-6 sm:p-8 text-primary-foreground shadow-2xl transition-all duration-500 hover:shadow-primary/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent opacity-20 transition-opacity group-hover:opacity-40" />
        <div className="relative z-10 flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
          <div className="space-y-3">
            <h2 className="text-2xl font-black tracking-tighter sm:text-3xl leading-tight">
              {isTimerActive ? "몰입의 즐거움을\n경험하세요!" : "오늘의 성장을\n지금 시작할까요?"}
            </h2>
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-2 text-primary-foreground/70 font-black bg-white/10 w-fit px-4 py-2 rounded-2xl backdrop-blur-sm border border-white/10 text-[11px]">
                <MapPin className="h-3 w-3 text-accent animate-pulse" />
                {locationStatus === 'checking' && "위치 확인 중..."}
                {locationStatus === 'inside' && "동백센터 구역 내"}
                {locationStatus === 'outside' && `구역 밖 (${distance?.toFixed(1)}km)`}
                {locationStatus === 'error' && "위치 권한 필요"}
              </p>
              <p className="text-[10px] text-primary-foreground/50 font-bold ml-1">
                ※ 2시간 미응답 시 세션 자동 종료 (중간 연장 가능)
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            {isTimerActive && (
              <div className="flex flex-col items-center gap-0.5 bg-white/10 backdrop-blur-xl px-7 py-4 rounded-3xl border border-white/20 shadow-inner animate-pulse-soft relative group/timer">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest opacity-70">
                  <Timer className="h-3 w-3" />
                  <span>진행 시간</span>
                </div>
                <span className="text-4xl font-mono font-black tracking-tighter">
                  {formatTime(secondsElapsed)}
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleManualSessionReset}
                  className="mt-2 h-7 rounded-xl bg-white/10 text-[10px] font-black hover:bg-white/20 hover:text-white border-white/10"
                >
                  <RefreshCw className="mr-1.5 h-3 w-3" />
                  세션 연장
                </Button>
              </div>
            )}
            
            <Button 
              size="lg" 
              className={cn(
                "h-16 w-full rounded-[1.5rem] px-10 text-xl font-black transition-all md:w-auto shadow-xl active:scale-95",
                isTimerActive 
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" 
                  : locationStatus === 'inside' 
                    ? "bg-accent text-accent-foreground hover:scale-105 hover:shadow-accent/40 hover:bg-accent/90" 
                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              )}
              disabled={!isTimerActive && locationStatus !== 'inside'}
              onClick={handleStudyStartStop}
            >
              {isTimerActive ? (
                <>
                  <Square className="mr-2 h-6 w-6 fill-current" />
                  학습 마침
                </>
              ) : (
                <>
                  <Play className="mr-3 h-7 w-7 fill-current" />
                  학습 시작
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      {scheduleItems.length > 0 && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
          {scheduleItems.map((item) => {
            const [title, time] = item.title.split(': ');
            return (
              <Card key={item.id} className="bg-card/50 backdrop-blur-sm border-dashed rounded-3xl transition-all hover:scale-105 hover:border-primary/50 group">
                <CardContent className="p-4 flex flex-col items-center justify-center gap-1 text-center">
                  <span className="text-[10px] font-black text-muted-foreground/50 group-hover:text-primary/50 uppercase tracking-widest transition-colors">{title}</span>
                  <span className="text-lg font-black text-primary">{time || '-'}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/study-history">
          <Card className="cursor-pointer transition-all duration-300 hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98] group h-full border border-border/50 bg-card/80 backdrop-blur-sm rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-black text-muted-foreground group-hover:text-primary transition-colors">오늘의 학습 시간</CardTitle>
              <div className="bg-primary/5 p-1.5 rounded-lg group-hover:bg-primary/10 transition-colors">
                <Clock className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:rotate-12 transition-all" />
              </div>
            </CardHeader>
            <CardContent>
              {todayStudyLogLoading ? (
                <Skeleton className="h-8 w-24 mt-1" />
              ) : (
                <div className="flex items-center gap-1 justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black tracking-tighter">
                      {h}시간 {m}분
                    </span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-2 text-[10px] font-black text-primary/60 uppercase tracking-widest">
                 <Activity className="h-3 w-3" />
                 <span>학습 히스토리</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <GamifiedStatCard 
          title="월간 완수율"
          icon={ClipboardCheck}
          value={`${Math.round(completionRate)}%`}
          numericValue={completionRate}
          dailyValue={todayCompletionRate}
          evolution="시즌 마스터리 도전"
          isLoading={dailyStatLoading}
          type="completion"
          gameTitle="완수 마스터"
        />
        
        <GamifiedStatCard 
          title="월간 출석 (3h+)"
          icon={Zap}
          value={`${attendanceDays} 일`}
          numericValue={attendanceDays}
          dailyValue={todayStudyLog?.totalMinutes || 0}
          dailyUnit="분"
          evolution="몰입 시간 달성"
          isLoading={dailyStatLoading}
          type="attendance"
          gameTitle="출석 킹"
        />

        <GamifiedStatCard 
          title="월간 성장 지수"
          icon={TrendingUp}
          value={`${growthSign}${Math.round(growthRate)}%`}
          numericValue={growthRate}
          dailyValue={growthRate}
          evolution="능력치 상승 중"
          isLoading={dailyStatLoading}
          type="growth"
          gameTitle="성장 챔피언"
        />
      </div>

      <Card className="w-full rounded-[2.5rem] border border-border/50 bg-card/50 backdrop-blur-xl shadow-xl overflow-hidden">
        <CardHeader className="flex flex-row items-center p-8 bg-muted/20">
          <div className="grid gap-1">
            <CardTitle className="text-2xl font-black tracking-tighter">오늘의 자습 계획</CardTitle>
            <CardDescription className="font-bold text-muted-foreground/70 text-xs">성취를 위한 마지막 한 걸음</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline" className="ml-auto gap-2 rounded-2xl border-2 font-black transition-all hover:bg-primary hover:text-white h-10 px-5">
            <Link href="/dashboard/plan">
              계획 관리
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-8 grid gap-4">
          {plansLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => <Skeleton className="h-16 w-full rounded-2xl" key={i} />)}
            </div>
          ) : studyTasks.length > 0 ? (
              studyTasks.map((task) => (
                <div key={task.id} className="group flex items-center space-x-4 rounded-[1.5rem] border border-border/50 p-5 bg-white/50 hover:bg-white hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300">
                  <div className="relative flex items-center">
                    <Checkbox 
                      id={task.id} 
                      checked={task.done} 
                      onCheckedChange={() => handleToggleTask(task as WithId<StudyPlanItem>)} 
                      className="h-6 w-6 rounded-lg border-2"
                    />
                  </div>
                  <Label
                    htmlFor={task.id}
                    className={cn(
                      "flex-1 text-base font-bold leading-none cursor-pointer transition-all",
                      task.done ? "line-through text-muted-foreground opacity-50" : "text-foreground group-hover:text-primary"
                    )}
                  >
                    {task.title}
                  </Label>
                  {task.done && <CheckCircle2 className="h-5 w-5 text-emerald-500" />}
                </div>
              ))
          ) : (
              <div className="text-center text-muted-foreground py-16 flex flex-col items-center gap-4">
                <div className="bg-muted/50 p-4 rounded-full">
                  <CircleDot className="h-10 w-10 opacity-30" />
                </div>
                <div className="grid gap-1">
                  <p className="text-lg font-black">오늘 세워진 자습 계획이 없어요.</p>
                  <p className="text-xs font-bold opacity-60">미리 계획을 세우면 더 높은 완수율을 달성할 수 있습니다.</p>
                </div>
                <Link href="/dashboard/plan">
                   <Button variant="link" className="font-black text-primary text-base p-0 mt-2">지금 계획하러 가기 →</Button>
                </Link>
              </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}