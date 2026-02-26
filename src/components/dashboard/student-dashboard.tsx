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
  Save,
  MapPin,
  Play,
  Trophy,
  Sparkles,
  Zap,
  Square,
  Timer,
  Info,
  ChevronRight,
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
import { doc, collection, query, where, limit, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { format, getISOWeek } from 'date-fns';
import { useEffect, useState, useCallback } from 'react';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';
import { Progress } from '../ui/progress';

// --- 등급 정의 및 세부 메커니즘 ---
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

// 지표별 랭크 임계치 설정 (깐깐한 기준)
const RANK_THRESHOLDS: Record<MetricType, number[]> = {
  completion: [98, 95, 90, 85, 75, 65, 50, 0], // 완수율 (%)
  attendance: [100, 60, 30, 21, 14, 7, 3, 0],   // 연속 출석 (일)
  growth: [150, 100, 75, 50, 25, 10, 0, -100],  // 성장률 (%)
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
            현재 티어: <span className={cn("font-extrabold", rankData.current.color)}>{rankData.current.name}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Progress Section */}
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
                {type === 'completion' && `완수율을 ${(rankData.nextThreshold - rankData.currentValue).toFixed(1)}% 더 올리면 승급합니다!`}
                {type === 'attendance' && `출석 ${rankData.nextThreshold - rankData.currentValue}일만 더 채우면 다음 단계로!`}
                {type === 'growth' && `성장률을 ${(rankData.nextThreshold - rankData.currentValue).toFixed(1)}% 높여 능력을 증명하세요!`}
              </p>
            </div>
          )}

          {/* Full Rank Mechanism Table */}
          <div className="rounded-xl border bg-muted/30 overflow-hidden shadow-sm">
            <div className="bg-muted/80 px-4 py-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <Info className="h-3.5 w-3.5 text-primary" />
                <span>등급 달성 메커니즘</span>
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
          
          <div className="text-center text-[11px] text-muted-foreground bg-secondary/50 p-3 rounded-lg border border-dashed">
            💡 등급은 매일 자정, 최신 학습 데이터를 바탕으로 갱신됩니다. <br/>
            꾸준함이 챌린저를 만드는 가장 빠른 길입니다!
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
  
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const weekKey = `${format(new Date(), 'yyyy')}-W${getISOWeek(new Date())}`;

  const [minutesInput, setMinutesInput] = useState('');
  const [isSavingMinutes, setIsSavingMinutes] = useState(false);
  
  const [locationStatus, setLocationStatus] = useState<'checking' | 'inside' | 'outside' | 'error'>('checking');
  const [distance, setDistance] = useState<number | null>(null);

  const [isTimerActive, setIsTimerActive] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const dailyStatRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'dailyStudentStats', todayKey, 'students', user.uid);
  }, [firestore, activeMembership, user, todayKey]);
  const { data: dailyStat, isLoading: dailyStatLoading } = useDoc<DailyStudentStat>(dailyStatRef, { enabled: isActive });

  const studyLogRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'studyLogs', user.uid, 'days', todayKey);
  }, [firestore, activeMembership, user, todayKey]);
  const { data: studyLog, isLoading: studyLogLoading } = useDoc<StudyLogDay>(studyLogRef, { enabled: isActive });

  const planItemsRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items'),
      where('done', '==', false),
      limit(5)
    );
  }, [firestore, activeMembership, user, weekKey]);
  const { data: planItems, isLoading: planItemsLoading } = useCollection<StudyPlanItem>(planItemsRef, { enabled: isActive });
  
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

  useEffect(() => {
    if (studyLog) {
      setMinutesInput(String(studyLog.totalMinutes));
    } else {
      setMinutesInput('0');
    }
  }, [studyLog]);
  
  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (!firestore || !user || !activeMembership) return;
    const itemRef = doc(firestore, 'centers', activeMembership.id, 'plans', user.uid, 'weeks', weekKey, 'items', item.id);
    await updateDoc(itemRef, {
      done: !item.done,
      updatedAt: serverTimestamp(),
    });
  };

  const handleSetMinutes = async () => {
    if (!firestore || !user || !activeMembership || !studyLogRef) return;
    
    const newMinutes = parseInt(minutesInput, 10);
    if (isNaN(newMinutes) || newMinutes < 0) {
      toast({ variant: 'destructive', title: '유효하지 않은 값', description: '0 이상의 숫자를 입력해주세요.' });
      return;
    }
    
    setIsSavingMinutes(true);
    try {
      await setDoc(studyLogRef, {
        totalMinutes: newMinutes,
        uid: user.uid,
        centerId: activeMembership.id,
        dateKey: todayKey,
        updatedAt: serverTimestamp(),
        studentId: user.uid,
      }, { merge: true });
      toast({ title: '저장 완료', description: `오늘의 학습 시간이 ${newMinutes}분으로 기록되었습니다.` });
    } catch (error) {
      console.error("Failed to save study minutes:", error);
      toast({ variant: 'destructive', title: '저장 실패', description: '학습 시간을 저장하는 중 오류가 발생했습니다.' });
    } finally {
      setIsSavingMinutes(false);
    }
  };

  const handleStudyStart = () => {
    if (isTimerActive) {
      setIsTimerActive(false);
      const minutes = Math.floor(secondsElapsed / 60);
      toast({
        title: "공부 종료",
        description: `오늘 세션에서 ${minutes}분 동안 학습하셨습니다.`,
      });
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
        <div className="absolute -bottom-12 -right-12 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -top-12 -left-12 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
      </section>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-muted/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘의 학습 시간</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {studyLogLoading ? (
              <Skeleton className="h-8 w-24 mt-1" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-baseline gap-1">
                  <Input 
                    type="number" 
                    className="text-2xl font-bold h-10 w-16 p-0 border-0 shadow-none focus-visible:ring-0 bg-transparent" 
                    value={minutesInput}
                    onChange={(e) => setMinutesInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSetMinutes()}
                  />
                  <span className="text-sm text-muted-foreground">분</span>
                </div>
                <Button size="sm" variant="ghost" onClick={handleSetMinutes} disabled={isSavingMinutes} className="h-8 w-8 p-0 ml-auto">
                  {isSavingMinutes ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <GamifiedStatCard 
          title="주간 완수율"
          icon={ClipboardCheck}
          value={`${Math.round(completionRate)}%`}
          numericValue={completionRate}
          evolution="계획 달성 점수"
          isLoading={dailyStatLoading}
          type="completion"
          gameTitle="완수 마스터"
        />
        
        <GamifiedStatCard 
          title="연속 출석"
          icon={Zap}
          value={`${attendanceDays} 일`}
          numericValue={attendanceDays}
          evolution="꾸준함의 기록"
          isLoading={dailyStatLoading}
          type="attendance"
          gameTitle="출석 킹"
        />

        <GamifiedStatCard 
          title="성장 지수"
          icon={TrendingUp}
          value={`${growthSign}${Math.round(growthRate)}%`}
          numericValue={growthRate}
          evolution="학습 시간 변화율"
          isLoading={dailyStatLoading}
          type="growth"
          gameTitle="성장 챔피언"
        />
      </div>

      <Card className="w-full">
        <CardHeader className="flex flex-row items-center space-y-0">
          <div className="grid gap-1">
            <CardTitle className="text-xl">오늘의 학습 계획</CardTitle>
            <CardDescription>남은 목표를 달성해 보세요.</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline" className="ml-auto gap-1">
            <Link href="/dashboard/plan">
              전체 보기
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3">
          {planItemsLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : planItems && planItems.length > 0 ? (
              planItems.map((task) => (
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
              <div className="text-center text-muted-foreground py-10 text-sm">오늘 남은 계획이 없습니다!</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}