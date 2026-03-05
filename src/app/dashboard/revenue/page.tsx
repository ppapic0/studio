
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useCollection, useFirestore, useDoc, useUser } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, doc, getDoc, limit, orderBy, setDoc, serverTimestamp, addDoc, Timestamp } from 'firebase/firestore';
import { KpiDaily, FinanceSettings, MonthlyFinance, Invoice, AttendanceCurrent, CenterMembership } from '@/lib/types';
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
  PlusCircle,
  BellRing,
  CheckCircle2,
  FileText,
  Clock,
  Filter,
  Armchair,
  Info,
  CalendarCheck,
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
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subDays, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { RevenueAnalysis } from '@/components/dashboard/revenue-analysis';
import { RiskIntelligence } from '@/components/dashboard/risk-intelligence';
import { OperationalIntelligence } from '@/components/dashboard/operational-intelligence';
import { useToast } from '@/hooks/use-toast';
import { syncMonthKpis, completePayment, updateInvoiceStatus, issueInvoice } from '@/lib/finance-actions';
import { useRouter } from 'next/navigation';
import { autoCheckPaymentReminders } from '@/lib/kakao-service';

export default function RevenuePage() {
  const { user } = useUser();
  const { activeMembership, viewMode, membershipsLoading } = useAppContext();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;

  const [activeTab, setActiveTab] = useState('payments'); 
  const [paymentSubTab, setPaymentSubTab] = useState('all');
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

  // 2. 인보이스 조회 (실시간 연동)
  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'invoices'),
      orderBy('cycleEndDate', 'desc'),
      limit(50)
    );
  }, [firestore, centerId]);
  const { data: allInvoices, isLoading: isInvoicesLoading } = useCollection<Invoice>(invoicesQuery);

  // 3. 실시간 좌석 배정 현황 (재원생 연동용)
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList } = useCollection<AttendanceCurrent>(attendanceQuery);

  // 4. 학생 목록 조회 (이름 매칭용)
  const studentMembersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'),
      where('role', '==', 'student'),
      where('status', '==', 'active')
    );
  }, [firestore, centerId]);
  const { data: studentMembers } = useCollection<CenterMembership>(studentMembersQuery);

  const filteredInvoices = useMemo(() => {
    if (!allInvoices) return [];
    if (paymentSubTab === 'all') return allInvoices;
    if (paymentSubTab === 'unpaid') return allInvoices.filter(i => i.status === 'issued' || i.status === 'overdue');
    if (paymentSubTab === 'paid') return allInvoices.filter(i => i.status === 'paid');
    if (paymentSubTab === 'overdue') return allInvoices.filter(i => i.status === 'overdue');
    return allInvoices;
  }, [allInvoices, paymentSubTab]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayKpi = useMemo(() => kpiHistory?.find(k => k.date === todayStr) || kpiHistory?.[kpiHistory.length - 1], [kpiHistory, todayStr]);
  
  const metrics = useMemo(() => {
    if (!kpiHistory) return null;
    const collected = kpiHistory.reduce((acc, k) => acc + (k.collectedRevenue || 0), 0);
    const accrued = kpiHistory.reduce((acc, k) => acc + (k.totalRevenue || 0), 0);
    return { collected, accrued, uncollected: Math.max(0, accrued - collected) };
  }, [kpiHistory]);

  const handleStatusChange = async (invoiceId: string, status: Invoice['status'], method: any = 'none') => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      await updateInvoiceStatus(firestore, centerId, invoiceId, status, method);
      toast({ title: "수납 상태가 변경되었습니다." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "변경 실패", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRealPayment = (invoiceId: string) => {
    router.push(`/payment/checkout/${invoiceId}`);
  };

  const handleSendPaymentReminders = async () => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      const count = await autoCheckPaymentReminders(firestore, centerId);
      toast({ title: "알림 발송 완료", description: `결제일 3일 전인 ${count}명의 학생에게 문자를 보냈습니다.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "발송 실패", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const createAutoInvoice = async (studentId: string, name: string) => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      await issueInvoice(firestore, centerId, studentId, 390000, "28일 정기 수강료");
      toast({ title: "28일 주기 인보이스가 생성되었습니다." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "생성 실패", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid': return <Badge className="bg-emerald-500 text-white border-none font-black text-[10px] px-2 py-0.5">수납 완료</Badge>;
      case 'issued': return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 font-black text-[10px] px-2 py-0.5">수납 대기</Badge>;
      case 'overdue': return <Badge variant="destructive" className="font-black text-[10px] px-2 py-0.5 shadow-sm">연체/미납</Badge>;
      default: return <Badge variant="secondary" className="font-black text-[10px] px-2 py-0.5">{status}</Badge>;
    }
  };

  if (membershipsLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /></div>;

  return (
    <div className={cn("flex flex-col gap-8 w-full max-w-[1400px] mx-auto pb-20", isMobile ? "px-1" : "px-4 py-6")}>
      <header className={cn("flex justify-between items-end", isMobile ? "px-2 flex-col gap-4 items-start" : "")}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary/60">
            <Calculator className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Advanced Finance Center</span>
          </div>
          <h1 className={cn("font-black tracking-tighter text-primary leading-none", isMobile ? "text-3xl" : "text-5xl")}>
            비즈니스 분석 및 수납
          </h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSendPaymentReminders} disabled={isSaving} variant="outline" className="rounded-2xl font-black gap-2 h-12 border-2 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all">
            <BellRing className="h-4 w-4" /> 결제 예고 알림
          </Button>
          <Button onClick={() => setIsSettingsOpen(true)} variant="outline" className="rounded-2xl font-black gap-2 h-12 border-2 bg-white shadow-sm hover:bg-primary hover:text-white transition-all">
            <Settings className="h-4 w-4" /> 재무 정책
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
          <div className="grid gap-6 md:grid-cols-12">
            <div className="md:col-span-8 space-y-6">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
                <CardHeader className="bg-muted/5 border-b p-8">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                      <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-2">
                        <History className="h-6 w-6 opacity-40" /> 인보이스 타임라인
                      </CardTitle>
                      <CardDescription className="font-bold text-xs uppercase tracking-widest text-muted-foreground/60">28-Day Billing Cycles Sync</CardDescription>
                    </div>
                    <Tabs value={paymentSubTab} onValueChange={setPaymentSubTab} className="w-full sm:w-auto">
                      <TabsList className="bg-muted/50 p-1 rounded-xl h-10 border shadow-inner">
                        <TabsTrigger value="all" className="rounded-lg text-[10px] font-black px-3">전체</TabsTrigger>
                        <TabsTrigger value="unpaid" className="rounded-lg text-[10px] font-black px-3 text-amber-600">대기</TabsTrigger>
                        <TabsTrigger value="paid" className="rounded-lg text-[10px] font-black px-3 text-emerald-600">완료</TabsTrigger>
                        <TabsTrigger value="overdue" className="rounded-lg text-[10px] font-black px-3 text-rose-600">미납</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-muted/10">
                    {isInvoicesLoading ? (
                      <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
                    ) : filteredInvoices.length === 0 ? (
                      <div className="py-24 text-center flex flex-col items-center gap-6">
                        <div className="p-8 rounded-full bg-muted/20">
                          <Receipt className="h-16 w-16 text-muted-foreground opacity-10" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-lg font-black text-muted-foreground/40 uppercase tracking-widest">조회된 인보이스가 없습니다.</p>
                          <p className="text-xs font-bold text-muted-foreground/30">좌석 배정 현황을 확인하여 인보이스를 발행하세요.</p>
                        </div>
                      </div>
                    ) : filteredInvoices.map((inv) => {
                      const studentSeat = attendanceList?.find(a => a.studentId === inv.studentId);
                      return (
                        <div key={inv.id} className={cn(
                          "p-8 flex flex-col gap-6 hover:bg-muted/5 transition-all group",
                          inv.status === 'paid' ? "bg-emerald-50/5" : ""
                        )}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-5">
                              <div className={cn(
                                "h-14 w-14 rounded-2xl flex items-center justify-center font-black text-xl border-2 transition-all duration-500 shadow-inner shrink-0",
                                inv.status === 'paid' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-primary/5 text-primary border-primary/10 group-hover:bg-primary group-hover:text-white"
                              )}>
                                {inv.studentName?.charAt(0)}
                              </div>
                              <div className="grid gap-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-black text-xl tracking-tight truncate">{inv.studentName} 학생</span>
                                  {studentSeat && <Badge variant="outline" className="font-black text-[8px] border-primary/20 text-primary/60 uppercase">{studentSeat.seatZone || 'Flex'}</Badge>}
                                  {getStatusBadge(inv.status)}
                                </div>
                                <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground">
                                  <span className="flex items-center gap-1 bg-muted/30 px-2 py-0.5 rounded-md"><CalendarCheck className="h-3 w-3" /> 기간: {inv.cycleStartDate ? format(inv.cycleStartDate.toDate(), 'MM.dd') : 'N/A'} ~ {inv.cycleEndDate ? format(inv.cycleEndDate.toDate(), 'MM.dd') : 'N/A'} (28일)</span>
                                  {inv.paidAt && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /> 완료: {format(inv.paidAt.toDate(), 'MM.dd HH:mm')}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={cn(
                                "text-2xl font-black tracking-tighter",
                                inv.status === 'paid' ? "text-emerald-600" : "text-primary"
                              )}>₩{inv.finalPrice.toLocaleString()}</p>
                              <Select 
                                value={inv.status} 
                                onValueChange={(val: any) => handleStatusChange(inv.id, val)}
                                disabled={isSaving}
                              >
                                <SelectTrigger className="border-none shadow-none focus:ring-0 h-6 p-0 text-right font-black text-[9px] uppercase tracking-widest text-primary/40 hover:text-primary transition-all">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-2xl">
                                  <SelectItem value="issued" className="font-bold">대기 (Issued)</SelectItem>
                                  <SelectItem value="paid" className="font-bold">완료 (Paid)</SelectItem>
                                  <SelectItem value="overdue" className="font-bold">미납 (Overdue)</SelectItem>
                                  <SelectItem value="void" className="font-bold">무효 (Void)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          
                          {inv.status !== 'paid' && (
                            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
                              <Button 
                                onClick={() => handleRealPayment(inv.id)}
                                className="flex-1 h-12 rounded-xl font-black text-sm gap-3 bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 active:scale-[0.98] transition-all"
                              >
                                <CreditCard className="h-5 w-5" /> 실제 카드 결제 진행 (토스 연동)
                              </Button>
                              <Select onValueChange={(val) => handleStatusChange(inv.id, 'paid', val)}>
                                <SelectTrigger className="w-[160px] h-12 rounded-xl font-black text-xs border-2 bg-white text-emerald-600 border-emerald-100 shadow-md">
                                  <div className="flex items-center gap-2"><RefreshCw className="h-4 w-4" /><SelectValue placeholder="수동 수납 처리" /></div>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-2xl p-2">
                                  <SelectItem value="card" className="font-bold py-3 rounded-xl">💳 카드 결제 수동 완료</SelectItem>
                                  <SelectItem value="transfer" className="font-bold py-3 rounded-xl">🏦 계좌 이체 수동 완료</SelectItem>
                                  <SelectItem value="cash" className="font-bold py-3 rounded-xl">💵 현금 수납 수동 완료</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-4 space-y-6">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 overflow-hidden relative group ring-1 ring-border/50">
                <div className="absolute -right-4 -top-4 opacity-5 rotate-12 group-hover:scale-110 transition-transform duration-1000"><Armchair className="h-32 w-32" /></div>
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-black tracking-tighter">배정 재원생 현황</CardTitle>
                    <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black text-[9px]">LIVE SEATS</Badge>
                  </div>
                  <div className="space-y-3">
                    {attendanceList?.filter(a => a.studentId).map(seat => {
                      const student = studentMembers?.find(m => m.id === seat.studentId);
                      const hasInvoice = allInvoices?.some(i => i.studentId === seat.studentId && i.status !== 'void');
                      return (
                        <div key={seat.id} className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border/50 group/seat hover:bg-white hover:shadow-md transition-all">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-white border flex items-center justify-center font-black text-[10px] text-primary/40">{seat.seatNo}</div>
                            <div className="grid">
                              <span className="font-black text-sm">{student?.displayName || '학생'}</span>
                              <span className="text-[8px] font-bold text-muted-foreground uppercase">{seat.seatZone || 'Flex'}</span>
                            </div>
                          </div>
                          {!hasInvoice ? (
                            <Button size="sm" onClick={() => createAutoInvoice(seat.studentId!, student?.displayName || '학생')} className="h-8 rounded-lg font-black text-[9px] bg-emerald-500 hover:bg-emerald-600 gap-1.5"><PlusCircle className="h-3 w-3" /> 인보이스 발행</Button>
                          ) : (
                            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                          )}
                        </div>
                      );
                    })}
                    {(!attendanceList || attendanceList.filter(a => a.studentId).length === 0) && (
                      <p className="text-center py-10 text-[10px] font-bold text-muted-foreground/40 italic">배정된 학생이 없습니다.</p>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="rounded-[2.5rem] border-none shadow-xl bg-primary text-primary-foreground p-8 overflow-hidden relative">
                <Sparkles className="absolute -right-4 -top-4 h-32 w-32 opacity-20 rotate-12" />
                <div className="relative z-10 space-y-6">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 opacity-60" />
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Revenue Health Score</span>
                  </div>
                  <div className="grid gap-1">
                    <h3 className="text-5xl font-black tracking-tighter">{(metrics?.collected && metrics?.accrued) ? Math.round((metrics.collected / metrics.accrued) * 100) : 0}%</h3>
                    <p className="text-xs font-bold opacity-60">이번 달 수납 달성률 (Cash/Accrued)</p>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-white/10">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-60"><span>Accrued Revenue</span><span>₩{metrics?.accrued.toLocaleString()}</span></div>
                    <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-60"><span>Collected Cash</span><span>₩{metrics?.collected.toLocaleString()}</span></div>
                  </div>
                </div>
              </Card>

              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 group ring-1 ring-border/50">
                <CardTitle className="text-base font-black mb-6 uppercase tracking-widest text-primary/40 flex items-center gap-2"><PieChart className="h-4 w-4" /> 수납 수단 비중</CardTitle>
                <div className="space-y-4">
                  <div className="flex justify-between items-end"><span className="text-xs font-bold text-muted-foreground">카드 (Toss SDK)</span><span className="text-lg font-black text-blue-600">72%</span></div>
                  <Progress value={72} className="h-1.5" />
                  <div className="flex justify-between items-end"><span className="text-xs font-bold text-muted-foreground">직접 이체/현금</span><span className="text-lg font-black text-emerald-600">28%</span></div>
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
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">이번 달 발생 매출</p>
                <h3 className="text-4xl font-black tracking-tighter">₩{(metrics?.accrued || 0).toLocaleString()}</h3>
                <Badge className="bg-white/20 border-none text-[10px] px-3 text-emerald-400">Accrued Basis</Badge>
              </div>
            </Card>
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-emerald-600 text-white p-8 overflow-hidden relative">
              <Wallet className="absolute -right-4 -top-4 h-32 w-32 opacity-10 rotate-12" />
              <div className="relative z-10 space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">실제 수납 완료액</p>
                <h3 className="text-4xl font-black tracking-tighter">₩{(metrics?.collected || 0).toLocaleString()}</h3>
                <Badge className="bg-white/20 border-none text-[10px] px-3 text-white">Cash Basis</Badge>
              </div>
            </Card>
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-border/50">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2"><Receipt className="h-3 w-3 text-rose-500" /> 미수금 합계</p>
              <h3 className="text-4xl font-black tracking-tighter text-rose-600">₩{(metrics?.uncollected || 0).toLocaleString()}</h3>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">Outstanding Balance</p>
            </Card>
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-border/50">
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
