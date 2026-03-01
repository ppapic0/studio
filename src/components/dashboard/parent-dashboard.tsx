'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { FileText, CheckCircle, Loader2 } from 'lucide-react';
import { ResponsiveContainer, Bar, XAxis, YAxis, Tooltip, BarChart as RechartsBarChart } from 'recharts';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { doc } from 'firebase/firestore';
import { type DailyStudentStat } from '@/lib/types';
import { generateParentSummary, type ParentSummaryOutput, type ParentSummaryInput } from '@/ai/flows/parent-receives-weekly-summary';
import { Skeleton } from '../ui/skeleton';

const chartData = [
  { name: '1주차', completion: 75, attendance: 95 },
  { name: '2주차', completion: 80, attendance: 100 },
  { name: '3주차', completion: 78, attendance: 100 },
  { name: '4주차', completion: 82, attendance: 100 },
];

export function ParentDashboard({ isActive }: { isActive: boolean }) {
  const { activeMembership } = useAppContext();
  const firestore = useFirestore();

  const [summary, setSummary] = useState<ParentSummaryOutput | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const studentId = activeMembership?.linkedStudentIds?.[0];

  const studentStatRef = useMemoFirebase(() => {
    if (!firestore || !activeMembership || !studentId) return null;
    const todayKey = new Date().toISOString().split('T')[0];
    return doc(firestore, 'centers', activeMembership.id, 'dailyStudentStats', todayKey, 'students', studentId);
  }, [firestore, activeMembership, studentId]);

  const { data: studentStat, isLoading: studentStatLoading } = useDoc<DailyStudentStat>(studentStatRef, { enabled: isActive && !!studentId });

  useEffect(() => {
    // Only run if the dashboard is active and we have a studentId
    if (!isActive || !studentId) {
        setSummaryLoading(false);
        return;
    }
    
    // Can only run if we have the student's stats
    if (!studentStat || studentStatLoading) {
        return;
    }

    const fetchSummary = async () => {
        setSummaryLoading(true);
        try {
          const studentName = '자녀'; // In a real app, you'd fetch the student's name

          const input: ParentSummaryInput = {
            studentName: studentName,
            completionRate: studentStat.weeklyPlanCompletionRate * 100,
            completionRateTrend: 0, // Placeholder
            attendanceRate: 100, // Placeholder
            attendanceTrend: 0, // Placeholder
            studyTimeGrowth: studentStat.studyTimeGrowthRate,
            recentAchievements: [],
            potentialRisks: studentStat.riskDetected ? ['AI에 의해 위험이 감지되었습니다.'] : [],
          };
          const result = await generateParentSummary(input);
          setSummary(result);
        } catch (error) {
          console.error("Error generating parent summary:", error);
          setSummary(null);
        } finally {
          setSummaryLoading(false);
        }
    };
    
    fetchSummary();
  }, [isActive, studentId, studentStat, studentStatLoading]);

  if (!isActive) {
    return null;
  }
  
  if (!studentId) {
    return (
      <Card>
        <CardHeader><CardTitle>학생 연결 필요</CardTitle></CardHeader>
        <CardContent><p>학부모 계정에 연결된 학생이 없습니다. 센터 관리자에게 문의하여 학생을 연결해주세요.</p></CardContent>
      </Card>
    );
  }
  
  const isLoading = studentStatLoading || summaryLoading;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">자녀의 주간 요약</CardTitle>
          <CardDescription>
            이번 주 자녀의 학습 진행 상황에 대한 AI 요약입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? <Skeleton className="h-24 w-full" /> : summary ? (
            <Alert className="bg-secondary">
              <FileText className="h-4 w-4" />
              <AlertTitle className="font-semibold">AI 요약</AlertTitle>
              <AlertDescription>{summary.message}</AlertDescription>
            </Alert>
          ) : <p>주간 요약을 생성할 수 없습니다.</p>}
          
          <div className="grid gap-4 sm:grid-cols-3">
            {isLoading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-36 w-full" />) :
             summary?.keyMetrics.map((metric) => (
              <Card key={metric.name}>
                <CardHeader className="pb-2">
                  <CardDescription>{metric.name}</CardDescription>
                  <CardTitle className="text-3xl">{metric.value}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground">
                    {metric.trend}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {isLoading ? <Skeleton className="h-24 w-full" /> : summary && (
           <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertTitle className="font-semibold">추천 사항</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                  {summary.recommendations.map((rec, index) => (
                      <li key={index}>{rec}</li>
                  ))}
              </ul>
            </AlertDescription>
          </Alert>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>성과 추이</CardTitle>
          <CardDescription>
            지난 4주간의 계획 완수율 및 출석률입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <div className="h-[300px] w-full flex items-center justify-center">
             {isLoading || !isMounted ? (
               <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20"/>
             ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={chartData}>
                  <XAxis
                    dataKey="name"
                    stroke="hsl(var(--foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="hsl(var(--foreground))"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{ 
                      background: 'hsl(var(--background))',
                      borderColor: 'hsl(var(--border))'
                    }}
                  />
                  <Bar dataKey="completion" name="완수율" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="attendance" name="출석률" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
             )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
