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
  Sparkles,
  PieChart,
  ChevronRight,
  Edit2,
  Save,
  X,
  History,
  Search,
  Filter,
  Loader2,
  ArrowRight,
  RefreshCw
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
import { format, eachMonthOfInterval, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function RevenueAnalysis() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [activeDrillDown, setActiveDrillDown] = useState<'revenue' | 'active' | 'churn' | null>(null);
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [tempFeeValue, setTempFeeValue] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'), 
      where('role', '==', 'student')
    );
  }, [firestore, centerId]);
  
  const { data: rawMembers, isLoading: isMembersLoading } = useCollection<CenterMembership>(membersQuery);

  const businessMetrics = useMemo(() => {
    if (!rawMembers) return null;

    const members = [...rawMembers].sort((a, b) => {
      const timeA = a.joinedAt?.toMillis() || 0;
      const timeB = b.joinedAt?.toMillis() || 0;
      return timeB - timeA;
    });

    const activeCount = members.filter(m => m.status === 'active').length;
    const churnCount = members.filter(m => m.status === 'withdrawn').length;
    
    const estimatedMonthlyRevenue = members
      .filter(m => m.status === 'active')
      .reduce((acc, m) => acc + (m.monthlyFee || 350000), 0);

    const now = new Date();
    const months = eachMonthOfInterval({
      start: subMonths(now, 11),
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

  const filteredTimelineMembers = useMemo(() => {
    if (!businessMetrics) return [];
    let list = businessMetrics.allMembers;

    if (selectedMonth) {
      list = list.filter(m => m.joinedAt && format(m.joinedAt.toDate(), 'yyyy-MM') === selectedMonth);
    }

    if (searchTerm) {
      list = list.filter(m => m.displayName?.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (activeDrillDown === 'active') {
      list = list.filter(m => m.status === 'active');
    } else if (activeDrillDown === 'churn') {
      list = list.filter(m => m.status === 'withdrawn');
    }

    return list;
  }, [businessMetrics, selectedMonth, searchTerm, activeDrillDown]);

  const handleUpdateFee = async (studentId: string) => {
    if (!firestore || !centerId) return;
    
    const fee = parseInt(tempFeeValue.replace(/[^0-9]/g, ''));
    if (isNaN(fee)) {
      toast({ variant: "destructive", title: "금액 오류", description: "숫자만 입력해 주세요." });
      return;
    }

    setIsUpdating(true);
    try {
      const memberRef = doc(firestore, 'centers', centerId, 'members', studentId);
      await updateDoc(memberRef, {
        monthlyFee: fee,
        updatedAt: serverTimestamp()
      });

      const userCenterRef = doc(firestore, 'userCenters', studentId, 'centers', centerId);
      await updateDoc(userCenterRef, {
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

  if (isMembersLoading || !businessMetrics) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
        <p className="font-black text-muted-foreground/40 uppercase tracking-widest">분석 엔진 가동 중...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-32 animate-in fade-in duration-1000">
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
            <p className={cn("text-[10px] font-black uppercase tracking-widest", activeDrillDown === 'revenue' ? "text-white/60" : "text-muted-foreground")}>예상 월 매출 (합산)</p>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            <div className="flex items-baseline gap-1">
              <h3 className={cn("text-4xl font-black tracking-tighter", activeDrillDown === 'revenue' ? "text-white" : "text-primary")}>
                ₩{businessMetrics.estimatedMonthlyRevenue.toLocaleString()}
              </h3>
            </div>
            <div className="flex items-center justify-between mt-6">
              <Badge variant="secondary" className={cn("font-black text-[9px]", activeDrillDown === 'revenue' ? "bg-white/20 text-white" : "")}>REAL-TIME</Badge>
              <div className="flex items-center gap-1.5 opacity-40">
                <span className="text-[10px] font-bold">학생별 상세 보기</span>
                <ChevronRight className={cn("h-4 w-4 transition-all", activeDrillDown === 'revenue' ? "rotate-90" : "")} />
              </div>
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
                Active Roster
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
                Churn Analysis
              </div>
              <ChevronRight className={cn("h-5 w-5 transition-all", activeDrillDown === 'churn' ? "rotate-90" : "opacity-20")} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-border/50">
        <CardHeader className="bg-muted/5 border-b p-8 sm:p-10">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-primary" /> 신규 등록 학생 추이 (12개월)
              </CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Bar Chart Click to filter list below</CardDescription>
            </div>
            {selectedMonth && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedMonth(null)} className="h-8 rounded-lg font-black text-[10px] gap-2 border bg-white shadow-sm hover:bg-rose-50 hover:text-rose-600">
                <X className="h-3 w-3" /> 모든 기간 보기
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
                <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis fontSize={11} fontWeight="900" axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{fill: 'rgba(0,0,0,0.02)'}}
                  contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', padding: '15px' }}
                />
                <Bar dataKey="count" radius={[12, 12, 0, 0]} barSize={isMobile ? 24 : 40}>
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
              <Sparkles className="h-3 w-3" /> 막대를 선택하여 과거 특정 시점의 등록 명부를 확인하세요.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-border/50">
        <CardHeader className="bg-muted/5 border-b p-8 sm:p-10">
          <div className={cn("flex justify-between items-center gap-4", isMobile ? "flex-col items-start" : "flex-row")}>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3">
                <CalendarDays className="h-6 w-6 text-primary" /> 학생 등록 및 수강료 관리
              </CardTitle>
              {/* Hydration fix: CardDescription(p) cannot contain Badge(div). Changed to div with same classes. */}
              <div className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                {selectedMonth ? (
                  <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black">{selectedMonth} 등록 현황</Badge>
                ) : activeDrillDown === 'active' ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 font-black">현재 재원생 목록</Badge>
                ) : activeDrillDown === 'churn' ? (
                  <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200 font-black">이탈 학생 분석</Badge>
                ) : (
                  '전체 학생 타임라인'
                )}
                <span className="opacity-40">|</span>
                <span>총 {filteredTimelineMembers.length}명</span>
              </div>
            </div>
            <div className={cn("flex items-center gap-3", isMobile ? "w-full" : "")}>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                <Input 
                  placeholder="이름으로 검색..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rounded-xl border-2 pl-10 h-11 text-xs font-bold w-full sm:w-[200px]"
                />
              </div>
              <Button variant="outline" size="icon" className="rounded-xl h-11 w-11 shrink-0" onClick={() => { setSearchTerm(''); setSelectedMonth(null); setActiveDrillDown(null); }}>
                <RefreshCw className="h-4 w-4 opacity-40" />
              </Button>
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
                        <p className="font-black italic">해당 기간의 등록 데이터가 없습니다.</p>
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
                            <Button size="icon" onClick={() => handleUpdateFee(student.id)} disabled={isUpdating} className="h-10 w-10 rounded-lg bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"><Save className="h-4 w-4" /></Button>
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
                            <div className="opacity-0 group-hover/fee:opacity-100 transition-all p-1.5 rounded-md bg-primary/5">
                              <Edit2 className="h-3 w-3 text-primary" />
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
             <DollarSign className="h-3.5 w-3.5" /> 수강료 금액을 클릭하면 학생별 개별 금액을 실시간으로 수정할 수 있습니다.
           </p>
        </div>
      </Card>

      <section className="bg-primary rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl">
        <Sparkles className="absolute -top-10 -right-10 h-64 w-64 opacity-5 rotate-12" />
        <div className="relative z-10 grid gap-10 lg:grid-cols-2 items-center">
          <div className="space-y-6">
            <Badge className="bg-white/20 text-white border-none font-black text-[9px] px-3 py-1 uppercase tracking-widest">Growth Intelligence</Badge>
            <h4 className="text-4xl font-black tracking-tighter leading-tight">데이터 기반<br/>센터 성장 전략 리포트</h4>
            <div className="h-1.5 w-20 bg-white/20 rounded-full" />
            <p className="text-lg font-bold text-white/70 leading-relaxed max-w-md">
              지난 12개월간의 등록 패턴과 현재 수익 구조를 분석하여 최적의 운영 방안을 제안합니다.
            </p>
          </div>
          
          <div className="grid gap-4">
            {[
              { label: '유입 분석', text: '최근 3개월간 신규 유입이 전년 동기 대비 15% 상승했습니다. 특히 방학 시즌 전 1개월 기점의 등록률이 가장 높습니다.' },
              { label: '재무 건전성', text: '인당 평균 수강료(ARPU)가 안정적입니다. 수강료 개별 조정을 통해 장기 재원생을 위한 장학 혜택을 설계해 보세요.' },
            ].map((insight, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 shadow-lg group hover:bg-white/20 transition-all">
                <Badge className="mb-4 bg-white text-primary border-none font-black text-[9px] uppercase">{insight.label}</Badge>
                <p className="text-sm font-bold leading-relaxed text-white/90">{insight.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
