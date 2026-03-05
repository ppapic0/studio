
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useCollection, useFirestore, useDoc, useUser } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, doc, getDoc, limit, orderBy, setDoc, serverTimestamp, addDoc, Timestamp } from 'firebase/firestore';
import { KpiDaily, FinanceSettings, MonthlyFinance, Invoice } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
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
  Wallet,
  Building2,
  Activity,
  ShieldAlert,
  CreditCard,
  Receipt,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  PlusCircle
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
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subDays, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { RevenueAnalysis } from '@/components/dashboard/revenue-analysis';
import { RiskIntelligence } from '@/components/dashboard/risk-intelligence';
import { OperationalIntelligence } from '@/components/dashboard/operational-intelligence';
import { useToast } from '@/hooks/use-toast';
import { syncMonthKpis, completePayment } from '@/lib/finance-actions';
import { useRouter } from 'next/navigation';

export default function RevenuePage() {
  const { user } = useUser();
  const { activeMembership, viewMode, membershipsLoading } = useAppContext();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;

  const [activeTab, setActiveTab] = useState('payments'); // 수납 관리를 기본 탭으로 설정하여 바로 확인 가능하게 함
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentChartMonth, setCurrentChartMonth] = useState(format(new Date(), 'yyyy-MM'));

  // 1. KPI 데이터 조회
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

  // 2. 미납 인보이스 조회 (issued 상태인 것만)
  const unpaidInvoicesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'invoices'),
      where('status', '==', 'issued'),
      limit(20)
    );
  }, [firestore, centerId]);
  const { data: unpaidInvoices, isLoading: isInvoicesLoading } = useCollection<Invoice>(unpaidInvoicesQuery);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayKpi = useMemo(() => kpiHistory?.find(k => k.date === todayStr) || kpiHistory?.[kpiHistory.length - 1], [kpiHistory, todayStr]);
  
  const metrics = useMemo(() => {
    if (!kpiHistory) return null;
    const collected = kpiHistory.reduce((acc, k) => acc + (k.collectedRevenue || 0), 0);
    const accrued = kpiHistory.reduce((acc, k) => acc + (k.totalRevenue || 0), 0);
    return { collected, accrued, uncollected: Math.max(0, accrued - collected) };
  }, [kpiHistory]);

  const handleProcessPayment = async (invoiceId: string, method: any) => {
    if (!firestore || !centerId) return;
    try {
      await completePayment(firestore, centerId, invoiceId, method);
      toast({ title: "수납 처리가 완료되었습니다." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "수납 실패", description: e.message });
    }
  };

  const handleRealPayment = (invoiceId: string) => {
    router.push(`/payment/checkout/${invoiceId}`);
  };

  // 테스트 인보이스 생성 (버튼이 안보일 경우 데이터 생성을 위해 추가)
  const createTestInvoice = async () => {
    if (!firestore || !centerId || !user) return;
    setIsSaving(true);
    try {
      const now = new Date();
      const invoiceData = {
        studentId: user.uid,
        studentName: user.displayName || '테스트 학생',
        cycleStartDate: Timestamp.fromDate(now),
        cycleEndDate: Timestamp.fromDate(addDays(now, 28)),
        finalPrice: 50000, // 테스트용 5만원
        status: 'issued',
        issuedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        priceSnapshot: {
          productId: 'test_product',
          season: 'semester',
          studentType: 'student',
          basePrice: 50000
        },
        discountsSnapshot: []
      };
      await addDoc(collection(firestore, 'centers', centerId, 'invoices'), invoiceData);
      toast({ title: "테스트 인보이스가 생성되었습니다.", description: "이제 목록에서 결제 버튼을 확인하실 수 있습니다." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "생성 실패", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (membershipsLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /></div>;

  return (
    <div className={cn("flex flex-col gap-8 w-full max-w-[1400px] mx-auto pb-20", isMobile ? "px-1" : "px-4 py-6")}>
      <header className={cn("flex justify-between items-end", isMobile ? "px-2 flex-col gap-4 items-start" : "")}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary/60">
            <Calculator className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Payment & Revenue Intel</span>
          </div>
          <h1 className={cn("font-black tracking-tighter text-primary leading-none", isMobile ? "text-3xl" : "text-5xl")}>
            비즈니스 분석 센터
          </h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsSettingsOpen(true)} variant="outline" className="rounded-2xl font-black gap-2 h-12 border-2 bg-white shadow-sm hover:bg-primary hover:text-white transition-all">
            <Settings className="h-4 w-4" /> 재무 정책 설정
          </Button>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 bg-muted/30 p-1.5 rounded-[1.5rem] border border-border/50 shadow-inner h-16 max-w-3xl mb-8">
          <TabsTrigger value="payments" className="rounded-xl font-black gap-2 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            <CreditCard className="h-4 w-4" /> 수납 및 미납 관리
          </TabsTrigger>
          <TabsTrigger value="revenue" className="rounded-xl font-black gap-2 data-[state=active]:bg-primary data-[state=active]:text-white">
            <TrendingUp className="h-4 w-4" /> 수익 분석
          </TabsTrigger>
          <TabsTrigger value="risk" className="rounded-xl font-black gap-2 data-[state=active]:bg-rose-600 data-[state=active]:text-white">
            <ShieldAlert className="h-4 w-4" /> 리스크 감지
          </TabsTrigger>
          <TabsTrigger value="ops" className="rounded-xl font-black gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
            <Activity className="h-4 w-4" /> 운영 효율
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="space-y-8 animate-in fade-in duration-500">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2 rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
              <CardHeader className="bg-muted/5 border-b p-8">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-black tracking-tighter">최근 발급 인보이스 (수납 대기)</CardTitle>
                    <CardDescription className="font-bold text-xs">결제 대기 중인 학생들의 명단입니다. '실제 카드 결제 진행' 버튼을 통해 테스트를 진행하세요.</CardDescription>
                  </div>
                  <Button variant="outline" className="rounded-xl h-10 px-4 font-black text-[10px] border-2">전체 발송</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-muted/10">
                  {isInvoicesLoading ? (
                    <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
                  ) : (!unpaidInvoices || unpaidInvoices.length === 0) ? (
                    <div className="py-24 text-center flex flex-col items-center gap-6">
                      <div className="p-8 rounded-full bg-muted/20">
                        <Receipt className="h-16 w-16 text-muted-foreground opacity-10" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-lg font-black text-muted-foreground/40 uppercase tracking-widest">수납 대기 중인 항목이 없습니다.</p>
                        <p className="text-xs font-bold text-muted-foreground/30">결제 테스트를 위해 아래 버튼을 눌러 테스트용 인보이스를 생성해보세요.</p>
                      </div>
                      <Button onClick={createTestInvoice} disabled={isSaving} className="rounded-2xl h-14 px-8 font-black gap-2 shadow-xl active:scale-95 transition-all">
                        {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <PlusCircle className="h-5 w-5" />}
                        테스트 결제용 인보이스 생성
                      </Button>
                    </div>
                  ) : unpaidInvoices.map((inv) => (
                    <div key={inv.id} className="p-8 flex flex-col gap-6 hover:bg-muted/5 transition-all group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <div className="h-14 w-14 rounded-2xl bg-primary/5 flex items-center justify-center font-black text-xl text-primary border-2 border-primary/10 group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-inner">{inv.studentName?.charAt(0)}</div>
                          <div className="grid gap-1">
                            <span className="font-black text-xl tracking-tight">{inv.studentName} 학생</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] font-black uppercase text-amber-600 border-amber-200 bg-amber-50">Pending</Badge>
                              <span className="text-[10px] font-bold text-muted-foreground">납기일: {inv.cycleEndDate ? format(inv.cycleEndDate.toDate(), 'yyyy.MM.dd') : 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black tracking-tighter text-primary">₩{inv.finalPrice.toLocaleString()}</p>
                          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Total Amount</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Button 
                          onClick={() => handleRealPayment(inv.id)}
                          className="flex-1 h-14 rounded-2xl font-black text-base gap-3 bg-blue-600 hover:bg-blue-700 shadow-2xl shadow-blue-200 active:scale-[0.98] transition-all"
                        >
                          <CreditCard className="h-6 w-6" /> 실제 카드 결제 진행 (토스 연동)
                        </Button>
                        <Select onValueChange={(val) => handleProcessPayment(inv.id, val)}>
                          <SelectTrigger className="w-[180px] h-14 rounded-2xl font-black text-xs border-2 bg-white text-emerald-600 border-emerald-100 shadow-lg shadow-emerald-50">
                            <div className="flex items-center gap-2"><RefreshCw className="h-4 w-4" /><SelectValue placeholder="수동 수납 처리" /></div>
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                            <SelectItem value="card" className="font-bold py-3 rounded-xl">💳 카드 결제 완료</SelectItem>
                            <SelectItem value="transfer" className="font-bold py-3 rounded-xl">🏦 계좌 이체 완료</SelectItem>
                            <SelectItem value="cash" className="font-bold py-3 rounded-xl">💵 현금 수납 완료</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-amber-500 text-white p-8 overflow-hidden relative">
                <Sparkles className="absolute -right-4 -top-4 h-32 w-32 opacity-20 rotate-12" />
                <div className="flex items-center gap-2 mb-6 relative z-10">
                  <AlertCircle className="h-5 w-5 opacity-60" />
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Smart Collection Advice</span>
                </div>
                <p className="text-sm font-bold leading-relaxed relative z-10">
                  현재 **{unpaidInvoices?.length || 0}명**의 학생이 결제 대기 중입니다.<br/><br/>
                  수납 기한이 3일 이상 경과한 학생들에게 **알림톡 재발송**을 권장합니다.
                </p>
                <Button className="w-full mt-6 h-12 rounded-xl bg-white text-amber-600 hover:bg-white/90 font-black text-xs shadow-xl shadow-amber-600/20 relative z-10">미납 알림 일괄 발송</Button>
              </Card>

              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 overflow-hidden relative group">
                <div className="absolute -right-4 -top-4 opacity-5 rotate-12 group-hover:scale-110 transition-transform"><Receipt className="h-32 w-32" /></div>
                <CardTitle className="text-base font-black mb-6 uppercase tracking-widest text-primary/40">수납 수단 비중</CardTitle>
                <div className="space-y-4 relative z-10">
                  <div className="flex justify-between items-end"><span className="text-xs font-bold text-muted-foreground">카드 (토스 포함)</span><span className="text-lg font-black">72%</span></div>
                  <Progress value={72} className="h-1.5" />
                  <div className="flex justify-between items-end"><span className="text-xs font-bold text-muted-foreground">계좌 이체 / 현금</span><span className="text-lg font-black">28%</span></div>
                  <Progress value={28} className="h-1.5 bg-muted" />
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-8 animate-in fade-in duration-500">
          <section className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-4")}>
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-primary text-primary-foreground p-8 overflow-hidden relative">
              <DollarSign className="absolute -right-4 -top-4 h-32 w-32 opacity-10 rotate-12" />
              <div className="relative z-10 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">이번 달 예상 매출 (발생)</p>
                <h3 className="text-4xl font-black tracking-tighter">₩{(metrics?.accrued || 0).toLocaleString()}</h3>
                <Badge className="bg-white/20 border-none text-[10px] px-3 text-emerald-400">Accrued Basis</Badge>
              </div>
            </Card>
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-emerald-600 text-white p-8 overflow-hidden relative">
              <Wallet className="absolute -right-4 -top-4 h-32 w-32 opacity-10 rotate-12" />
              <div className="relative z-10 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">실제 수납 완료액 (현금흐름)</p>
                <h3 className="text-4xl font-black tracking-tighter">₩{(metrics?.collected || 0).toLocaleString()}</h3>
                <Badge className="bg-white/20 border-none text-[10px] px-3 text-white">Cash Basis</Badge>
              </div>
            </Card>
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2"><Receipt className="h-3 w-3 text-rose-500" /> 미수금 (Receivables)</p>
              <h3 className="text-4xl font-black tracking-tighter text-rose-600">₩{(metrics?.uncollected || 0).toLocaleString()}</h3>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Outstanding Balance</p>
            </Card>
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2"><Users className="h-3 w-3 text-blue-500" /> 유료 재원생</p>
              <h3 className="text-4xl font-black tracking-tighter text-primary">{todayKpi?.activeStudentCount || 0}<span className="text-lg opacity-40 ml-1">명</span></h3>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Paid Enrollments</p>
            </Card>
          </section>

          <RevenueAnalysis />
        </TabsContent>

        <TabsContent value="risk" className="animate-in fade-in duration-500">
          <RiskIntelligence />
        </TabsContent>

        <TabsContent value="ops" className="animate-in fade-in duration-500">
          <OperationalIntelligence />
        </TabsContent>
      </Tabs>
    </div>
  );
}
