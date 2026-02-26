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
  Coffee,
  School,
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
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { DailyStudentStat, StudyPlanItem, WithId, StudyLogDay } from '@/lib/types';
import { doc, collection, query, where, limit, updateDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { format, startOfMonth, differenceInDays, addMonths } from 'date-fns';
import { useEffect, useState, useCallback, useMemo } from 'react';
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
  evolution, 
  isLoading, 
  type,
  gameTitle,
}: { 
  title: string, 
  icon: React.ElementType, 
  value?: string, 
  numericValue: number,
  evolution?: string, 
  isLoading: boolean,
  type: MetricType,
  gameTitle: string,
}) {
  const rankData = getRankData(numericValue, type);
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="cursor-pointer group relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] border border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium transition-colors group-hover:text-primary">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:rotate-12 transition-all duration-300" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-24 mt-1" />
                <Skeleton className="h-4 w-32 mt-2" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold tracking-tight">{value}</div>
                <div className="flex items-center gap-1.5 mt-2">
                   <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full transition-transform group-hover:scale-110", rankData.current.bg, rankData.current.color)}>
                     {rankData.current.name}
                   </span>
                   <p className="text-[10px] text-muted-foreground">{evolution}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <div className="mx-auto bg-primary/10 p-5 rounded-full mb-3 animate-float">
            <Trophy className={cn("h-14 w-14", rankData.current.color)} />
          </div>
          <DialogTitle className="text-center text-3xl font-bold tracking-tight">{gameTitle}</DialogTitle>
          <DialogDescription className="text-center text-lg mt-2 font-medium">
            이번 시즌 티어: <span className={cn("font-bold", rankData.current.color)}>{rankData.current.name}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {type === 'attendance' && (
            <Alert className="bg-destructive/5 border-destructive/20 text-destructive rounded-2xl">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs font-bold uppercase tracking-wider">엄격한 출석 기준 (3시간 룰)</AlertTitle>
              <AlertDescription className="text-[11px] leading-relaxed font-medium">
                출석 등급은 단순히 등원한 날이 아닌, **일일 3시간(180분) 이상 학습을 완료한 날**만 카운트됩니다. 몰입의 시간을 확보하세요!
              </AlertDescription>
            </Alert>
          )}

          {rankData.next && (
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-semibold">
                <span>다음 목표: {rankData.next.name}</span>
                <span className="font-mono">{rankData.currentValue.toFixed(1)} / {rankData.nextThreshold}</span>
              </div>
              <Progress 
                value={Math.min(100, (rankData.currentValue / rankData.nextThreshold) * 100)} 
                className="h-2.5 rounded-full overflow-hidden bg-secondary" 
              />
              <p className="text-[11px] text-muted-foreground text-center italic font-medium">
                {type === 'completion' && `월간 완수율을 ${(rankData.nextThreshold - rankData.currentValue).toFixed(1)}% 더 올리면 승급합니다!`}
                {type === 'attendance' && `3시간 이상 학습한 날을 ${Math.ceil(rankData.nextThreshold - rankData.currentValue)}일 더 채우면 다음 단계로!`}
                {type === 'growth' && `성장 지수를 ${(rankData.nextThreshold - rankData.currentValue).toFixed(1)}% 높여 능력을 증명하세요!`}
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-border/50 bg-muted/20 overflow-hidden shadow-inner">
            <div className="bg-muted/40 px-5 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/70">
                <Info className="h-4 w-4" />
                <span>시즌 등급 달성 조건</span>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground">단위: {type === 'attendance' ? '일' : '%'}</span>
            </div>
            <div className="p-2 space-y-1.5">
              {RANKS.map((r, idx) => (
                <div key={r.name} className={cn(
                  "flex items-center justify-between px-4 py-2.5 rounded-xl text-xs transition-all duration-300",
                  rankData.current.name === r.name 
                    ? cn("bg-white shadow-lg ring-1 scale-[1.03] z-10", r.border) 
                    : "opacity-40 grayscale-[0.3] scale-[0.98]"
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn("h-2.5 w-2.5 rounded-full shadow-sm", r.bg.replace('bg-', 'bg-opacity-100 bg-'))} />
                    <span className={cn("font-bold tracking-tight", r.color)}>{r.name}</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono font-bold">
                    <span className="text-muted-foreground text-[10px] mr-1 font-medium">이상</span>
                    {RANK_THRESHOLDS[type][idx]}
                  </div>
                </div>
              ))}
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
  const { activeMembership } = useAppContext();
  
  const today = useMemo(() => new Date(), []);
  const todayKey = format(today, 'yyyy-MM-dd');
  const weekKey = format(today, "yyyy-'W'II");

  const [locationStatus, setLocationStatus] = useState<'checking' | 'inside' | 'outside' | 'error'>('checking');
  const [distance, setDistance] = useState<number | null>(null);

  const [isTimerActive, setIsTimerActive] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive]);

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
    await updateDoc(itemRef, {
      done: !item.done,
      updatedAt: serverTimestamp(),
    });
  };

  const handleStudyStart = async () => {
    if (!firestore || !user || !activeMembership || !studyLogRef) return;

    if (isTimerActive) {
      setIsTimerActive(false);
      const sessionMinutes = Math.floor(secondsElapsed / 60);
      
      try {
        await setDoc(studyLogRef, {
          totalMinutes: increment(sessionMinutes),
          uid: user.uid,
          centerId: activeMembership.id,
          dateKey: todayKey,
          updatedAt: serverTimestamp(),
          studentId: user.uid,
          createdAt: serverTimestamp(),
        }, { merge: true });

        toast({
          title: "공부 종료 및 기록 완료",
          description: `이번 세션에서 ${sessionMinutes}분 동안 학습하셨습니다.`,
        });
      } catch (error) {
        console.error("Failed to update study minutes:", error);
        toast({ variant: 'destructive', title: '기록 실패', description: '학습 시간을 저장하지 못했습니다.' });
      }
      setSecondsElapsed(0);
    } else {
      setIsTimerActive(true);
      setSecondsElapsed(0);
      toast({
        title: "공부 모드 시작!",
        description: "동백센터 학습 구역에 입장하셨습니다. 집중력을 발휘해 보세요!",
      });
    }
  };

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

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div className="bg-primary/5 border border-primary/10 rounded-3xl p-5 flex items-center justify-between backdrop-blur-sm shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-2.5 rounded-2xl">
            <CalendarClock className="h-6 w-6 text-primary" />
          </div>
          <div className="text-sm font-medium">
            <span className="font-bold text-primary text-base">{format(today, 'M월')} 시즌</span> 진행 중
          </div>
        </div>
        <div className="text-xs font-bold text-muted-foreground bg-white/50 px-4 py-2 rounded-full border border-border/50">
          시즌 종료까지 <span className="text-primary font-black">{daysUntilReset}일</span>
        </div>
      </div>

      <section className="group relative overflow-hidden rounded-[2.5rem] bg-primary p-10 text-primary-foreground shadow-2xl transition-all duration-500 hover:shadow-primary/20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-accent opacity-20 transition-opacity group-hover:opacity-40" />
        <div className="relative z-10 flex flex-col items-center gap-8 text-center md:flex-row md:justify-between md:text-left">
          <div className="space-y-4">
            <h2 className="text-4xl font-black tracking-tight sm:text-5xl leading-tight">
              {isTimerActive ? "몰입의 즐거움을\n경험하세요!" : "오늘의 성장을\n지금 시작할까요?"}
            </h2>
            <p className="flex items-center gap-2.5 text-primary-foreground/70 font-semibold bg-white/10 w-fit px-4 py-2 rounded-2xl backdrop-blur-sm border border-white/10">
              <MapPin className="h-4 w-4 text-accent animate-pulse" />
              {locationStatus === 'checking' && "위치 정보를 확인 중..."}
              {locationStatus === 'inside' && "동백센터 학습 구역 내 확인"}
              {locationStatus === 'outside' && `학습 구역 밖 (${distance?.toFixed(1)}km)`}
              {locationStatus === 'error' && "위치 권한 확인 필요"}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 w-full md:w-auto">
            {isTimerActive && (
              <div className="flex flex-col items-center gap-1 bg-white/10 backdrop-blur-xl px-8 py-5 rounded-[2rem] border border-white/20 shadow-inner animate-pulse-soft">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-70">
                  <Timer className="h-4 w-4" />
                  <span>진행 시간</span>
                </div>
                <span className="text-5xl font-mono font-black tracking-tighter">
                  {formatTime(secondsElapsed)}
                </span>
              </div>
            )}
            
            <Button 
              size="lg" 
              className={cn(
                "h-24 w-full rounded-[2rem] px-10 text-2xl font-black transition-all md:w-auto shadow-2xl active:scale-95",
                isTimerActive 
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" 
                  : locationStatus === 'inside' 
                    ? "bg-accent text-accent-foreground hover:scale-110 hover:shadow-accent/40 hover:bg-accent/90" 
                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              )}
              disabled={!isTimerActive && locationStatus !== 'inside'}
              onClick={handleStudyStart}
            >
              {isTimerActive ? (
                <>
                  <Square className="mr-3 h-8 w-8 fill-current" />
                  학습 마침
                </>
              ) : (
                <>
                  <Play className="mr-4 h-10 w-10 fill-current" />
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
              <Card key={item.id} className="bg-card/50 backdrop-blur-sm border-dashed rounded-3xl transition-transform hover:scale-105">
                <CardContent className="p-4 flex flex-col items-center justify-center gap-2 text-center">
                  <span className="text-[11px] font-black text-primary/50 uppercase tracking-widest">{title}</span>
                  <span className="text-lg font-black text-primary">{time || '-'}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/study-history">
          <Card className="cursor-pointer transition-all duration-300 hover:shadow-2xl hover:scale-[1.05] active:scale-[0.98] group h-full border border-border/50 bg-card/80 backdrop-blur-sm rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-bold text-muted-foreground group-hover:text-primary transition-colors">오늘의 학습 시간</CardTitle>
              <div className="bg-primary/5 p-2 rounded-xl group-hover:bg-primary/10 transition-colors">
                <Clock className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:rotate-12 transition-all" />
              </div>
            </CardHeader>
            <CardContent>
              {todayStudyLogLoading ? (
                <Skeleton className="h-10 w-28 mt-1" />
              ) : (
                <div className="flex items-center gap-1 justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black tracking-tight">{todayStudyLog?.totalMinutes || 0}</span>
                    <span className="text-sm font-bold text-muted-foreground">분</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-2 transition-transform" />
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-2 text-[10px] font-bold text-primary opacity-60">
                 <Activity className="h-3 w-3" />
                 <span>전체 히스토리 확인하기</span>
              </div>
            </CardContent>
          </Card>
        </Link>

        <GamifiedStatCard 
          title="월간 완수율"
          icon={ClipboardCheck}
          value={`${Math.round(completionRate)}%`}
          numericValue={completionRate}
          evolution="시즌 마스터리 도전 중"
          isLoading={dailyStatLoading}
          type="completion"
          gameTitle="완수 마스터"
        />
        
        <GamifiedStatCard 
          title="월간 출석 (3h+)"
          icon={Zap}
          value={`${attendanceDays} 일`}
          numericValue={attendanceDays}
          evolution="몰입 시간 달성 기준"
          isLoading={dailyStatLoading}
          type="attendance"
          gameTitle="출석 킹"
        />

        <GamifiedStatCard 
          title="월간 성장 지수"
          icon={TrendingUp}
          value={`${growthSign}${Math.round(growthRate)}%`}
          numericValue={growthRate}
          evolution="능력치 비약적 상승"
          isLoading={dailyStatLoading}
          type="growth"
          gameTitle="성장 챔피언"
        />
      </div>

      <Card className="w-full rounded-[2.5rem] border border-border/50 bg-card/50 backdrop-blur-xl shadow-xl overflow-hidden">
        <CardHeader className="flex flex-row items-center p-8 bg-muted/20">
          <div className="grid gap-2">
            <CardTitle className="text-2xl font-black tracking-tight">오늘의 자습 계획</CardTitle>
            <CardDescription className="font-bold text-muted-foreground">성취를 위한 마지막 한 걸음</CardDescription>
          </div>
          <Button asChild size="lg" variant="outline" className="ml-auto gap-2 rounded-2xl border-2 font-bold transition-all hover:bg-primary hover:text-white">
            <Link href="/dashboard/plan">
              관리
              <ArrowUpRight className="h-5 w-5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-8 grid gap-4">
          {plansLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
            </div>
          ) : studyTasks.length > 0 ? (
              studyTasks.map((task) => (
                <div key={task.id} className="group flex items-center space-x-4 rounded-3xl border border-border/50 p-6 hover:bg-white hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] transition-all duration-300">
                  <div className="relative flex items-center">
                    <Checkbox 
                      id={task.id} 
                      checked={task.done} 
                      onCheckedChange={() => handleToggleTask(task)} 
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
                </div>
              ))
          ) : (
              <div className="text-center text-muted-foreground py-16 flex flex-col items-center gap-4">
                <div className="bg-muted/50 p-4 rounded-full">
                  <Info className="h-10 w-10 opacity-30" />
                </div>
                <p className="text-lg font-bold">오늘 세워진 자습 계획이 없어요.</p>
                <Link href="/dashboard/plan">
                   <Button variant="link" className="font-black text-primary text-base">지금 계획하러 가기 →</Button>
                </Link>
              </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}