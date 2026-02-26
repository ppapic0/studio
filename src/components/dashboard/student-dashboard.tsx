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

// 동백 이마트 좌표 (용인시 기흥구 동백죽전대로 433)
const TARGET_LAT = 37.2762;
const TARGET_LON = 127.1522;
const DISTANCE_THRESHOLD_KM = 1.0;

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // 지구 반지름 (km)
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
  evolution, 
  isLoading, 
  gameTitle, 
  gameMessage,
  level = "브론즈"
}: { 
  title: string, 
  icon: React.ElementType, 
  value?: string, 
  evolution?: string, 
  isLoading: boolean,
  gameTitle: string,
  gameMessage: string,
  level?: string
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:border-primary transition-all hover:shadow-md group">
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
                <p className="text-xs text-muted-foreground">{evolution}</p>
              </>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto bg-primary/10 p-3 rounded-full mb-4">
            <Trophy className="h-12 w-12 text-primary animate-bounce" />
          </div>
          <DialogTitle className="text-center text-2xl font-headline">{gameTitle}</DialogTitle>
          <DialogDescription className="text-center text-lg mt-2">
            현재 등급: <span className="font-bold text-primary">{level}</span>
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted p-4 rounded-xl text-center space-y-2">
          <p className="font-medium">{gameMessage}</p>
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Sparkles key={s} className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            ))}
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
  
  // 위치 관련 상태
  const [locationStatus, setLocationStatus] = useState<'checking' | 'inside' | 'outside' | 'error'>('checking');
  const [distance, setDistance] = useState<number | null>(null);

  // --- Data Fetching ---
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
  
  // --- 위치 확인 로직 ---
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
  
  // --- Event Handlers ---
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
    toast({
      title: "공부 모드 시작!",
      description: "동백센터 학습 구역에 입장하셨습니다. 집중력을 발휘해 보세요!",
    });
    // 향후 여기에 타이머 시작이나 출석 체크 로직을 추가할 수 있습니다.
  };

  if (!isActive) {
    return null;
  }

  const growthRate = dailyStat?.studyTimeGrowthRate ?? 0;
  const growthSign = growthRate >= 0 ? '+' : '';

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* Hero Section: Study Start Button */}
      <section className="relative overflow-hidden rounded-3xl bg-primary p-8 text-primary-foreground shadow-2xl">
        <div className="relative z-10 flex flex-col items-center gap-6 text-center md:flex-row md:justify-between md:text-left">
          <div className="space-y-2">
            <h2 className="text-3xl font-headline font-bold sm:text-4xl">오늘의 성장을 시작할까요?</h2>
            <p className="flex items-center gap-2 text-primary-foreground/80">
              <MapPin className="h-4 w-4" />
              {locationStatus === 'checking' && "위치 정보를 확인하고 있습니다..."}
              {locationStatus === 'inside' && "동백센터 학습 구역 안에 있습니다."}
              {locationStatus === 'outside' && `학습 구역 밖입니다. (약 ${distance?.toFixed(1)}km 거리)`}
              {locationStatus === 'error' && "위치 권한이 필요합니다."}
            </p>
          </div>
          <Button 
            size="lg" 
            className={cn(
              "h-20 w-full rounded-2xl px-8 text-2xl font-bold transition-all md:w-auto shadow-lg",
              locationStatus === 'inside' 
                ? "bg-accent text-accent-foreground hover:scale-105 hover:bg-accent/90" 
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
            )}
            disabled={locationStatus !== 'inside'}
            onClick={handleStudyStart}
          >
            <Play className="mr-3 h-8 w-8 fill-current" />
            공부 시작하기
          </Button>
        </div>
        {/* Background Decorative Elements */}
        <div className="absolute -bottom-12 -right-12 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -top-12 -left-12 h-48 w-48 rounded-full bg-accent/20 blur-3xl" />
      </section>

      {/* Stats Grid with Gamification */}
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
          value={`${Math.round((dailyStat?.weeklyPlanCompletionRate ?? 0) * 100)}%`}
          evolution="지난주보다 +5%"
          isLoading={dailyStatLoading}
          gameTitle="완수 마스터"
          gameMessage="계획을 완벽하게 지키고 계시군요! 다이아몬드 등급이 머지않았습니다."
          level="골드"
        />
        
        <GamifiedStatCard 
          title="연속 출석"
          icon={Zap}
          value={`${dailyStat?.attendanceStreakDays ?? 0} 일`}
          evolution="꾸준함이 최고의 재능!"
          isLoading={dailyStatLoading}
          gameTitle="출석 킹"
          gameMessage="매일매일 출석하는 당신은 동백센터의 성실왕입니다!"
          level="실버"
        />

        <GamifiedStatCard 
          title="성장 지수"
          icon={TrendingUp}
          value={`${growthSign}${Math.round(growthRate * 100)}%`}
          evolution="지난 7일 대비"
          isLoading={dailyStatLoading}
          gameTitle="성장 챔피언"
          gameMessage="학습 시간이 폭발적으로 늘어나고 있어요. 레벨업 축하드려요!"
          level="플래티넘"
        />
      </div>

      {/* Main Content Grid */}
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