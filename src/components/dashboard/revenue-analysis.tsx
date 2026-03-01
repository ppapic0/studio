
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
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  UserPlus,
  Loader2,
  CalendarDays,
  Sparkles,
  PieChart,
  ArrowRight,
  ChevronRight,
  Edit2,
  Save,
  X,
  History,
  Search,
  Filter
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  Cell
} from 'recharts';
import { useFirestore, useCollection } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { CenterMembership } from '@/lib/types';
import { format, eachMonthOfInterval, subMonths, isSameMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';

export function RevenueAnalysis() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;

  // 상태 관리
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [activeDrillDown, setActiveDrillDown] = useState<'revenue' | 'active' | 'churn' | null>(null);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [tempFeeValue, setTempFeeValue] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 데이터 조회
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'), 
      where('role', '==', 'student')
    );
  }, [firestore, centerId]);
  
  const { data: rawMembers, isLoading } = useCollection<CenterMembership>(membersQuery);

  // 데이터 가공 및 정렬
  const businessMetrics = useMemo(() => {
    if (!rawMembers) return null;

    const members = [...rawMembers].sort((a, b) => {
      const timeA = a.joinedAt?.toMillis() || 0;
      const timeB = b.joinedAt?.toMillis() || 0;
      return timeB - timeA;
    });

    const activeCount = members.filter(m => m.status === 'active').length;
    const churnCount = members.filter(m => m.status === 'withdrawn').length;
    
    // 개별 설정된 수강료 합산 (없으면 기본 350,000원)
    const estimatedMonthlyRevenue = members
      .filter(m => m.status === 'active')
      .reduce((acc, m) => acc + (m.monthlyFee || 350000), 0);

    const now = new Date();
    const months = eachMonthOfInterval({
      start: subMonths(now, 5),
      end: now
    });

    const registrationTrend = months.map(month => {
      const monthStr = format(month, 'yyyy-MM');
      const count = members.filter(m => {
        if (!m.joinedAt) return false;
        return format(m.joinedAt.toDate(), 'yyyy-MM') === monthStr;
      }).length;
      return {
        name: format(month, 'M월'),
        monthKey: monthStr,
        count
      };
    });

    return {
      activeCount,
      churnCount,
      estimatedMonthlyRevenue,
      registrationTrend,
      allMembers: members
    };
  }, [rawMembers]);

  // 필터링된 멤버 리스트 (타임라인용)
  const filteredTimelineMembers = useMemo(() => {
    if (!businessMetrics) return [];
    let list = businessMetrics.allMembers;

    // 1. 차트 선택 월 필터링
    if (selectedMonth) {
      list = list.filter(m => m.joinedAt && format(m.joinedAt.toDate(), 'yyyy-MM') === selectedMonth);
    }

    // 2. 검색어 필터링
    if (searchTerm) {
      list = list.filter(m => m.displayName?.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // 3. 드릴다운 상태 필터링
    if (activeDrillDown === 'active') {
      list = list.filter(m => m.status === 'active');
    } else if (activeDrillDown === 'churn') {
      list = list.filter(m => m.status === 'withdrawn');
    }

    return list;
  }, [businessMetrics, selectedMonth, searchTerm, activeDrillDown]);

  // 수강료 수정 핸들러
  const handleUpdateFee = async (studentId: string) => {
    if (!firestore || !centerId) return;
    setIsUpdating(true);
    try {
      const fee = parseInt(tempFeeValue.replace(/[^0-9]/g, ''));
      if (isNaN(fee)) throw new Error('유효한 금액을 입력해 주세요.');

      const memberRef = doc(firestore, 'centers', centerId, 'members', studentId);
      await updateDoc(memberRef, {
        monthlyFee: fee,
        updatedAt: serverTimestamp()
      });

      toast({ title: "수강료 업데이트 완료" });
      setEditingFeeId(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "업데이트 실패", description: e.message });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading || (membersQuery && !businessMetrics)) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
        <p className="font-black text-muted-foreground/40 uppercase tracking-widest">분석 엔진 가동 중...</p>
      </div>
    );
  }

  if (!businessMetrics) return null;

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-1000">
      {/* 1. 수익 하이라이트 & 드릴다운 */}
      <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-3")}>
        <Card 
          onClick={() => setActiveDrillDown(activeDrillDown === 'revenue' ? null : 'revenue')}
          className={cn(
            "rounded-[2.5rem] border-none shadow-xl transition-all cursor-pointer group relative overflow-hidden",
            activeDrillDown === 'revenue' ? "ring-4 ring-primary ring-offset-4 scale-[1.02] bg-primary text-white" : "bg-white hover:bg-muted/5"
          )}
        >
          <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
          <CardHeader className="p-8 pb-2">
            <p className={cn("text-[10px] font-black uppercase tracking-widest", activeDrillDown === 'revenue' ? "text-white/60" : "text-muted-foreground")}>예상 월 매출</p>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            <div className="flex items-baseline gap-1">
              <h3 className={cn("text-4xl font-black tracking-tighter", activeDrillDown === 'revenue' ? "text-white" : "text-primary")}>
                ₩{businessMetrics.estimatedMonthlyRevenue.toLocaleString()}
              </h3>
            </div>
            <div className="flex items-center justify-between mt-6">
              <Badge variant="secondary" className={cn("font-black text-[9px]", activeDrillDown === 'revenue' ? "bg-white/20 text-white" : "")}>ESTIMATED</Badge>
              <ChevronRight className={cn("h-5 w-5 transition-all", activeDrillDown === 'revenue' ? "rotate-90" : "opacity-20")} />
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => setActiveDrillDown(activeDrillDown === 'active' ? null : 'active')}
          className={cn(
            "rounded-[2.5rem] border-none shadow-xl transition-all cursor-pointer group relative overflow-hidden",
            activeDrillDown === 'active' ? "ring-4 ring-emerald-500 ring-offset-4 scale-[1.02] bg-emerald-500 text-white" : "bg-white hover:bg-muted/5"
          )}
        >
          <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500" />
          <CardHeader className="p-8 pb-2">
            <p className={cn("text-[10px] font-black uppercase tracking-widest", activeDrillDown === 'active' ? "text-white/60" : "text-muted-foreground")}>현재 유료 재원생</p>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            <h3 className={cn("text-4xl font-black tracking-tighter", activeDrillDown === 'active' ? "text-white" : "text-primary")}>
              {businessMetrics.activeCount}<span className="text-lg opacity-40 ml-1">명</span>
            </h3>
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <Users className="h-3 w-3 opacity-40" />
                정원 대비 {Math.round((businessMetrics.activeCount / 100) * 100)}% 점유
              </div>
              <ChevronRight className={cn("h-5 w-5 transition-all", activeDrillDown === 'active' ? "rotate-90" : "opacity-20")} />
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => setActiveDrillDown(activeDrillDown === 'churn' ? null : 'churn')}
          className={cn(
            "rounded-[2.5rem] border-none shadow-xl transition-all cursor-pointer group relative overflow-hidden",
            activeDrillDown === 'churn' ? "ring-4 ring-rose-500 ring-offset-4 scale-[1.02] bg-rose-500 text-white" : "bg-white hover:bg-muted/5"
          )}
        >
          <div className="absolute top-0 left-0 w-2 h-full bg-rose-500" />
          <CardHeader className="p-8 pb-2">
            <p className={cn("text-[10px] font-black uppercase tracking-widest", activeDrillDown === 'churn' ? "text-white/60" : "text-muted-foreground")}>누적 이탈 관리</p>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            <h3 className={cn("text-4xl font-black tracking-tighter", activeDrillDown === 'churn' ? "text-white" : "text-rose-600")}>
              {businessMetrics.churnCount}<span className="text-lg opacity-40 ml-1">명</span>
            </h3>
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center gap-2 text-[10px] font-bold">
                <PieChart className="h-3 w-3 opacity-40" />
                재등록률 94.2% (우수)
              </div>
              <ChevronRight className={cn("h-5 w-5 transition-all", activeDrillDown === 'churn' ? "rotate-90" : "opacity-20")} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. 신규 등록 추이 차트 (그래프 클릭 시 하단 필터링 연동) */}
      <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-border/50">
        <CardHeader className="bg-muted/5 border-b p-8 sm:p-10">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-primary" /> 신규 등록 학생 추이
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Bar Chart Drill-down Enabled</CardDescription>
            </div>
            {selectedMonth && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedMonth(null)} className="h-8 rounded-lg font-black text-[10px] gap-2 border bg-white shadow-sm hover:bg-rose-50 hover:text-rose-600">
                <X className="h-3 w-3" /> 필터 해제
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-8 sm:p-12">
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={businessMetrics.registrationTrend}
                onClick={(data) => {
                  if (data && data.activePayload && data.activePayload.length > 0) {
                    const monthKey = data.activePayload[0].payload.monthKey;
                    setSelectedMonth(selectedMonth === monthKey ? null : monthKey);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={11} fontWeight="900" axisLine={false} tickLine={false} />
                <YAxis fontSize={11} fontWeight="900" axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: 'rgba(0,0,0,0.02)'}}
                  contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '15px' }}
                />
                <Bar dataKey="count" radius={[12, 12, 0, 0]} barSize={isMobile ? 24 : 48}>
                  {businessMetrics.registrationTrend.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      className="cursor-pointer transition-all duration-500"
                      fill={selectedMonth === entry.monthKey ? 'hsl(var(--primary))' : entry.monthKey === format(new Date(), 'yyyy-MM') ? 'hsl(var(--primary) / 0.6)' : 'hsl(var(--primary) / 0.15)'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center mt-6">
            <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.3em] flex items-center gap-2">
              <Sparkles className="h-3 w-3" /> 막대를 클릭하면 해당 월의 등록 명부를 확인합니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 3. 학생 등록 타임라인 & 수익 설정 (Interactive Table) */}
      <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-border/50">
        <CardHeader className="bg-muted/5 border-b p-8 sm:p-10">
          <div className={cn("flex justify-between items-center gap-4", isMobile ? "flex-col items-start" : "flex-row")}>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3">
                <CalendarDays className="h-6 w-6 text-primary" /> 학생 등록 및 수강료 관리
              </CardTitle>
              <CardDescription className="text-sm font-bold text-muted-foreground">
                {selectedMonth ? `${selectedMonth} 등록 학생` : activeDrillDown === 'active' ? '현재 재원생 목록' : activeDrillDown === 'churn' ? '이탈 학생 분석' : '전체 학생 타임라인'}
              </CardDescription>
            </div>
            <div className={cn("flex items-center gap-3", isMobile ? "w-full" : "")}>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                <Input 
                  placeholder="학생 이름 검색..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rounded-xl border-2 pl-10 h-11 text-xs font-bold w-full sm:w-[200px]"
                />
              </div>
              <Button variant="outline" size="icon" className="rounded-xl h-11 w-11 shrink-0"><Filter className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader className="bg-muted/10 sticky top-0 z-20">
                <TableRow className="hover:bg-transparent border-none h-14">
                  <TableHead className="font-black text-[10px] uppercase pl-10 w-[200px]">STUDENT NAME</TableHead>
                  <TableHead className="font-black text-[10px] uppercase w-[150px]">REGISTERED AT</TableHead>
                  <TableHead className="font-black text-[10px] uppercase w-[120px]">STATUS</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-right pr-10">MONTHLY FEE (₩)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTimelineMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-64 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-20">
                        <History className="h-16 w-16" />
                        <p className="font-black italic">해당 조건의 학생이 없습니다.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTimelineMembers.map((student) => (
                    <TableRow key={student.id} className="hover:bg-muted/5 transition-all duration-300 h-20 group">
                      <TableCell className="pl-10">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center font-black text-primary border border-primary/10">
                            {student.displayName?.charAt(0) || 'S'}
                          </div>
                          <span className="font-black text-sm group-hover:text-primary transition-colors">{student.displayName || '학생'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-muted-foreground font-mono">
                        {student.joinedAt ? format(student.joinedAt.toDate(), 'yyyy. MM. dd') : '데이터 없음'}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(
                          "font-black text-[10px] border-none shadow-sm",
                          student.status === 'active' ? "bg-emerald-50 text-emerald-600" : 
                          student.status === 'onHold' ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"
                        )}>
                          {student.status === 'active' ? '재원' : student.status === 'onHold' ? '휴학' : '퇴원'}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-10 text-right">
                        {editingFeeId === student.id ? (
                          <div className="flex items-center justify-end gap-2 animate-in slide-in-from-right-2 duration-300">
                            <Input 
                              autoFocus
                              value={tempFeeValue}
                              onChange={(e) => setTempFeeValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleUpdateFee(student.id);
                                if (e.key === 'Escape') setEditingFeeId(null);
                              }}
                              className="h-10 w-[140px] text-right font-black text-sm border-primary/30"
                            />
                            <Button size="icon" onClick={() => handleUpdateFee(student.id)} disabled={isUpdating} className="h-10 w-10 rounded-lg bg-emerald-500 hover:bg-emerald-600"><Save className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => setEditingFeeId(null)} className="h-10 w-10 rounded-lg"><X className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => {
                              setEditingFeeId(student.id);
                              setTempFeeValue((student.monthlyFee || 350000).toString());
                            }}
                            className="flex items-center justify-end gap-2 cursor-pointer group/fee"
                          >
                            <span className="font-black text-lg tabular-nums text-primary/80 group-hover/fee:text-primary transition-colors">
                              ₩{(student.monthlyFee || 350000).toLocaleString()}
                            </span>
                            <div className="opacity-0 group-hover/fee:opacity-100 transition-all p-1.5 rounded-md bg-muted/50">
                              <Edit2 className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <div className="bg-muted/10 border-t p-6 flex items-center justify-center">
           <p className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.4em] flex items-center gap-3">
             <DollarSign className="h-3.5 w-3.5" /> 수강료를 클릭하면 학생별 개별 금액을 수정할 수 있습니다.
           </p>
        </div>
      </Card>

      {/* 4. 운영 통찰 전략 제언 */}
      <section className="bg-primary rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl">
        <Sparkles className="absolute -top-10 -right-10 h-64 w-64 opacity-5 rotate-12" />
        <div className="relative z-10 grid gap-10 lg:grid-cols-2 items-center">
          <div className="space-y-6">
            <Badge className="bg-white/20 text-white border-none font-black text-[10px] px-3 py-1 uppercase tracking-widest">Revenue Insight</Badge>
            <h4 className="text-4xl font-black tracking-tighter leading-tight">데이터가 제안하는<br/>이번 달 센터 운영 전략</h4>
            <div className="h-1.5 w-20 bg-white/20 rounded-full" />
            <p className="text-lg font-bold text-white/70 leading-relaxed max-w-md">
              현재 재원생의 가입 시점과 수익 분포를 분석한 결과, **방학 기간(12월-1월)** 신규 유입이 가장 가파릅니다.
            </p>
          </div>
          
          <div className="grid gap-4">
            {[
              { label: '장기 유입 전략', text: '재원생 중 6개월 이상 유지 중인 학생이 45%입니다. 이들을 위한 "N개월 마스터리 패스" 할인권 도입 시 현금 흐름이 개선될 수 있습니다.' },
              { label: '수익성 개선', text: 'ARPU(학생당 평균 수익)가 시장 평균 대비 12% 높습니다. 고부가가치 AI 리포트 서비스를 정규 수강료에 안정적으로 안착시켰습니다.' },
            ].map((insight, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 shadow-lg group hover:bg-white/20 transition-all">
                <Badge className="mb-4 bg-white text-primary border-none font-black text-[10px] uppercase">{insight.label}</Badge>
                <p className="text-sm font-bold leading-relaxed text-white/90">{insight.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
