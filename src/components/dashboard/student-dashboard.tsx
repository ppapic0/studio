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

// --- 등급 정의 및 계산 로직 ---
const RANKS = [
  { name: '챌린저', color: 'text-purple-600', bg: 'bg-purple-100', threshold: 95 },
  { name: '그랜드마스터', color: 'text-red-600', bg: 'bg-red-100', threshold: 90 },
  { name: '다이아몬드', color: 'text-blue-600', bg: 'bg-blue-100', threshold: 85 },
  { name: '에메랄드', color: 'text-emerald-600', bg: 'bg-emerald-100', threshold: 80 },
  { name: '플래티넘', color: 'text-cyan-600', bg: 'bg-cyan-100', threshold: 70 },
  { name: '골드', color: 'text-yellow-600', bg: 'bg-yellow-100', threshold: 60 },
  { name: '실버', color: 'text-gray-500', bg: 'bg-gray-200', threshold: 50 },
  { name: '브론즈', color: 'text-orange-700', bg: 'bg-orange-100', threshold: 0 },
] as const;

type MetricType = 'completion' | 'attendance' | 'growth';

function getRankData(value: number, type: MetricType) {
  // 출석일수는 다른 스케일 적용 (일수 기준)
  let adjustedValue = value;
  if (type === 'attendance') {
    if (value >= 90) adjustedValue = 95;
    else if (value >= 60) adjustedValue = 90;
    else if (value >= 30) adjustedValue = 85;
    else if (value >= 21) adjustedValue = 80;
    else if (value >= 14) adjustedValue = 70;
    else if (value >= 7) adjustedValue = 60;
    else if (value >= 3) adjustedValue = 50;
    else adjustedValue = 0;
  } else if (type === 'growth') {
    // 성장률은 -100 ~ +100 스케일을 0-100으로 매핑 (예시)
    adjustedValue = Math.max(0, Math.min(100, (value + 0.2) * 200)); 
  }

  const rank = RANKS.find(r => adjustedValue >= r.threshold) || RANKS[RANKS.length - 1];
  const nextRankIndex = RANKS.findIndex(r => r.name === rank.name) - 1;
  const nextRank = nextRankIndex >= 0 ? RANKS[nextRankIndex] : null;

  return { current: rank, next: nextRank, adjustedValue };
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto bg-primary/10 p-4 rounded-full mb-2">
            <Trophy className={cn("h-12 w-12 animate-bounce", rankData.current.color)} />
          </div>
          <DialogTitle className="text-center text-2xl font-headline">{gameTitle}</DialogTitle>
          <DialogDescription className="text-center text-lg mt-1">
            현재 랭크: <span className={cn("font-extrabold", rankData.current.color)}>{rankData.current.name}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Progress Section */}
          {rankData.next && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span>다음 목표: {rankData.next.name}</span>
                <span>{rankData.adjustedValue.toFixed(0)} / {rankData.next.threshold}</span>
              </div>
              <Progress value={(rankData.adjustedValue / rankData.next.threshold) * 100} className="h-2" />
              <p className="text-[11px] text-muted-foreground text-center italic">
                {type === 'completion' && `완수율을 ${(rankData.next.threshold - rankData.adjustedValue).toFixed(0)}% 더 올리면 승급합니다!`}
                {type === 'attendance' && `출석 일수를 조금 더 채워보세요!`}
                {type === 'growth' && `학습 시간을 늘려 성장을 증명하세요!`}
              </p>
            </div>
          )}

          {/* Rank Mechanism Table */}
          <div className="rounded-xl border bg-muted/50 overflow-hidden">
            <div className="bg-muted px-4 py-2 border-b flex items-center gap-2">
              <Info className="h-3 w-3" />
              <span className="text-[11px] font-bold uppercase tracking-wider">등급 달성 메커니즘</span>
            </div>
            <div className="p-2 space-y-1">
              {RANKS.slice(0, 5).map((r, idx) => (
                <div key={r.name} className={cn(
                  "flex items-center justify-between px-3 py-1.5 rounded-lg text-xs",
                  rankData.current.name === r.name ? "bg-white shadow-sm ring-1 ring-black/5" : "opacity-60"
                )}>
                  <div className="flex items-center gap-2">
                    <Sparkles className={cn("h-3 w-3", r.color)} />
                    <span className={cn("font-bold", r.color)}>{r.name}</span>
                  </div>
                  <span className="text-muted-foreground font-mono">
                    {type === 'attendance' ? `Lv.${5-idx}` : `${r.threshold}%+`}
                  </span>
                </div>
              ))}
              <div className="text-center py-1">
                <ChevronRight className="h-3 w-3 mx-auto text-muted-foreground rotate-90" />
              </div>
              <div className="text-center text-[10px] text-muted-foreground">브론즈 ~ 골드 등급 생략</div>
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

  const growthRate = dailyStat?.studyTimeGrowthRate ?? 0;
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
          value={`${growthSign}${Math.round(growthRate * 100)}%`}
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