
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

// --- 월간 시즌 등급 정의 ---
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
        <Card className="cursor-pointer hover:border-primary transition-all hover:shadow-md group relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-24 mt-1" />
                <Skeleton className="h-4 w-32 mt-2" />
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">{value}</div>
                <div className="flex items-center gap-1.5 mt-1">
                   <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", rankData.current.bg, rankData.current.color)}>
                     {rankData.current.name}
                   </span>
                   <p className="text-[10px] text-muted-foreground">{evolution}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="mx-auto bg-primary/10 p-4 rounded-full mb-2">
            <Trophy className={cn("h-12 w-12 animate-bounce", rankData.current.color)} />
          </div>
          <DialogTitle className="text-center text-2xl font-headline">{gameTitle}</DialogTitle>
          <DialogDescription className="text-center text-lg mt-1">
            이번 시즌 티어: <span className={cn("font-extrabold", rankData.current.color)}>{rankData.current.name}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {type === 'attendance' && (
            <Alert className="bg-destructive/10 border-destructive/20 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs font-bold uppercase tracking-tight">엄격한 출석 기준 (3시간 룰)</AlertTitle>
              <AlertDescription className="text-[11px] leading-relaxed">
                출석 등급은 단순히 등원한 날이 아닌, **일일 3시간(180분) 이상 학습을 완료한 날**만 카운트됩니다. 몰입의 시간을 확보하세요!
              </AlertDescription>
            </Alert>
          )}

          {rankData.next && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span>다음 목표: {rankData.next.name}</span>
                <span>{rankData.currentValue.toFixed(1)} / {rankData.nextThreshold}</span>
              </div>
              <Progress 
                value={Math.min(100, (rankData.currentValue / rankData.nextThreshold) * 100)} 
                className="h-2" 
              />
              <p className="text-[11px] text-muted-foreground text-center italic">
                {type === 'completion' && `월간 완수율을 ${(rankData.nextThreshold - rankData.currentValue).toFixed(1)}% 더 올리면 승급합니다!`}
                {type === 'attendance' && `3시간 이상 학습한 날을 ${Math.ceil(rankData.nextThreshold - rankData.currentValue)}일 더 채우면 다음 단계로!`}
                {type === 'growth' && `성장 지수를 ${(rankData.nextThreshold - rankData.currentValue).toFixed(1)}% 높여 능력을 증명하세요!`}
              </p>
            </div>
          )}

          <div className="rounded-xl border bg-muted/30 overflow-hidden shadow-sm">
            <div className="bg-muted/80 px-4 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <Info className="h-3.5 w-3.5 text-primary" />
                <span>시즌 등급 달성 조건 (월간)</span>
              </div>
              <span className="text-[10px] text-muted-foreground">단위: {type === 'attendance' ? '일' : '%'}</span>
            </div>
            <div className="p-1.5 space-y-1 bg-white/50">
              {RANKS.map((r, idx) => (
                <div key={r.name} className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all",
                  rankData.current.name === r.name 
                    ? cn("bg-white shadow-md ring-1 scale-[1.02]", r.border) 
                    : "opacity-40 grayscale-[0.5]"
                )}>
                  <div className="flex items-center gap-2.5">
                    <div className={cn("h-2 w-2 rounded-full", r.bg.replace('bg-', 'bg-opacity-100 bg-'))} />
                    <span className={cn("font-bold", r.color)}>{r.name}</span>
                  </div>
                  <div className="flex items-center gap-1 font-mono font-semibold">
                    <span className="text-muted-foreground text-[10px] mr-1">이상</span>
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

  // 시즌 종료 카운트다운
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
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* 시즌 안내 배너 */}
      <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-accent" />
          <div className="text-sm">
            <span className="font-bold text-accent">{format(today, 'M월')} 시즌</span> 진행 중
          </div>
        </div>
        <div className="text-xs font-medium text-muted-foreground">
          시즌 종료까지 <span className="text-foreground font-bold">{daysUntilReset}일</span> 남음
        </div>
      </div>

      <section className="relative overflow-hidden rounded-3xl bg-primary p-8 text-primary-foreground shadow-2xl transition-all duration-500">
        <div className="relative z-10 flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
          <div className="space-y-3">
            <h2 className="text-3xl font-headline font-bold sm:text-4xl">
              {isTimerActive ? "집중하고 계신 모습이 멋져요!" : "오늘의 성장을 시작할까요?"}
            </h2>
            <p className="flex items-center gap-2 text-primary-foreground/80">
              <MapPin className="h-4 w-4" />
              {locationStatus === 'checking' && "위치 정보를 확인하고 있습니다..."}
              {locationStatus === 'inside' && "동백센터 학습 구역 안에 있습니다."}
              {locationStatus === 'outside' && `학습 구역 밖입니다. (약 ${distance?.toFixed(1)}km 거리)`}
              {locationStatus === 'error' && "위치 권한이 필요합니다."}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            {isTimerActive && (
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 animate-pulse">
                <Timer className="h-6 w-6 text-accent" />
                <span className="text-4xl font-mono font-bold tracking-tighter">
                  {formatTime(secondsElapsed)}
                </span>
              </div>
            )}
            
            <Button 
              size="lg" 
              className={cn(
                "h-20 w-full rounded-2xl px-8 text-2xl font-bold transition-all md:w-auto shadow-lg",
                isTimerActive 
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" 
                  : locationStatus === 'inside' 
                    ? "bg-accent text-accent-foreground hover:scale-105 hover:bg-accent/90" 
                    : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              )}
              disabled={!isTimerActive && locationStatus !== 'inside'}
              onClick={handleStudyStart}
            >
              {isTimerActive ? (
                <>
                  <Square className="mr-3 h-6 w-6 fill-current" />
                  공부 중단하기
                </>
              ) : (
                <>
                  <Play className="mr-3 h-8 w-8 fill-current" />
                  공부 시작하기
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* 오늘의 시간표 요약 */}
      {scheduleItems.length > 0 && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
          {scheduleItems.map((item) => {
            const [title, time] = item.title.split(': ');
            return (
              <Card key={item.id} className="bg-muted/30 border-dashed">
                <CardContent className="p-3 flex flex-col items-center justify-center gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground">{title}</span>
                  <span className="text-sm font-bold">{time || '--:--'}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/study-history">
          <Card className="cursor-pointer hover:border-primary transition-all hover:shadow-md group h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">오늘의 학습 시간</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              {todayStudyLogLoading ? (
                <Skeleton className="h-8 w-24 mt-1" />
              ) : (
                <div className="flex items-baseline gap-1 justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{todayStudyLog?.totalMinutes || 0}</span>
                    <span className="text-sm text-muted-foreground">분</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-1 italic">클릭하여 전체 히스토리 보기</p>
            </CardContent>
          </Card>
        </Link>

        <GamifiedStatCard 
          title="월간 완수율"
          icon={ClipboardCheck}
          value={`${Math.round(completionRate)}%`}
          numericValue={completionRate}
          evolution="시즌 목표 진행 중"
          isLoading={dailyStatLoading}
          type="completion"
          gameTitle="완수 마스터"
        />
        
        <GamifiedStatCard 
          title="월간 출석 (3h+)"
          icon={Zap}
          value={`${attendanceDays} 일`}
          numericValue={attendanceDays}
          evolution="3시간 학습일 기준"
          isLoading={dailyStatLoading}
          type="attendance"
          gameTitle="출석 킹"
        />

        <GamifiedStatCard 
          title="월간 성장 지수"
          icon={TrendingUp}
          value={`${growthSign}${Math.round(growthRate)}%`}
          numericValue={growthRate}
          evolution="능력치 상승"
          isLoading={dailyStatLoading}
          type="growth"
          gameTitle="성장 챔피언"
        />
      </div>

      <Card className="w-full">
        <CardHeader className="flex flex-row items-center space-y-0">
          <div className="grid gap-1">
            <CardTitle className="text-xl">오늘의 자습 계획</CardTitle>
            <CardDescription>남은 목표를 달성해 보세요.</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline" className="ml-auto gap-1">
            <Link href="/dashboard/study-history">
              관리하기
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {plansLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : studyTasks.length > 0 ? (
              studyTasks.map((task) => (
                <div key={task.id} className="flex items-center space-x-3 rounded-xl border p-4 hover:bg-muted/50 transition-colors">
                  <Checkbox id={task.id} checked={task.done} onCheckedChange={() => handleToggleTask(task)} />
                  <Label
                    htmlFor={task.id}
                    className={cn(
                      "flex-1 text-sm font-medium leading-none cursor-pointer",
                      task.done && "line-through text-muted-foreground"
                    )}
                  >
                    {task.title}
                  </Label>
                </div>
              ))
          ) : (
              <div className="text-center text-muted-foreground py-10 text-sm">오늘 기록된 자습 계획이 없습니다. 캘린더에서 계획을 세워보세요!</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
