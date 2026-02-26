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
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { DailyStudentStat, StudyPlanItem, AIOutput, WithId, StudyLogDay } from '@/lib/types';
import { doc, collection, query, where, limit, orderBy, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { format, getISOWeek } from 'date-fns';
import { useEffect, useState } from 'react';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';

function StatCard({ title, icon: Icon, value, evolution, isLoading, children }: { title: string, icon: React.ElementType, value?: string, evolution?: string, isLoading: boolean, children?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-24 mt-1" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        ) : children ? (
          children
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{evolution}</p>
          </>
        )}
      </CardContent>
    </Card>
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

  const aiCoachRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
        collection(firestore, 'centers', activeMembership.id, 'aiOutputs', user.uid, 'records'),
        where('studentId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(1)
    );
  }, [firestore, activeMembership, user]);
  const { data: aiCoachData, isLoading: aiCoachLoading } = useCollection<AIOutput>(aiCoachRef, { enabled: isActive });
  
  // --- Effects ---
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

  if (!isActive) {
    return null;
  }

  const aiCoachMessage = aiCoachData?.[0];

  const growthRate = dailyStat?.studyTimeGrowthRate ?? 0;
  const growthSign = growthRate >= 0 ? '+' : '';
  const growthEvolution = `지난 7일 대비`;

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* Stats Grid - 1 col on mobile, 2 cols on tablet, 4 cols on desktop */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="오늘의 학습 시간"
          icon={Clock}
          isLoading={studyLogLoading}
        >
          <div className="flex items-center gap-2">
            <div className="flex items-baseline gap-1">
              <Input 
                type="number" 
                className="text-2xl font-bold h-10 w-16 p-0 border-0 shadow-none focus-visible:ring-0" 
                value={minutesInput}
                onChange={(e) => setMinutesInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetMinutes()}
              />
              <span className="text-sm text-muted-foreground">분</span>
            </div>
            <Button size="sm" variant="ghost" onClick={handleSetMinutes} disabled={isSavingMinutes} className="h-8 w-8 p-0 ml-auto">
              {isSavingMinutes ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}
              <span className="sr-only">저장</span>
            </Button>
          </div>
          {studyLog?.updatedAt && <p className="text-[10px] text-muted-foreground mt-1">마지막 저장: {format(studyLog.updatedAt.toDate(), 'p')}</p>}
        </StatCard>
        <StatCard 
          title="주간 완수율"
          icon={ClipboardCheck}
          value={`${Math.round((dailyStat?.weeklyPlanCompletionRate ?? 0) * 100)}%`}
          evolution="지난주보다 +5%"
          isLoading={dailyStatLoading}
        />
        <StatCard 
          title="연속 출석"
          icon={Activity}
          value={`${dailyStat?.attendanceStreakDays ?? 0} 일`}
          evolution="계속 화이팅!"
          isLoading={dailyStatLoading}
        />
        <StatCard 
          title="성장 지수"
          icon={TrendingUp}
          value={`${growthSign}${Math.round(growthRate * 100)}%`}
          evolution={growthEvolution}
          isLoading={dailyStatLoading}
        />
      </div>

      {/* Main Content Grid - Stacked on mobile/tablet, 2:1 on large desktop */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Plan */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center space-y-0">
            <div className="grid gap-1">
              <CardTitle className="text-xl">오늘의 학습 계획</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                완료할 남은 과제입니다.
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="outline" className="ml-auto gap-1 text-xs sm:text-sm h-8">
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
                  <div key={task.id} className="flex items-center space-x-3 rounded-md border p-3 sm:p-4 hover:bg-muted/50 transition-colors">
                    <Checkbox id={task.id} checked={task.done} onCheckedChange={() => handleToggleTask(task)} />
                    <Label
                      htmlFor={task.id}
                      className={`flex-1 text-sm font-medium leading-none cursor-pointer ${
                        task.done ? 'line-through text-muted-foreground' : ''
                      }`}
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

        {/* Right Column: AI Coach */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-xl">AI 코치</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              성장을 돕는 맞춤 팁입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Alert className="bg-secondary/50 border-none">
                <Activity className="h-4 w-4 text-accent" />
                <AlertTitle className="font-headline text-accent font-semibold">주간 팁</AlertTitle>
                <AlertDescription className="mt-2 text-sm leading-relaxed text-foreground/80">
                  {aiCoachLoading ? (
                     <Skeleton className="h-20 w-full" />
                  ) : aiCoachMessage ? (
                     aiCoachMessage.message
                  ) : (
                    "오늘의 학습 기록을 채워보세요! AI가 분석을 시작합니다."
                  )}
                </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}