
'use client';

import { useState, useMemo } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useCollection, useFirestore } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, doc, getDoc, limit, orderBy } from 'firebase/firestore';
import { KpiDaily, FinanceSettings } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight,
  Target,
  Calculator,
  CalendarDays,
  Sparkles,
  ChevronRight,
  PieChart,
  Settings
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { RevenueAnalysis } from '@/components/dashboard/revenue-analysis';

export default function RevenuePage() {
  const { activeMembership, viewMode } = useAppContext();
  const firestore = useFirestore();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;

  const kpiQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'kpiDaily'),
      orderBy('date', 'desc'),
      limit(30)
    );
  }, [firestore, centerId]);

  const { data: kpiHistory, isLoading } = useCollection<KpiDaily>(kpiQuery);

  const todayKpi = useMemo(() => kpiHistory?.[0], [kpiHistory]);
  const yesterdayKpi = useMemo(() => kpiHistory?.[1], [kpiHistory]);

  const growth = useMemo(() => {
    if (!todayKpi || !yesterdayKpi || yesterdayKpi.totalRevenue === 0) return 0;
    return ((todayKpi.totalRevenue - yesterdayKpi.totalRevenue) / yesterdayKpi.totalRevenue) * 100;
  }, [todayKpi, yesterdayKpi]);

  const chartData = useMemo(() => {
    if (!kpiHistory) return [];
    return [...kpiHistory].reverse().map(k => ({
      name: k.date.substring(5),
      revenue: k.totalRevenue / 10000, // 만원 단위
      students: k.activeStudentCount
    }));
  }, [kpiHistory]);

  return (
    <div className={cn("flex flex-col gap-8 w-full max-w-[1400px] mx-auto", isMobile ? "px-1" : "px-4 py-6")}>
      <header className={cn("flex justify-between items-end", isMobile ? "px-2" : "")}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary/60">
            <Calculator className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Advanced Finance Matrix</span>
          </div>
          <h1 className={cn("font-black tracking-tighter text-primary leading-none", isMobile ? "text-3xl" : "text-5xl")}>
            재무 및 손익 분석
          </h1>
          <p className="text-sm font-bold text-muted-foreground/70 mt-2">28일 결제 사이클 기반의 정밀 수익 지표를 모니터링합니다.</p>
        </div>
        {!isMobile && (
          <Button variant="outline" className="rounded-2xl font-black gap-2 h-12 border-2 shadow-sm">
            <Settings className="h-4 w-4" /> 재무 정책 설정
          </Button>
        )}
      </header>

      {/* 실시간 KPI 섹션 */}
      <section className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-4")}>
        <Card className="rounded-[2rem] border-none shadow-xl bg-primary text-primary-foreground p-8 overflow-hidden relative">
          <DollarSign className="absolute -right-4 -top-4 h-32 w-32 opacity-10 rotate-12" />
          <div className="relative z-10 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">오늘 매출</p>
            <div className="flex items-baseline gap-1">
              <h3 className="text-4xl font-black tracking-tighter">₩{(todayKpi?.totalRevenue || 0).toLocaleString()}</h3>
            </div>
            <Badge className={cn("bg-white/20 border-none font-black text-[10px]", growth >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {growth >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
              {Math.abs(growth).toFixed(1)}% 전일 대비
            </Badge>
          </div>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-xl bg-white p-8">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">손익분기점 (BEP)</p>
          <div className="flex justify-between items-end">
            <div>
              <h3 className="text-4xl font-black tracking-tighter text-primary">{todayKpi?.breakevenStudents || '-'}<span className="text-lg opacity-40 ml-1">명</span></h3>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">목표 재원생 수</p>
            </div>
            <div className="bg-amber-50 p-3 rounded-2xl"><Target className="h-6 w-6 text-amber-600" /></div>
          </div>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-xl bg-white p-8">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">평균 객단가 (ARPU)</p>
          <div className="flex justify-between items-end">
            <div>
              <h3 className="text-4xl font-black tracking-tighter text-primary">₩{(todayKpi?.avgFinalPrice || 0).toLocaleString()}</h3>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">28일 실질 수강료</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-2xl"><PieChart className="h-6 w-6 text-blue-600" /></div>
          </div>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-xl bg-white p-8">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4">총 할인액</p>
          <div className="flex justify-between items-end">
            <div>
              <h3 className="text-4xl font-black tracking-tighter text-rose-600">₩{(todayKpi?.totalDiscount || 0).toLocaleString()}</h3>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">프로모션 기여액</p>
            </div>
            <div className="bg-rose-50 p-3 rounded-2xl"><TrendingUp className="h-6 w-6 text-rose-600" /></div>
          </div>
        </Card>
      </section>

      {/* 매출 추이 그래프 */}
      <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden">
        <CardHeader className="p-10 border-b bg-muted/5">
          <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-primary" /> 매출 및 성장 트렌드
          </CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Revenue History (Unit: 10,000 KRW)</CardDescription>
        </CardHeader>
        <CardContent className="p-10">
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 기존 학생별 수익 관리 리스트 유지/연동 */}
      <div className="mt-4">
        <RevenueAnalysis />
      </div>
    </div>
  );
}
