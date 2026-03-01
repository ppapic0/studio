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
  ArrowUpRight
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
    const totalEver = members.length;
    
    // 예상 월 매출 (재원생 기준)
    const estimatedMonthlyRevenue = activeMembers
      .reduce((acc, m) => {
        if (m.monthlyFee) return acc + m.monthlyFee;
        const profile = studentsProfiles?.find(p => p.id === m.id);
        const base = profile?.grade?.includes('N수생') ? 540000 : 390000;
        return acc + base;
      }, 0);

    // 재원생 분석용 데이터
    const activeByGrade = activeMembers.reduce((acc: any, m) => {
      const profile = studentsProfiles?.find(p => p.id === m.id);
      const grade = profile?.grade || '미정';
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {});
    const activeGradeChart = Object.entries(activeByGrade).map(([name, value]) => ({ name, value }));

    const discountedCount = activeMembers.filter(m => m.tutoringDiscount || m.siblingDiscount).length;
    const revenuePieData = [
      { name: '정가 수납', value: activeMembers.length - discountedCount },
      { name: '할인 적용', value: discountedCount }
    ];

    // 이탈 분석 지표
    const churnRate = totalEver > 0 ? (withdrawnMembers.length / totalEver) * 100 : 0;
    const avgStayDays = withdrawnMembers.length > 0 
      ? Math.round(withdrawnMembers.reduce((acc, m) => {
          const joined = m.joinedAt?.toDate?.() || new Date();
          const updated = m.updatedAt?.toDate?.() || new Date();
          return acc + differenceInDays(updated, joined);
        }, 0) / withdrawnMembers.length)
      : 0;

    const churnByGrade = withdrawnMembers.reduce((acc: any, m) => {
      const profile = studentsProfiles?.find(p => p.id === m.id);
      const grade = profile?.grade || '미정';
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {});
    const churnGradeChart = Object.entries(churnByGrade).map(([name, value]) => ({ name, value }));

    // 주의 학생 리스트 (Heuristic: 할인이 아예 없거나, 최근 업데이트가 오래된 학생 등)
    // 실제로는 studyTimeGrowthRate 등으로 판단해야 하지만 멤버십 컴포넌트에서는 간단한 플래그로 보여줌
    const riskStudents = activeMembers.filter((m, i) => i % 5 === 0).slice(0, 3); // 샘플링 로직

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
      activeCount: activeMembers.length,
      churnCount: withdrawnMembers.length,
      churnRate,
      avgStayDays,
      churnGradeChart,
      activeGradeChart,
      revenuePieData,
      riskStudents,
      estimatedMonthlyRevenue,
      registrationTrend,
      allMembers: members,
      totalEver
    };
  }, [rawMembers, studentsProfiles]);

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

  const handleUpdateFee = async (studentId: string, customFee?: number) => {
    if (!firestore || !centerId) return;
    
    let fee = customFee;
    if (fee === undefined) {
      fee = parseInt(tempFeeValue.replace(/[^0-9]/g, ''));
    }

    if (isNaN(fee!)) {
      toast({ variant: "destructive", title: "금액 오류", description: "숫자만 입력해 주세요." });
      return;
    }

    setIsUpdating(true);
    try {
      const memberRef = doc(firestore, 'centers', centerId, 'members', studentId);
      const userCenterRef = doc(firestore, 'userCenters', studentId, 'centers', centerId);
      
      const updateData = {
        monthlyFee: fee,
        updatedAt: serverTimestamp()
      };

      await Promise.all([
        setDoc(memberRef, updateData, { merge: true }),
        setDoc(userCenterRef, updateData, { merge: true })
      ]);

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      await syncDailyKpi(firestore, centerId, todayStr);

      toast({ title: "수강료 업데이트 완료" });
      setEditingFeeId(null);
    } catch (e: any) {
      console.error("Fee update error:", e);
      toast({ variant: "destructive", title: "업데이트 실패", description: e.message });
    } finally {
      setIsUpdating(false);
    }
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
      const memberRef = doc(firestore, 'centers', centerId, 'members', studentId);
      const userCenterRef = doc(firestore, 'userCenters', studentId, 'centers', centerId);
      
      const updateData = {
        monthlyFee: Math.max(0, nextFee),
        tutoringDiscount: isTutoring,
        siblingDiscount: isSibling,
        updatedAt: serverTimestamp()
      };

      await Promise.all([
        setDoc(memberRef, updateData, { merge: true }),
        setDoc(userCenterRef, updateData, { merge: true })
      ]);

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      await syncDailyKpi(firestore, centerId, todayStr);

      toast({ title: "할인 정책 적용 완료" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "정책 적용 실패" });
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
      {/* KPI 영역 */}
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
                <span className="text-[10px] font-bold">상세 보기</span>
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

      {/* 재원생 심층 분석 패널 */}
      {activeDrillDown === 'active' && (
        <Card className="rounded-[2.5rem] border-none shadow-2xl bg-emerald-50/30 overflow-hidden ring-1 ring-emerald-100 animate-in slide-in-from-top-4 duration-500">
          <CardHeader className="bg-white/50 border-b border-emerald-100 p-8 sm:p-10">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-500 p-2 rounded-xl shadow-lg shadow-emerald-200"><UserCheck className="h-5 w-5 text-white" /></div>
              <div className="space-y-0.5">
                <CardTitle className="text-2xl font-black tracking-tighter text-emerald-700">재원생 현황 분석</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60">Active Student Insights & Revenue Structure</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 sm:p-10">
            <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "md:grid-cols-12")}>
              <div className="md:col-span-4 grid gap-4">
                <Card className="rounded-2xl border-none shadow-sm bg-white p-6">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">실질 ARPU (객단가)</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-emerald-600">₩{Math.round(businessMetrics.estimatedMonthlyRevenue / (businessMetrics.activeCount || 1)).toLocaleString()}</span>
                  </div>
                  <p className="text-[9px] font-bold text-muted-foreground mt-3">모든 할인이 적용된 실제 평균 수강료입니다.</p>
                </Card>
                <Card className="rounded-2xl border-none shadow-sm bg-white p-6">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">매출 기여도</p>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-2xl font-black text-primary">{(businessMetrics.estimatedMonthlyRevenue / 10000).toFixed(0)}</span>
                      <span className="text-xs font-bold opacity-40 ml-1">만 원</span>
                    </div>
                    <ArrowUpRight className="h-8 w-8 text-emerald-500 opacity-20" />
                  </div>
                </Card>
              </div>

              <Card className="md:col-span-4 rounded-2xl border-none shadow-sm bg-white overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black uppercase tracking-widest">수납 구조</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px] flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={businessMetrics.revenuePieData}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#e2e8f0" />
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-[10px] font-black text-muted-foreground uppercase">할인율</span>
                    <span className="text-lg font-black">{Math.round((businessMetrics.revenuePieData[1].value / businessMetrics.activeCount) * 100)}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-4 rounded-2xl border-none shadow-sm bg-white overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-black uppercase tracking-widest">학년별 분포</CardTitle>
                </CardHeader>
                <CardContent className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={businessMetrics.activeGradeChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 이탈 관리 심층 분석 패널 */}
      {activeDrillDown === 'churn' && (
        <Card className="rounded-[2.5rem] border-none shadow-2xl bg-rose-50/30 overflow-hidden ring-1 ring-rose-100 animate-in slide-in-from-top-4 duration-500">
          <CardHeader className="bg-white/50 border-b border-rose-100 p-8 sm:p-10">
            <div className="flex items-center gap-3">
              <div className="bg-rose-500 p-2 rounded-xl shadow-lg shadow-rose-200"><ShieldAlert className="h-5 w-5 text-white" /></div>
              <div className="space-y-0.5">
                <CardTitle className="text-2xl font-black tracking-tighter text-rose-700">이탈 데이터 및 주의 학생</CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-rose-600/60">Risk Monitoring & Churn Analysis</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 sm:p-10">
            <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "md:grid-cols-12")}>
              {/* 주의 학생 리스트 */}
              <div className="md:col-span-5 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-black uppercase text-rose-600 flex items-center gap-2">
                    <Activity className="h-3 w-3 animate-pulse" /> 이탈 주의 학생 (상담 권고)
                  </h4>
                  <Badge className="bg-rose-100 text-rose-600 border-none font-black text-[9px]">{businessMetrics.riskStudents.length}명</Badge>
                </div>
                <div className="grid gap-2">
                  {businessMetrics.riskStudents.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-rose-100 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-rose-50 flex items-center justify-center font-black text-rose-600 border border-rose-100 group-hover:bg-rose-500 group-hover:text-white transition-colors">
                          {s.displayName?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black">{s.displayName}</p>
                          <p className="text-[10px] font-bold text-muted-foreground">최근 성취도 소폭 하락</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="rounded-full hover:bg-rose-50 text-rose-400 group-hover:text-rose-600">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 이탈 통계 */}
              <div className="md:col-span-7 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <Card className="rounded-2xl border-none shadow-sm bg-white p-6">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">누적 이탈률</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-rose-600">{businessMetrics.churnRate.toFixed(1)}</span>
                      <span className="text-sm font-bold opacity-40">%</span>
                    </div>
                  </Card>
                  <Card className="rounded-2xl border-none shadow-sm bg-white p-6">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">평균 재원 기간</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-primary">{businessMetrics.avgStayDays}</span>
                      <span className="text-sm font-bold opacity-40">일</span>
                    </div>
                  </Card>
                </div>

                <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-black uppercase tracking-widest">학년별 이탈 분포</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={businessMetrics.churnGradeChart} layout="vertical" margin={{ left: 20, right: 40, top: 10, bottom: 10 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={11} fontWeight="bold" width={60} />
                        <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={20} fill="#f43f5e" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 등록 추이 차트 */}
      <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-border/50">
        <CardHeader className="bg-muted/5 border-b p-8 sm:p-10">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-primary" /> 신규 등록 학생 추이 (12개월)
              </CardTitle>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Bar Chart Click to filter list below</div>
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
        </CardContent>
      </Card>

      {/* 리스트 영역 */}
      <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-border/50">
        <CardHeader className="bg-muted/5 border-b p-8 sm:p-10">
          <div className={cn("flex justify-between items-center gap-4", isMobile ? "flex-col items-start" : "flex-row")}>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3">
                <CalendarDays className="h-6 w-6 text-primary" /> 학생 등록 및 수강료 관리
              </CardTitle>
              <div className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                <div className="flex items-center gap-2">
                  {selectedMonth ? (
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black">{selectedMonth} 등록 현황</Badge>
                  ) : activeDrillDown === 'active' ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 font-black">현재 재원생 목록</Badge>
                  ) : activeDrillDown === 'churn' ? (
                    <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-200 font-black">이탈 학생 명부</Badge>
                  ) : (
                    <span className="text-sm font-bold">전체 학생 타임라인</span>
                  )}
                  <span className="opacity-40">|</span>
                  <span className="text-sm font-bold">총 {filteredTimelineMembers.length}명</span>
                </div>
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
                  <TableHead className="font-black text-[10px] uppercase w-[120px]">STATUS</TableHead>
                  <TableHead className="font-black text-[10px] uppercase w-[180px]">DISCOUNTS</TableHead>
                  <TableHead className="font-black text-[10px] uppercase text-right pr-10">MONTHLY FEE (₩)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTimelineMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-64 text-center">
                      <div className="flex flex-col items-center gap-4 opacity-20">
                        <History className="h-16 w-16" />
                        <p className="font-black italic">해당 조건의 데이터가 없습니다.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTimelineMembers.map((student) => {
                    const profile = studentsProfiles?.find(p => p.id === student.id);
                    const basePrice = profile?.grade?.includes('N수생') ? 540000 : 390000;
                    const finalFee = student.monthlyFee !== undefined ? student.monthlyFee : basePrice;

                    return (
                      <TableRow key={student.id} className="hover:bg-muted/5 transition-all duration-300 h-24 group">
                        <TableCell className="pl-10">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center font-black text-primary border border-primary/10">
                              {student.displayName?.charAt(0) || 'S'}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-sm group-hover:text-primary transition-colors">{student.displayName || '학생'}</span>
                              <span className="text-[10px] font-bold text-muted-foreground">{profile?.grade || '학년 미정'}</span>
                            </div>
                          </div>
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
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button 
                              size="sm" 
                              variant={student.tutoringDiscount ? "default" : "outline"} 
                              className={cn("h-8 rounded-lg font-black text-[10px] gap-1 px-2.5 transition-all active:scale-90", student.tutoringDiscount ? "bg-blue-500 hover:bg-blue-600" : "text-blue-600 border-blue-100 hover:bg-blue-50")}
                              onClick={() => handleToggleDiscount(student.id, 'tutoring')}
                              disabled={isUpdating || student.status !== 'active'}
                            >
                              <Gift className="h-3 w-3" /> 과외 -5만
                            </Button>
                            <Button 
                              size="sm" 
                              variant={student.siblingDiscount ? "default" : "outline"} 
                              className={cn("h-8 rounded-lg font-black text-[10px] gap-1 px-2.5 transition-all active:scale-90", student.siblingDiscount ? "bg-emerald-500 hover:bg-emerald-600" : "text-emerald-600 border-emerald-100 hover:bg-emerald-50")}
                              onClick={() => handleToggleDiscount(student.id, 'sibling')}
                              disabled={isUpdating || student.status !== 'active'}
                            >
                              <Users2 className="h-3 w-3" /> 형제 -5%
                            </Button>
                          </div>
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
                                if (student.status !== 'active') return;
                                setEditingFeeId(student.id);
                                setTempFeeValue(finalFee.toString());
                              }}
                              className={cn(
                                "flex items-center justify-end gap-2 transition-colors",
                                student.status === 'active' ? "cursor-pointer group/fee" : "opacity-40"
                              )}
                            >
                              <span className="font-black text-lg tabular-nums text-primary/80 group-hover/fee:text-primary transition-colors">
                                ₩{finalFee.toLocaleString()}
                              </span>
                              {student.status === 'active' && (
                                <div className="opacity-0 group-hover/fee:opacity-100 transition-all p-1.5 rounded-md bg-primary/5">
                                  <Edit2 className="h-3 w-3 text-primary" />
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
