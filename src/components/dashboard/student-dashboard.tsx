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
} from 'lucide-react';
import { mockAiCoachMessage, mockStudyPlan, mockUser } from '@/lib/data';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function StudentDashboard() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘의 학습 시간</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">180 분</div>
            <p className="text-xs text-muted-foreground">어제보다 +20%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">주간 완수율</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85%</div>
            <p className="text-xs text-muted-foreground">지난주보다 +5%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">연속 출석</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">22 일</div>
            <p className="text-xs text-muted-foreground">계속 화이팅!</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">성장 지수</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12%</div>
            <p className="text-xs text-muted-foreground">지난 7일 대비</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>오늘의 학습 계획</CardTitle>
              <CardDescription>
                완료한 과제를 체크하세요.
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
            {mockStudyPlan.map((task, index) => (
              <div key={task.id} className="flex items-center space-x-4 rounded-md border p-4">
                <Checkbox id={task.id} defaultChecked={task.done} />
                <Label
                  htmlFor={task.id}
                  className={`flex-1 text-sm font-medium leading-none ${
                    task.done ? 'line-through text-muted-foreground' : ''
                  }`}
                >
                  {task.title}
                </Label>
              </div>
            ))}
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
                  {mockAiCoachMessage.message}
                </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
