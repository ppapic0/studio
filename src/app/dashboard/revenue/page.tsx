'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useCollection, useFirestore, useDoc } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, doc, getDoc, limit, orderBy, setDoc, serverTimestamp } from 'firebase/firestore';
import { KpiDaily, FinanceSettings, MonthlyFinance } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  PieChart,
  Settings,
  Loader2,
  RefreshCw,
  Percent,
  Wallet,
  Building2,
  UserCircle2,
  Wrench,
  ShieldAlert,
  Activity,
  History
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
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, startOfMonth, subMonths, eachMonthOfInterval, endOfMonth, eachDayOfInterval, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { RevenueAnalysis } from '@/components/dashboard/revenue-analysis';
import { RiskIntelligence } from '@/components/dashboard/risk-intelligence';
import { OperationalIntelligence } from '@/components/dashboard/operational-intelligence';
import { useToast } from '@/hooks/use-toast';
import { syncMonthKpis } from '@/lib/finance-actions';

export default function RevenuePage() {
  const { activeMembership, viewMode, membershipsLoading } = useAppContext();
  const firestore = useFirestore();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;

  const [activeTab, setActiveTab] = useState('revenue');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // 현재 차트 기준월 (3월로 고정)
  const [currentChartMonth, setCurrentChartMonth] = useState('2025-03');

  // 재무 데이터 자동 동기화
  useEffect(() => {
    if (!centerId || !firestore || isSyncing) return;
    
    const triggerSync = async () => {
      setIsSyncing(true);
      try {
        await syncMonthKpis(firestore, centerId, currentChartMonth);
      } catch (e) {
        console.error("KPI Sync Error:", e);
      } finally {
        setIsSyncing(false);
      }
    };

    triggerSync();
  }, [centerId, firestore, currentChartMonth]);

  const [selectedFinanceMonth, setSelectedFinanceMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [rent, setRent] = useState<number>(0);
  const [labor, setLabor] = useState<number>(0);
  const [maintenance, setMaintenance] = useState<number>(0);
  const [otherCost, setOtherCost] = useState<number>(0);
  const [discountOrder, setDiscountOrder] = useState<'rateFirst' | 'fixedFirst'>('rateFirst');

  const financeMonthRef = useMemoFirebase(() => {
    if (!firestore || !centerId || !selectedFinanceMonth) return null;
    return doc(firestore, 'centers', centerId, 'financeMonthly', selectedFinanceMonth);
  }, [firestore, centerId, selectedFinanceMonth]);
  const { data: monthlyFinanceData } = useDoc<MonthlyFinance>(financeMonthRef);

  useEffect(() => {
    if (monthlyFinanceData) {
      setRent(monthlyFinanceData.rent || 0);
      setLabor(monthlyFinanceData.labor || 0);
      setMaintenance(monthlyFinanceData.maintenance || 0);
      setOtherCost(monthlyFinanceData.other || 0);
    }
  }, [monthlyFinanceData]);

  const kpiQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'kpiDaily'),
      where('date', '>=', `${currentChartMonth}-01`),
      where('date', '<=', `${currentChartMonth}-31`),
      orderBy('date', 'asc')
    );
  }, [firestore, centerId, currentChartMonth]);

  const { data: kpiHistory, isLoading: isKpiLoading } = useCollection<KpiDaily>(kpiQuery);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayKpi = useMemo(() => kpiHistory?.find(k => k.date === todayStr) || kpiHistory?.[kpiHistory.length - 1], [kpiHistory, todayStr]);
  
  const calculatedBep = useMemo(() => {
    if (!todayKpi || todayKpi.activeStudentCount === 0 || !monthlyFinanceData?.totalFixedCosts) return null;
    const avgDailyFee = todayKpi.totalRevenue / todayKpi.activeStudentCount;
    if (avgDailyFee <= 0) return null;
    return Math.ceil(monthlyFinanceData.totalFixedCosts / (avgDailyFee * 28));
  }, [todayKpi, monthlyFinanceData]);

  const yesterdayKpi = useMemo(() => {
    const yStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    return kpiHistory?.find(k => k.date === yStr);
  }, [kpiHistory]);

  const growth = useMemo(() => {
    if (!todayKpi || !yesterdayKpi || yesterdayKpi.totalRevenue === 0) return 0;
    return ((todayKpi.totalRevenue - yesterdayKpi.totalRevenue) / yesterdayKpi.totalRevenue) * 100;
  }, [todayKpi, yesterdayKpi]);

  const chartData = useMemo(() => {
    const [year, month] = currentChartMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = endOfMonth(startDate);
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    return days.map(day => {
      const dStr = format(day, 'yyyy-MM-dd');
      const kpi = kpiHistory?.find(k => k.date === dStr);
      return {
        name: format(day, 'dd'),
        revenue: kpi ? Math.round(kpi.totalRevenue || 0) : 0,
        fullDate: format(day, 'MM/dd')
      };
    });
  }, [kpiHistory, currentChartMonth]);

  const handleSaveSettings = async () => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      const totalFixedCosts = rent + labor + maintenance + otherCost;
      await setDoc(doc(firestore, 'centers', centerId, 'financeMonthly', selectedFinanceMonth), {
        yearMonth: selectedFinanceMonth,
        rent, labor, maintenance, other: otherCost,
        totalFixedCosts,
        updatedAt: serverTimestamp()
      }, { merge: true });

      await setDoc(doc(firestore, 'centers', centerId), {
        financeSettings: { discountPolicy: { order: [discountOrder] } },
        updatedAt: serverTimestamp()
      }, { merge: true });

      await syncMonthKpis(firestore, centerId, currentChartMonth);
      toast({ title: "재무 설정이 저장되었습니다." });
      setIsSettingsOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setIsSaving(false);
    }
  };

  if (membershipsLoading || isKpiLoading) {
    return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /></div>;
  }

  return (
    <div className={cn("flex flex-col gap-8 w-full max-w-[1400px] mx-auto pb-20", isMobile ? "px-1" : "px-4 py-6")}>
      <header className={cn("flex justify-between items-end", isMobile ? "px-2 flex-col gap-4 items-start" : "")}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary/60">
            <Calculator className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Operational Intelligence</span>
          </div>
          <h1 className={cn("font-black tracking-tighter text-primary leading-none", isMobile ? "text-3xl" : "text-5xl")}>
            비즈니스 분석 센터
          </h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsSettingsOpen(true)} variant="outline" className="rounded-2xl font-black gap-2 h-12 border-2 shadow-sm bg-white hover:bg-primary hover:text-white transition-all">
            <Settings className="h-4 w-4" /> 고정비 및 정책 설정
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 bg-muted/30 p-1.5 rounded-[1.5rem] border border-border/50 shadow-inner h-16 max-w-2xl mb-8">
          <TabsTrigger value="revenue" className="rounded-xl font-black gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <DollarSign className="h-4 w-4" /> 수납 및 수익 분석
          </TabsTrigger>
          <TabsTrigger value="risk" className="rounded-xl font-black gap-2 data-[state=active]:bg-rose-600 data-[state=active]:text-white">
            <ShieldAlert className="h-4 w-4" /> 리스크 감지 (AI)
          </TabsTrigger>
          <TabsTrigger value="ops" className="rounded-xl font-black gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Activity className="h-4 w-4" /> 운영 및 상담 효율
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-8 animate-in fade-in duration-500">
          <section className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-4")}>
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-primary text-primary-foreground p-8 overflow-hidden relative">
              <DollarSign className="absolute -right-4 -top-4 h-32 w-32 opacity-10 rotate-12" />
              <div className="relative z-10 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">오늘 발생 매출</p>
                <h3 className="text-4xl font-black tracking-tighter">₩{(todayKpi?.totalRevenue || 0).toLocaleString()}</h3>
                <Badge className={cn("bg-white/20 border-none text-[10px] px-3", growth >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {growth >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                  {Math.abs(growth).toFixed(1)}% 전일비
                </Badge>
              </div>
            </Card>
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2"><Target className="h-3 w-3 text-amber-500" /> 손익분기점 (BEP)</p>
              <h3 className="text-4xl font-black tracking-tighter text-primary">{calculatedBep || '-'}<span className="text-lg opacity-40 ml-1">명</span></h3>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">고정비 ₩{monthlyFinanceData?.totalFixedCosts.toLocaleString()} 기준</p>
            </Card>
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2"><Users className="h-3 w-3 text-blue-500" /> 유료 재원생</p>
              <h3 className="text-4xl font-black tracking-tighter text-primary">{todayKpi?.activeStudentCount || 0}<span className="text-lg opacity-40 ml-1">명</span></h3>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Today Active Members</p>
            </Card>
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2"><PieChart className="h-3 w-3 text-emerald-500" /> 인당 일일 매출</p>
              <h3 className="text-4xl font-black tracking-tighter text-primary">₩{todayKpi && todayKpi.activeStudentCount > 0 ? Math.round(todayKpi.totalRevenue / todayKpi.activeStudentCount).toLocaleString() : '0'}</h3>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">ARPU (Per Day Accrued)</p>
            </Card>
          </section>

          <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="p-8 border-b bg-muted/5">
              <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-primary" /> {currentChartMonth.replace('-', '년 ')}월 매출 추이 (발생주의)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-10">
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="colorRev" x1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" fontSize={11} fontWeight="bold" axisLine={false} tickLine={false} />
                    <YAxis fontSize={11} fontWeight="900" axisLine={false} tickLine={false} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return <div className="bg-white p-4 rounded-2xl shadow-2xl border-none ring-1 ring-black/5">
                          <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">{label}일 매출</p>
                          <p className="text-lg font-black text-primary">₩{Number(payload[0].value).toLocaleString()}</p>
                        </div>
                      }
                      return null;
                    }} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <RevenueAnalysis />
        </TabsContent>

        <TabsContent value="risk" className="animate-in fade-in duration-500">
          <RiskIntelligence />
        </TabsContent>

        <TabsContent value="ops" className="animate-in fade-in duration-500">
          <OperationalIntelligence />
        </TabsContent>
      </Tabs>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl sm:max-w-xl">
          <div className="bg-primary p-10 text-white"><DialogTitle className="text-3xl font-black tracking-tighter">재무 정책 및 비용 설정</DialogTitle></div>
          <div className="p-8 space-y-8 bg-white max-h-[60vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">월별 운영 고정비</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-xs font-bold">임대료</Label><Input type="number" value={rent} onChange={e => setRent(Number(e.target.value))} className="h-12 rounded-xl" /></div>
                <div className="space-y-1.5"><Label className="text-xs font-bold">인건비</Label><Input type="number" value={labor} onChange={e => setLabor(Number(e.target.value))} className="h-12 rounded-xl" /></div>
                <div className="space-y-1.5"><Label className="text-xs font-bold">관리비</Label><Input type="number" value={maintenance} onChange={e => setMaintenance(Number(e.target.value))} className="h-12 rounded-xl" /></div>
                <div className="space-y-1.5"><Label className="text-xs font-bold">기타</Label><Input type="number" value={otherCost} onChange={e => setOtherCost(Number(e.target.value))} className="h-12 rounded-xl" /></div>
              </div>
            </div>
            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase text-muted-foreground">할인 적용 순서</Label>
              <Select value={discountOrder} onValueChange={(val: any) => setDiscountOrder(val)}>
                <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-xl"><SelectItem value="rateFirst" className="font-bold">정률(%) 우선 적용</SelectItem><SelectItem value="fixedFirst" className="font-bold">정액(원) 우선 적용</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="p-8 bg-muted/20 border-t"><Button onClick={handleSaveSettings} disabled={isSaving} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl">저장 및 동기화</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
