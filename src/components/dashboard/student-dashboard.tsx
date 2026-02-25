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
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { useDoc, useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { DailyStudentStat, StudyPlanItem, AIOutput, WithId } from '@/lib/types';
import { doc, collection, query, where, limit, orderBy, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { Skeleton } from '../ui/skeleton';

function StatCard({ title, icon: Icon, value, evolution, isLoading }: { title: string, icon: React.ElementType, value: string, evolution: string, isLoading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-24 mt-1" />
            <Skeleton className="h-4 w-32 mt-2" />
          </>
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

export function StudentDashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership } = useAppContext();
  
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const weekKey = `${format(new Date(), 'yyyy')}-W${format(new Date(), 'ww')}`;

  const dailyStatRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return doc(firestore, 'centers', activeMembership.id, 'dailyStudentStats', todayKey, 'students', user.uid);
  }, [firestore, activeMembership, user, todayKey]);
  const { data: dailyStat, isLoading: dailyStatLoading } = useDoc<DailyStudentStat>(dailyStatRef);

  const planItemsRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
      collection(firestore, 'centers', activeMembership.id, 'students', user.uid, 'studyPlanWeeks', weekKey, 'items'),
      where('done', '==', false),
      limit(5)
    );
  }, [firestore, activeMembership, user, weekKey]);
  const { data: planItems, isLoading: planItemsLoading } = useCollection<StudyPlanItem>(planItemsRef);

  const aiCoachRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !user) return null;
    return query(
        collection(firestore, 'centers', activeMembership.id, 'aiOutputs', user.uid, 'records'),
        where('type', '==', 'intervention'),
        orderBy('createdAt', 'desc'),
        limit(1)
    );
  }, [firestore, activeMembership, user]);
  const { data: aiCoachData, isLoading: aiCoachLoading } = useCollection<AIOutput>(aiCoachRef);
  
  const handleToggleTask = async (item: WithId<StudyPlanItem>) => {
    if (!firestore || !user || !activeMembership) return;
    const itemRef = doc(
      firestore,
      'centers',
      activeMembership.id,
      'students',
      user.uid,
      'studyPlanWeeks',
      weekKey,
      'items',
      item.id
    );
    await updateDoc(itemRef, {
      done: !item.done,
    });
  };

  const aiCoachMessage = aiCoachData?.[0];

  const growthRate = dailyStat?.studyTimeGrowthRate ?? 0;
  const growthSign = growthRate >= 0 ? '+' : '';
  const growthEvolution = `지난 7일 대비`;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <StatCard 
          title="오늘의 학습 시간"
          icon={Clock}
          value={`${dailyStat?.totalStudyMinutes ?? 0} 분`}
          evolution={`어제보다 ${growthSign}${Math.round(growthRate * 100)}%`}
          isLoading={dailyStatLoading}
        />
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
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>오늘의 학습 계획</CardTitle>
              <CardDescription>
                완료할 남은 과제입니다.
              </CardDescription>
            </div>
            <Button asChild size="sm" className="ml-auto gap-1 bg-accent hover:bg-accent/90">
              <Link href="/dashboard/plan">
                전체 보기
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            {planItemsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : planItems && planItems.length > 0 ? (
                planItems.map((task) => (
                  <div key={task.id} className="flex items-center space-x-4 rounded-md border p-4">
                    <Checkbox id={task.id} checked={task.done} onCheckedChange={() => handleToggleTask(task)} />
                    <Label
                      htmlFor={task.id}
                      className={`flex-1 text-sm font-medium leading-none ${
                        task.done ? 'line-through text-muted-foreground' : ''
                      }`}
                    >
                      {task.title}
                    </Label>
                  </div>
                ))
            ) : (
                <div className="text-center text-muted-foreground p-8">오늘 남은 계획이 없습니다!</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>AI 코치</CardTitle>
            <CardDescription>
              성장을 돕는 맞춤 팁입니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Alert className="bg-background">
                <Activity className="h-4 w-4" />
                <AlertTitle className="font-headline">주간 팁</AlertTitle>
                <AlertDescription>
                  {aiCoachLoading ? (
                     <Skeleton className="h-16 w-full" />
                  ) : aiCoachMessage ? (
                     aiCoachMessage.message
                  ) : (
                    "새로운 AI 코칭 메시지가 없습니다."
                  )}
                </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
