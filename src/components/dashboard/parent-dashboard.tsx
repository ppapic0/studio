import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { mockParentSummary } from '@/lib/data';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { BarChart, FileText, TrendingUp, CheckCircle } from 'lucide-react';
import { ResponsiveContainer, Bar, XAxis, YAxis, Tooltip, BarChart as RechartsBarChart } from 'recharts';

const chartData = [
  { name: '1주차', completion: 75, attendance: 95 },
  { name: '2주차', completion: 80, attendance: 100 },
  { name: '3주차', completion: 78, attendance: 100 },
  { name: '4주차', completion: 82, attendance: 100 },
];

export function ParentDashboard() {
  return (
    <>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">벤 카터의 주간 요약</CardTitle>
            <CardDescription>
              이번 주 자녀의 학습 진행 상황에 대한 AI 요약입니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="bg-secondary">
              <FileText className="h-4 w-4" />
              <AlertTitle className="font-semibold">AI 요약</AlertTitle>
              <AlertDescription>{mockParentSummary.message}</AlertDescription>
            </Alert>
            <div className="grid gap-4 sm:grid-cols-3">
              {mockParentSummary.keyMetrics.map((metric) => (
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
             <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle className="font-semibold">추천 사항</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                    {mockParentSummary.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                    ))}
                </ul>
              </AlertDescription>
            </Alert>
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
            <ResponsiveContainer width="100%" height={300}>
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
          </CardContent>
        </Card>
      </div>
    </>
  );
}
