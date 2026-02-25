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
            <CardTitle className="text-sm font-medium">Study Time Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">180 mins</div>
            <p className="text-xs text-muted-foreground">+20% from yesterday</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Weekly Completion</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85%</div>
            <p className="text-xs text-muted-foreground">+5% from last week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attendance Streak</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">22 days</div>
            <p className="text-xs text-muted-foreground">Keep it up!</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Growth Index</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12%</div>
            <p className="text-xs text-muted-foreground">vs. previous 7 days</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:gap-8 lg:grid-cols-2 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center">
            <div className="grid gap-2">
              <CardTitle>Today&apos;s Study Plan</CardTitle>
              <CardDescription>
                Check off tasks as you complete them.
              </CardDescription>
            </div>
            <Button asChild size="sm" className="ml-auto gap-1 bg-accent hover:bg-accent/90">
              <Link href="/dashboard/plan">
                View All
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
            <CardTitle>AI Coach</CardTitle>
            <CardDescription>
              Personalized tips to help you grow.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <Alert className="bg-background">
                <Activity className="h-4 w-4" />
                <AlertTitle className="font-headline">Weekly Tip</AlertTitle>
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
