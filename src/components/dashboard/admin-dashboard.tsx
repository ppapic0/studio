'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { BarChart, Users, ClipboardCheck, TrendingUp, Armchair, AlertTriangle, CheckCircle, BarChart as RechartsBarChartIcon } from 'lucide-react';
import { ResponsiveContainer, BarChart as RechartsBarChart, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const monthlyStatsData = [
    { month: '1월', attendance: 92, completion: 85 },
    { month: '2월', attendance: 94, completion: 88 },
    { month: '3월', attendance: 91, completion: 82 },
    { month: '4월', attendance: 95, completion: 90 },
    { month: '5월', attendance: 96, completion: 91 },
    { month: '6월', attendance: 93, completion: 87 },
];

export function AdminDashboard() {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 출석률</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">94.5%</div>
            <p className="text-xs text-muted-foreground">지난달 대비 +1.2%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 계획 완수율</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">88.2%</div>
            <p className="text-xs text-muted-foreground">지난달 대비 +3.1%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">주의 학생 수</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">지난주 대비 -2</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">좌석 점유율</CardTitle>
            <Armchair className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92%</div>
            <p className="text-xs text-muted-foreground">125석 중 115석 사용 중</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>월별 센터 성과</CardTitle>
            <CardDescription>지난 6개월간의 주요 지표입니다.</CardDescription>
        </CardHeader>
        <CardContent>
            <ResponsiveContainer width="100%" height={350}>
                <RechartsBarChart data={monthlyStatsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                 <XAxis
                  dataKey="month"
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
                <Bar dataKey="attendance" name="출석률" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completion" name="완수율" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
            </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
            <CardHeader>
                <CardTitle>재등록 예상</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center">
                    <TrendingUp className="text-green-500 h-8 w-8 mr-4"/>
                    <div>
                        <div className="text-2xl font-bold">95%</div>
                        <div className="text-sm text-muted-foreground">다음 분기 예상</div>
                    </div>
                </div>
                 <p className="text-xs text-muted-foreground mt-4">현재 재등록 의사 데이터를 기반으로 합니다.</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>구독 상태</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center">
                    <CheckCircle className="text-success-foreground h-8 w-8 mr-4" style={{color: 'hsl(var(--chart-3))'}} />
                    <div>
                        <div className="text-2xl font-bold">프로 티어</div>
                        <div className="text-sm text-muted-foreground">45일 후 만료</div>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">최대 학생: 150, 최대 교사: 10</p>
            </CardContent>
        </Card>
      </div>
    </>
  );
}
