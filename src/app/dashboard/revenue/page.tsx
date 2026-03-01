
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '@/contexts/app-context';
import { useCollection, useFirestore, useDoc } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, doc, getDoc, limit, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import { KpiDaily, FinanceSettings } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Settings,
  Loader2,
  Info,
  RefreshCw,
  Percent,
  Wallet
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
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { RevenueAnalysis } from '@/components/dashboard/revenue-analysis';
import { useToast } from '@/hooks/use-toast';

export default function RevenuePage() {
  const { activeMembership, viewMode, membershipsLoading } = useAppContext();
  const firestore = useFirestore();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 재무 설정 폼 상태
  const [fixedCosts, setFixedCosts] = useState<number>(0);
  const [penaltyType, setPenaltyType] = useState<'none' | 'rate' | 'fixed'>('none');
  const [penaltyValue, setPenaltyValue] = useState<number>(0);
  const [discountOrder, setDiscountOrder] = useState<'rateFirst' | 'fixedFirst'>('rateFirst');

  // 센터 데이터 및 재무 설정 조회
  const centerRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId);
  }, [firestore, centerId]);
  const { data: centerData } = useDoc<any>(centerRef);

  useEffect(() => {
    if (centerData?.financeSettings) {
      const settings = centerData.financeSettings as FinanceSettings;
      setFixedCosts(settings.fixedCosts || 0);
      setPenaltyType(settings.refundPolicy?.penaltyType || 'none');
      setPenaltyValue(settings.refundPolicy?.penaltyType === 'rate' 
        ? (settings.refundPolicy.penaltyRate || 0) * 100 
        : (settings.refundPolicy?.penaltyFixed || 0));
      setDiscountOrder(settings.discountPolicy?.order?.[0] === 'rateFirst' ? 'rateFirst' : 'fixedFirst');
    }
  }, [centerData]);

  const kpiQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'kpiDaily'),
      orderBy('date', 'desc'),
      limit(30)
    );
  }, [firestore, centerId]);

  const { data: kpiHistory, isLoading: isKpiLoading } = useCollection<KpiDaily>(kpiQuery);

  const todayKpi = useMemo(() => kpiHistory?.[0], [kpiHistory]);
  const yesterdayKpi = useMemo(() => kpiHistory?.[1], [kpiHistory]);

  const growth = useMemo(() => {
    if (!todayKpi || !yesterdayKpi || yesterdayKpi.totalRevenue === 0) return 0;
    return ((todayKpi.totalRevenue - yesterdayKpi.totalRevenue) / yesterdayKpi.totalRevenue) * 100;
  }, [todayKpi, yesterdayKpi]);

  const chartData = useMemo(() => {
    if (!kpiHistory || kpiHistory.length === 0) {
      // 데이터가 없을 때 빈 차트 방지용 더미 데이터
      return Array.from({ length: 7 }).map((_, i) => ({
        name: format(new Date(Date.now() - (6 - i) * 86400000), 'MM/dd'),
        revenue: 0,
        students: 0
      }));
    }
    return [...kpiHistory].reverse().map(k => ({
      name: k.date.substring(5).replace('-', '/'),
      revenue: Math.round((k.totalRevenue || 0) / 10000), // 만원 단위
      students: k.activeStudentCount || 0
    }));
  }, [kpiHistory]);

  const handleSaveSettings = async () => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      const financeSettings: FinanceSettings = {
        fixedCosts,
        refundPolicy: {
          penaltyType,
          penaltyRate: penaltyType === 'rate' ? penaltyValue / 100 : undefined,
          penaltyFixed: penaltyType === 'fixed' ? penaltyValue : undefined,
          perDayRounding: 'floor'
        },
        discountPolicy: {
          order: [discountOrder] as any
        }
      };

      await updateDoc(doc(firestore, 'centers', centerId), {
        financeSettings,
        updatedAt: serverTimestamp()
      });

      toast({ title: "재무 정책이 저장되었습니다." });
      setIsSettingsOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "저장 실패", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (membershipsLoading || isKpiLoading) {
    return (
      <div className="flex flex-col h-[70vh] w-full items-center justify-center gap-6">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
        <p className="font-black text-primary tracking-tighter">재무 데이터를 집계 중입니다...</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-8 w-full max-w-[1400px] mx-auto pb-20", isMobile ? "px-1" : "px-4 py-6")}>
      <header className={cn("flex justify-between items-end", isMobile ? "px-2 flex-col gap-4 items-start" : "")}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary/60">
            <Calculator className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Advanced Finance Matrix</span>
          </div>
          <h1 className={cn("font-black tracking-tighter text-primary leading-none", isMobile ? "text-3xl" : "text-5xl")}>
            재무 및 손익 분석
          </h1>
          <p className="text-sm font-bold text-muted-foreground/70 mt-2">센터의 실질 수익성과 재무 건전성을 관리합니다.</p>
        </div>
        <Button onClick={() => setIsSettingsOpen(true)} variant="outline" className="rounded-2xl font-black gap-2 h-12 border-2 shadow-sm bg-white hover:bg-primary hover:text-white transition-all">
          <Settings className="h-4 w-4" /> 재무 정책 설정
        </Button>
      </header>

      {/* 실시간 KPI 섹션 */}
      <section className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-4")}>
        <Card className="rounded-[2rem] border-none shadow-xl bg-primary text-primary-foreground p-8 overflow-hidden relative group">
          <DollarSign className="absolute -right-4 -top-4 h-32 w-32 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-700" />
          <div className="relative z-10 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">오늘 매출 (결제기준)</p>
            <div className="flex items-baseline gap-1">
              <h3 className={cn("font-black tracking-tighter", isMobile ? "text-3xl" : "text-4xl")}>₩{(todayKpi?.totalRevenue || 0).toLocaleString()}</h3>
            </div>
            <Badge className={cn("bg-white/20 border-none font-black text-[10px] py-1 px-3", growth >= 0 ? "text-emerald-400" : "text-rose-400")}>
              {growth >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
              {Math.abs(growth).toFixed(1)}% 전일 대비
            </Badge>
          </div>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-xl bg-white p-8 group hover:shadow-2xl transition-all">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <Target className="h-3 w-3 text-amber-500" /> 손익분기점 (BEP)
          </p>
          <div className="flex justify-between items-end">
            <div>
              <h3 className="text-4xl font-black tracking-tighter text-primary">{todayKpi?.breakevenStudents || '-'}<span className="text-lg opacity-40 ml-1">명</span></h3>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">목표 재원생 수</p>
            </div>
            <div className="bg-amber-50 p-3 rounded-2xl group-hover:rotate-12 transition-transform"><Target className="h-6 w-6 text-amber-600" /></div>
          </div>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-xl bg-white p-8 group hover:shadow-2xl transition-all">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <PieChart className="h-3 w-3 text-blue-500" /> 평균 객단가 (ARPU)
          </p>
          <div className="flex justify-between items-end">
            <div>
              <h3 className="text-4xl font-black tracking-tighter text-primary">₩{Math.round(todayKpi?.avgFinalPrice || 0).toLocaleString()}</h3>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">실질 인당 수강료</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-2xl group-hover:rotate-12 transition-transform"><PieChart className="h-6 w-6 text-blue-600" /></div>
          </div>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-xl bg-white p-8 group hover:shadow-2xl transition-all">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
            <TrendingUp className="h-3 w-3 text-rose-500" /> 총 할인액
          </p>
          <div className="flex justify-between items-end">
            <div>
              <h3 className="text-4xl font-black tracking-tighter text-rose-600">₩{(todayKpi?.totalDiscount || 0).toLocaleString()}</h3>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">프로모션/형제 할인</p>
            </div>
            <div className="bg-rose-50 p-3 rounded-2xl group-hover:rotate-12 transition-transform"><TrendingUp className="h-6 w-6 text-rose-600" /></div>
          </div>
        </Card>
      </section>

      {/* 매출 추이 그래프 */}
      <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-border/50">
        <CardHeader className="p-8 sm:p-10 border-b bg-muted/5">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-primary" /> 매출 및 성장 트렌드
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Revenue & Growth History (Unit: 10,000 KRW)</CardDescription>
            </div>
            <Badge variant="outline" className="font-black text-[10px] border-primary/20 bg-white">최근 30일 데이터</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-8 sm:p-10">
          <div className="h-[350px] w-full">
            {isKpiLoading ? (
              <div className="h-full w-full flex items-center justify-center bg-muted/5 rounded-3xl">
                <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
              </div>
            ) : chartData.every(d => d.revenue === 0) ? (
              <div className="h-full w-full flex flex-col items-center justify-center gap-4 bg-muted/5 rounded-3xl border-2 border-dashed">
                <Info className="h-12 w-12 text-muted-foreground opacity-10" />
                <p className="text-sm font-bold text-muted-foreground/40 italic">집계된 매출 데이터가 아직 없습니다.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={11} fontWeight="bold" axisLine={false} tickLine={false} tick={{fill: '#999'}} />
                  <YAxis fontSize={11} fontWeight="900" axisLine={false} tickLine={false} tick={{fill: '#999'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                    cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 2, strokeDasharray: '5 5' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    name="매출(만원)"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorRev)" 
                    animationDuration={2000}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 기존 학생별 수익 관리 리스트 */}
      <div className="mt-4">
        <RevenueAnalysis />
      </div>

      {/* 재무 정책 설정 다이얼로그 */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl", isMobile ? "fixed inset-0 w-full h-full max-w-none rounded-none" : "sm:max-w-lg")}>
          <div className="bg-primary p-10 text-white relative">
            <Sparkles className="absolute top-0 right-0 p-10 h-40 w-40 opacity-10 rotate-12" />
            <DialogHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-white/20 p-1.5 rounded-lg"><Settings className="h-4 w-4" /></div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Finance Policy</span>
              </div>
              <DialogTitle className="text-3xl font-black tracking-tighter">재무 정책 설정</DialogTitle>
              <DialogDescription className="text-white/70 font-bold mt-1">센터 운영비 및 환불/할인 로직을 구성합니다.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-8 space-y-8 bg-white max-h-[60vh] overflow-y-auto custom-scrollbar">
            {/* 고정비 설정 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 ml-1">
                <Wallet className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-black text-primary uppercase">운영 고정비 (월 평균)</h4>
              </div>
              <div className="p-5 rounded-2xl bg-muted/30 border border-border/50 space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-muted-foreground uppercase ml-1">월 총 고정비 (임대료+인건비+관리비 등)</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-primary">₩</span>
                    <Input 
                      type="number" 
                      value={fixedCosts} 
                      onChange={(e) => setFixedCosts(Number(e.target.value))}
                      className="h-12 pl-10 rounded-xl border-2 font-black text-lg"
                    />
                  </div>
                  <p className="text-[9px] font-bold text-muted-foreground/60 flex items-center gap-1 ml-1">
                    <Info className="h-3 w-3" /> 이 수치를 기반으로 실시간 손익분기점(BEP)이 계산됩니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 환불 정책 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 ml-1">
                <RefreshCw className="h-4 w-4 text-rose-500" />
                <h4 className="text-sm font-black text-rose-600 uppercase">환불 위약금 정책</h4>
              </div>
              <div className="p-5 rounded-2xl bg-rose-50/30 border border-rose-100 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {['none', 'rate', 'fixed'].map((type) => (
                    <Button
                      key={type}
                      variant="outline"
                      onClick={() => setPenaltyType(type as any)}
                      className={cn(
                        "h-12 rounded-xl font-black text-xs border-2 transition-all",
                        penaltyType === type ? "bg-rose-500 border-rose-500 text-white shadow-lg" : "bg-white border-rose-100 text-rose-400"
                      )}
                    >
                      {type === 'none' ? '없음' : type === 'rate' ? '정률(%)' : '정액(원)'}
                    </Button>
                  ))}
                </div>
                {penaltyType !== 'none' && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                    <Label className="text-[10px] font-black text-rose-600/60 uppercase ml-1">
                      {penaltyType === 'rate' ? '위약금 비율 (%)' : '위약금 정액 (₩)'}
                    </Label>
                    <div className="relative">
                      {penaltyType === 'rate' ? (
                        <Percent className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-rose-300" />
                      ) : (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-rose-300">₩</span>
                      )}
                      <Input 
                        type="number" 
                        value={penaltyValue} 
                        onChange={(e) => setPenaltyValue(Number(e.target.value))}
                        className={cn("h-12 rounded-xl border-2 font-black text-lg", penaltyType === 'fixed' ? "pl-10" : "pr-10")}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 할인 정책 순서 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 ml-1">
                <Percent className="h-4 w-4 text-emerald-500" />
                <h4 className="text-sm font-black text-emerald-600 uppercase">할인 적용 순서</h4>
              </div>
              <div className="p-5 rounded-2xl bg-emerald-50/30 border border-emerald-100 space-y-4">
                <Select value={discountOrder} onValueChange={(val: any) => setDiscountOrder(val)}>
                  <SelectTrigger className="h-12 rounded-xl border-2 border-emerald-100 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-2xl">
                    <SelectItem value="rateFirst">정률(%) 우선 적용 (추천)</SelectItem>
                    <SelectItem value="fixedFirst">정액(원) 우선 적용</SelectItem>
                  </SelectContent>
                </Select>
                <div className="p-3 bg-white/80 rounded-xl border border-emerald-100/50 flex items-start gap-3">
                  <Info className="h-4 w-4 text-emerald-500 mt-0.5" />
                  <p className="text-[10px] font-bold text-emerald-900/60 leading-relaxed">
                    적용 순서에 따라 최종 결제 금액이 미세하게 달라질 수 있습니다. 센터 수익성을 고려하여 선택해 주세요.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-muted/30 border-t">
            <Button onClick={handleSaveSettings} disabled={isSaving} className="w-full h-14 rounded-2xl font-black text-lg shadow-xl active:scale-95 transition-all">
              {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : '정책 설정 저장하기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
