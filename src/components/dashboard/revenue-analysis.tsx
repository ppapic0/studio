'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  CalendarDays, 
  PieChart,
  ChevronRight,
  Edit2,
  Save,
  X,
  History,
  Search,
  Loader2,
  RefreshCw,
  Gift,
  Users2,
  AlertTriangle,
  Clock,
  ArrowRight,
  BarChart3,
  UserWarning,
  ShieldAlert,
  UserCheck,
  Activity,
  ArrowUpRight,
  Zap,
  LayoutGrid,
  Map,
  Scale,
  Percent
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  Cell,
  PieChart as RechartsPieChart,
  Pie
} from 'recharts';
import { useFirestore, useCollection } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { CenterMembership, StudentProfile } from '@/lib/types';
import { format, eachMonthOfInterval, subMonths, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { syncDailyKpi } from '@/lib/finance-actions';
import Link from 'next/link';

export function RevenueAnalysis() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [activeDrillDown, setActiveDrillDown] = useState<'revenue' | 'active' | 'churn' | 'zones' | 'elasticity' | null>(null);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [tempFeeValue, setTempFeeValue] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 멤버십 정보 조회
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'), 
      where('role', '==', 'student')
    );
  }, [firestore, centerId]);
  
  const { data: rawMembers, isLoading: isMembersLoading } = useCollection<CenterMembership>(membersQuery);

  // 학생 프로필 정보 조회
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'students');
  }, [firestore, centerId]);
  const { data: studentsProfiles } = useCollection<StudentProfile>(studentsQuery);

  const businessMetrics = useMemo(() => {
    if (!rawMembers) return null;

    const members = [...rawMembers].sort((a, b) => {
      const timeA = a.joinedAt?.toMillis() || 0;
      const timeB = b.joinedAt?.toMillis() || 0;
      return timeB - timeA;
    });

    const activeMembers = members.filter(m => m.status === 'active');
    const withdrawnMembers = members.filter(m => m.status === 'withdrawn');
    
    // 수강료 데이터 보정 및 합산
    let totalActualRevenue = 0;
    let totalPotentialRevenue = 0;
    let tutoringDiscountTotal = 0;
    let siblingDiscountTotal = 0;

    activeMembers.forEach(m => {
      const profile = studentsProfiles?.find(p => p.id === m.id);
      const baseFee = profile?.grade?.includes('N수생') ? 540000 : 390000;
      const actualFee = m.monthlyFee ?? baseFee;
      
      totalActualRevenue += actualFee;
      totalPotentialRevenue += baseFee;
      
      if (m.tutoringDiscount) tutoringDiscountTotal += 50000;
      if (m.siblingDiscount) siblingDiscountTotal += Math.floor(baseFee * 0.05);
    });

    const totalDiscountAmount = totalPotentialRevenue - totalActualRevenue;
    const discountDependencyRate = totalPotentialRevenue > 0 ? (totalDiscountAmount / totalPotentialRevenue) * 100 : 0;

    // --- 좌석 구역별 분석 ---
    const zoneData: Record<string, { count: number, revenue: number, potential: number }> = {
      'A존 (Focus)': { count: 0, revenue: 0, potential: 0 },
      'B존 (Standard)': { count: 0, revenue: 0, potential: 0 },
      '자유석 (Flex)': { count: 0, revenue: 0, potential: 0 },
    };

    activeMembers.forEach(m => {
      const profile = studentsProfiles?.find(p => p.id === m.id);
      const baseFee = profile?.grade?.includes('N수생') ? 540000 : 390000;
      const actualFee = m.monthlyFee ?? baseFee;
      const seatNo = profile?.seatNo || 0;
      
      let zone = '자유석 (Flex)';
      if (seatNo > 0 && seatNo <= 30) zone = 'A존 (Focus)';
      else if (seatNo > 30) zone = 'B존 (Standard)';

      if (zoneData[zone]) {
        zoneData[zone].count++;
        zoneData[zone].revenue += actualFee;
        zoneData[zone].potential += baseFee;
      }
    });

    const zoneChartData = Object.entries(zoneData).map(([name, data]) => ({
      name,
      revenue: data.revenue,
      arpu: data.count > 0 ? Math.round(data.revenue / data.count) : 0,
      discountRate: data.potential > 0 ? Math.round(((data.potential - data.revenue) / data.potential) * 100) : 0
    }));

    // --- 가격 탄력성 가설 분석 ---
    const discountGroup = activeMembers.filter(m => m.tutoringDiscount || m.siblingDiscount);
    const regularGroup = activeMembers.filter(m => !m.tutoringDiscount && !m.siblingDiscount);
    
    const churnDiscountGroup = withdrawnMembers.filter(m => m.tutoringDiscount || m.siblingDiscount);
    const churnRegularGroup = withdrawnMembers.filter(m => !m.tutoringDiscount && !m.siblingDiscount);

    const elasticityData = [
      { name: '할인 적용군', active: discountGroup.length, churn: churnDiscountGroup.length, churnRate: (discountGroup.length + churnDiscountGroup.length) > 0 ? Math.round((churnDiscountGroup.length / (discountGroup.length + churnDiscountGroup.length)) * 100) : 0 },
      { name: '정가 수납군', active: regularGroup.length, churn: churnRegularGroup.length, churnRate: (regularGroup.length + churnRegularGroup.length) > 0 ? Math.round((churnRegularGroup.length / (regularGroup.length + churnRegularGroup.length)) * 100) : 0 },
    ];

    return {
      activeCount: activeMembers.length,
      estimatedMonthlyRevenue: totalActualRevenue,
      totalPotentialRevenue,
      totalDiscountAmount,
      discountDependencyRate,
      tutoringDiscountTotal,
      siblingDiscountTotal,
      zoneChartData,
      elasticityData,
      allMembers: members,
      registrationTrend: registrationTrend(members)
    };
  }, [rawMembers, studentsProfiles]);

  function registrationTrend(members: CenterMembership[]) {
    const now = new Date();
    const months = eachMonthOfInterval({ start: subMonths(now, 11), end: now });
    return months.map(month => {
      const monthStr = format(month, 'yyyy-MM');
      const count = members.filter(m => m.joinedAt && format(m.joinedAt.toDate(), 'yyyy-MM') === monthStr).length;
      return { name: format(month, 'M월'), monthKey: monthStr, count };
    });
  }

  const filteredTimelineMembers = useMemo(() => {
    if (!businessMetrics) return [];
    let list = businessMetrics.allMembers;
    if (selectedMonth) list = list.filter(m => m.joinedAt && format(m.joinedAt.toDate(), 'yyyy-MM') === selectedMonth);
    if (searchTerm) list = list.filter(m => m.displayName?.toLowerCase().includes(searchTerm.toLowerCase()));
    if (activeDrillDown === 'active') list = list.filter(m => m.status === 'active');
    else if (activeDrillDown === 'churn') list = list.filter(m => m.status === 'withdrawn');
    return list;
  }, [businessMetrics, selectedMonth, searchTerm, activeDrillDown]);

  const handleUpdateFee = async (studentId: string, customFee?: number) => {
    if (!firestore || !centerId) return;
    let fee = customFee ?? parseInt(tempFeeValue.replace(/[^0-9]/g, ''));
    if (isNaN(fee)) { toast({ variant: "destructive", title: "금액 오류" }); return; }
    setIsUpdating(true);
    try {
      const updateData = { monthlyFee: fee, updatedAt: serverTimestamp() };
      await Promise.all([
        setDoc(doc(firestore, 'centers', centerId, 'members', studentId), updateData, { merge: true }),
        setDoc(doc(firestore, 'userCenters', studentId, 'centers', centerId), updateData, { merge: true })
      ]);
      await syncDailyKpi(firestore, centerId, format(new Date(), 'yyyy-MM-dd'));
      toast({ title: "수강료 업데이트 완료" });
      setEditingFeeId(null);
    } catch (e: any) { toast({ variant: "destructive", title: "업데이트 실패", description: e.message }); } finally { setIsUpdating(false); }
  };

  const handleToggleDiscount = async (studentId: string, type: 'tutoring' | 'sibling') => {
    if (!firestore || !centerId || !rawMembers) return;
    const member = rawMembers.find(m => m.id === studentId);
    if (!member) return;
    const profile = studentsProfiles?.find(p => p.id === studentId);
    const base = profile?.grade?.includes('N수생') ? 540000 : 390000;
    const isTutoring = type === 'tutoring' ? !member.tutoringDiscount : !!member.tutoringDiscount;
    const isSibling = type === 'sibling' ? !member.siblingDiscount : !!member.siblingDiscount;
    let nextFee = base;
    if (isSibling) nextFee = Math.floor(nextFee * 0.95);
    if (isTutoring) nextFee -= 50000;
    setIsUpdating(true);
    try {
      const updateData = { monthlyFee: Math.max(0, nextFee), tutoringDiscount: isTutoring, siblingDiscount: isSibling, updatedAt: serverTimestamp() };
      await Promise.all([
        setDoc(doc(firestore, 'centers', centerId, 'members', studentId), updateData, { merge: true }),
        setDoc(doc(firestore, 'userCenters', studentId, 'centers', centerId), updateData, { merge: true })
      ]);
      await syncDailyKpi(firestore, centerId, format(new Date(), 'yyyy-MM-dd'));
      toast({ title: "할인 정책 적용 완료" });
    } catch (e) { toast({ variant: "destructive", title: "정책 적용 실패" }); } finally { setIsUpdating(false); }
  };

  if (isMembersLoading || !businessMetrics) return null;

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-1000">
      <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-3")}>
        <Card onClick={() => setActiveDrillDown(activeDrillDown === 'revenue' ? null : 'revenue')} className={cn("rounded-[2.5rem] border-none shadow-xl cursor-pointer relative overflow-hidden group transition-all", activeDrillDown === 'revenue' ? "ring-4 ring-primary ring-offset-4 bg-primary text-white" : "bg-white hover:bg-muted/5")}>
          <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
          <CardHeader className="p-8 pb-2"><p className={cn("text-[10px] font-black uppercase tracking-widest", activeDrillDown === 'revenue' ? "text-white/60" : "text-muted-foreground")}>예상 월 매출 (ARPU 합산)</p></CardHeader>
          <CardContent className="p-8 pt-0"><h3 className="text-4xl font-black tracking-tighter">₩{businessMetrics.estimatedMonthlyRevenue.toLocaleString()}</h3>
            <div className="flex items-center justify-between mt-6">
              <Badge variant="secondary" className={cn("font-black text-[9px]", activeDrillDown === 'revenue' ? "bg-white/20 text-white" : "")}>ESTIMATED</Badge>
              <div className="flex items-center gap-1.5 opacity-40"><span className="text-[10px] font-bold">분석 보기</span><ChevronRight className={cn("h-4 w-4 transition-all", activeDrillDown === 'revenue' ? "rotate-90" : "")} /></div>
            </div>
          </CardContent>
        </Card>

        <Card onClick={() => setActiveDrillDown(activeDrillDown === 'zones' ? null : 'zones')} className={cn("rounded-[2.5rem] border-none shadow-xl cursor-pointer relative overflow-hidden group transition-all", activeDrillDown === 'zones' ? "ring-4 ring-blue-500 ring-offset-4 bg-blue-500 text-white" : "bg-white hover:bg-muted/5")}>
          <div className="absolute top-0 left-0 w-2 h-full bg-blue-500" />
          <CardHeader className="p-8 pb-2"><p className={cn("text-[10px] font-black uppercase tracking-widest", activeDrillDown === 'zones' ? "text-white/60" : "text-muted-foreground")}>좌석별 수익성</p></CardHeader>
          <CardContent className="p-8 pt-0"><h3 className="text-4xl font-black tracking-tighter">Inventory<span className="text-lg opacity-40 ml-2">Efficiency</span></h3>
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center gap-2 text-[10px] font-bold"><Map className="h-3 w-3 opacity-40" />구역별 최적화</div>
              <ChevronRight className={cn("h-5 w-5 transition-all", activeDrillDown === 'zones' ? "rotate-90" : "opacity-20")} />
            </div>
          </CardContent>
        </Card>

        <Card onClick={() => setActiveDrillDown(activeDrillDown === 'elasticity' ? null : 'elasticity')} className={cn("rounded-[2.5rem] border-none shadow-xl cursor-pointer relative overflow-hidden group transition-all", activeDrillDown === 'elasticity' ? "ring-4 ring-amber-500 ring-offset-4 bg-amber-500 text-white" : "bg-white hover:bg-muted/5")}>
          <div className="absolute top-0 left-0 w-2 h-full bg-amber-500" />
          <CardHeader className="p-8 pb-2"><p className={cn("text-[10px] font-black uppercase tracking-widest", activeDrillDown === 'elasticity' ? "text-white/60" : "text-muted-foreground")}>할인 의존도 지수</p></CardHeader>
          <CardContent className="p-8 pt-0"><h3 className="text-4xl font-black tracking-tighter">{businessMetrics.discountDependencyRate.toFixed(1)}<span className="text-lg opacity-40 ml-1">%</span></h3>
            <div className="flex items-center justify-between mt-6">
              <div className={cn("flex items-center gap-2 text-[10px] font-bold", businessMetrics.discountDependencyRate > 10 ? "text-rose-200" : "")}>
                <Scale className="h-3 w-3 opacity-40" />{businessMetrics.discountDependencyRate > 10 ? '가격 전략 재검토 필요' : '안정적 구조'}
              </div>
              <ChevronRight className={cn("h-5 w-5 transition-all", activeDrillDown === 'elasticity' ? "rotate-90" : "opacity-20")} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 좌석별 수익성 심층 분석 */}
      {activeDrillDown === 'zones' && (
        <Card className="rounded-[2.5rem] border-none shadow-2xl bg-blue-50/30 overflow-hidden ring-1 ring-blue-100 animate-in slide-in-from-top-4 duration-500">
          <CardHeader className="bg-white/50 border-b border-blue-100 p-8">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 p-2 rounded-xl shadow-lg shadow-blue-200"><LayoutGrid className="h-5 w-5 text-white" /></div>
              <div className="space-y-0.5"><CardTitle className="text-2xl font-black tracking-tighter text-blue-700">공간별 수익 기여도 분석</CardTitle><CardDescription className="text-[10px] font-bold uppercase tracking-widest text-blue-600/60">Revenue per Seat Zone & Inventory Policy</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="p-8"><div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "md:grid-cols-3")}>
            {businessMetrics.zoneChartData.map((zone) => (
              <Card key={zone.name} className="rounded-2xl border-none shadow-sm bg-white p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Map className="h-12 w-12" /></div>
                <p className="text-[10px] font-black text-muted-foreground uppercase mb-4">{zone.name}</p>
                <div className="space-y-4">
                  <div><span className="text-[10px] font-bold opacity-40 block uppercase">Average Revenue</span><span className="text-2xl font-black text-blue-600">₩{zone.arpu.toLocaleString()}</span></div>
                  <div className="pt-4 border-t border-dashed">
                    <div className="flex justify-between items-center mb-1.5"><span className="text-[9px] font-black uppercase text-muted-foreground">Discount Rate</span><span className="text-xs font-black text-primary">{zone.discountRate}%</span></div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden"><div className="h-full bg-blue-500" style={{ width: `${zone.discountRate}%` }} /></div>
                  </div>
                </div>
              </Card>
            ))}
          </div></CardContent>
        </Card>
      )}

      {/* 할인 의존도 및 탄력성 분석 */}
      {activeDrillDown === 'elasticity' && (
        <Card className="rounded-[2.5rem] border-none shadow-2xl bg-amber-50/30 overflow-hidden ring-1 ring-amber-100 animate-in slide-in-from-top-4 duration-500">
          <CardHeader className="bg-white/50 border-b border-amber-100 p-8">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500 p-2 rounded-xl shadow-lg shadow-amber-200"><Scale className="h-5 w-5 text-white" /></div>
              <div className="space-y-0.5"><CardTitle className="text-2xl font-black tracking-tighter text-amber-700">할인 정책 의존도 및 탄력성</CardTitle><CardDescription className="text-[10px] font-bold uppercase tracking-widest text-amber-600/60">Price Sensitivity & Discount Risk Index</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "md:grid-cols-12")}>
              <div className="md:col-span-5 space-y-4">
                <Card className="rounded-2xl border-none shadow-sm bg-white p-8 text-center space-y-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase">총 할인 비중</p>
                  <div className={cn("text-6xl font-black tracking-tighter", businessMetrics.discountDependencyRate > 10 ? "text-rose-600" : "text-emerald-600")}>{businessMetrics.discountDependencyRate.toFixed(1)}%</div>
                  {businessMetrics.discountDependencyRate > 10 && (
                    <div className="flex items-center justify-center gap-2 text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-100 animate-pulse"><AlertTriangle className="h-4 w-4" /><span className="text-[10px] font-black uppercase">전략 재검토 구간</span></div>
                  )}
                </Card>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-4 rounded-xl border shadow-sm text-center"><p className="text-[9px] font-black text-muted-foreground uppercase mb-1">과외 할인</p><p className="text-lg font-black text-primary">₩{(businessMetrics.tutoringDiscountTotal / 10000).toFixed(0)}만</p></div>
                  <div className="bg-white p-4 rounded-xl border shadow-sm text-center"><p className="text-[9px] font-black text-muted-foreground uppercase mb-1">형제 할인</p><p className="text-lg font-black text-primary">₩{(businessMetrics.siblingDiscountTotal / 10000).toFixed(0)}만</p></div>
                </div>
              </div>
              <div className="md:col-span-7">
                <Card className="rounded-2xl border-none shadow-sm bg-white p-8 h-full">
                  <div className="flex items-center gap-2 mb-6"><TrendingUp className="h-4 w-4 text-primary" /><h4 className="text-xs font-black uppercase">그룹별 이탈률 (가격 탄력성 기초)</h4></div>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={businessMetrics.elasticityData} layout="vertical" margin={{ left: 40, right: 40 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" fontSize={11} fontWeight="bold" axisLine={false} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="churnRate" fill="#f59e0b" radius={[0, 10, 10, 0]} barSize={30}>
                          <Badge className="ml-2 font-black">%</Badge>
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground leading-relaxed mt-4">💡 **정가 수납군** 대비 **할인 적용군**의 이탈률이 낮다면 할인이 강력한 리텐션 도구임을 뜻하며, 반대라면 가격 저항선이 높은 상태입니다.</p>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 등록 추이 및 학생 리스트 */}
      <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-border/50">
        <CardHeader className="bg-muted/5 border-b p-8 sm:p-10">
          <div className={cn("flex justify-between items-center gap-4", isMobile ? "flex-col items-start" : "flex-row")}>
            <div className="space-y-1"><CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3"><CalendarDays className="h-6 w-6 text-primary" /> 학생 등록 및 개별 수강료 관리</CardTitle>
              <div className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                {selectedMonth ? <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black">{selectedMonth} 등록</Badge> : <span className="text-sm font-bold">전체 학생 타임라인</span>}
                <span className="opacity-40">|</span><span className="text-sm font-bold">총 {filteredTimelineMembers.length}명</span>
              </div>
            </div>
            <div className={cn("flex items-center gap-3", isMobile ? "w-full" : "")}>
              <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                <Input placeholder="이름으로 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="rounded-xl border-2 pl-10 h-11 text-xs font-bold w-full sm:w-[200px]" />
              </div>
              <Button variant="outline" size="icon" className="rounded-xl h-11 w-11 shrink-0" onClick={() => { setSearchTerm(''); setSelectedMonth(null); setActiveDrillDown(null); }}><RefreshCw className="h-4 w-4 opacity-40" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader className="bg-muted/10 sticky top-0 z-20">
                <TableRow className="hover:bg-transparent border-none h-14">
                  <TableHead className="font-black text-[10px] uppercase pl-10 w-[200px]">STUDENT NAME</TableHead>
                  <TableHead className="font-black text-[10px] uppercase w-[120px]">ZONE</TableHead>
                  <TableHead className="font-black text-[10px] uppercase w-[180px]">DISCOUNTS</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-right pr-10">MONTHLY FEE (₩)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTimelineMembers.length === 0 ? <TableRow><TableCell colSpan={4} className="h-64 text-center opacity-20 italic">데이터가 없습니다.</TableCell></TableRow> : 
                  filteredTimelineMembers.map((student) => {
                    const profile = studentsProfiles?.find(p => p.id === student.id);
                    const basePrice = profile?.grade?.includes('N수생') ? 540000 : 390000;
                    const finalFee = student.monthlyFee !== undefined ? student.monthlyFee : basePrice;
                    const seatNo = profile?.seatNo || 0;
                    let zone = 'Flex';
                    if (seatNo > 0 && seatNo <= 30) zone = 'A';
                    else if (seatNo > 30) zone = 'B';

                    return (
                      <TableRow key={student.id} className="hover:bg-muted/5 transition-all duration-300 h-24 group">
                        <TableCell className="pl-10">
                          <Link href={`/dashboard/teacher/students/${student.id}`} className="flex items-center gap-4 cursor-pointer">
                            <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center font-black text-primary border border-primary/10 group-hover:bg-primary group-hover:text-white transition-colors">{student.displayName?.charAt(0) || 'S'}</div>
                            <div className="flex flex-col"><span className="font-black text-sm group-hover:text-primary transition-colors">{student.displayName || '학생'}</span><span className="text-[10px] font-bold text-muted-foreground">{profile?.grade || '학년 미정'}</span></div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("font-black text-[9px] border-2 uppercase", zone === 'A' ? "border-blue-200 text-blue-600 bg-blue-50" : zone === 'B' ? "border-emerald-200 text-emerald-600 bg-emerald-50" : "border-slate-200 text-slate-600 bg-slate-50")}>{zone} ZONE</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant={student.tutoringDiscount ? "default" : "outline"} className={cn("h-8 rounded-lg font-black text-[10px] gap-1 px-2.5 transition-all", student.tutoringDiscount ? "bg-blue-500" : "text-blue-600 border-blue-100")} onClick={() => handleToggleDiscount(student.id, 'tutoring')} disabled={isUpdating || student.status !== 'active'}><Gift className="h-3 w-3" /> 과외</Button>
                            <Button size="sm" variant={student.siblingDiscount ? "default" : "outline"} className={cn("h-8 rounded-lg font-black text-[10px] gap-1 px-2.5 transition-all", student.siblingDiscount ? "bg-emerald-500" : "text-emerald-600 border-emerald-100")} onClick={() => handleToggleDiscount(student.id, 'sibling')} disabled={isUpdating || student.status !== 'active'}><Users2 className="h-3 w-3" /> 형제</Button>
                          </div>
                        </TableCell>
                        <TableCell className="pr-10 text-right">
                          {editingFeeId === student.id ? (
                            <div className="flex items-center justify-end gap-2 animate-in slide-in-from-right-2 duration-300">
                              <Input autoFocus value={tempFeeValue} onChange={(e) => setTempFeeValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateFee(student.id); if (e.key === 'Escape') setEditingFeeId(null); }} className="h-10 w-[140px] text-right font-black text-sm border-primary/30" />
                              <Button size="icon" onClick={() => handleUpdateFee(student.id)} disabled={isUpdating} className="h-10 w-10 rounded-lg bg-emerald-500"><Save className="h-4 w-4" /></Button>
                            </div>
                          ) : (
                            <div onClick={() => student.status === 'active' && (setEditingFeeId(student.id), setTempFeeValue(finalFee.toString()))} className={cn("flex items-center justify-end gap-2 cursor-pointer group/fee", student.status !== 'active' && "opacity-40")}>
                              <span className="font-black text-lg tabular-nums text-primary/80 group-hover/fee:text-primary transition-colors">₩{finalFee.toLocaleString()}</span>
                              {student.status === 'active' && <Edit2 className="h-3 w-3 text-primary opacity-0 group-hover/fee:opacity-100 transition-all" />}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                }
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
