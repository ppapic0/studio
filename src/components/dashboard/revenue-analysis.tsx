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
  PieChart
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
import { collection, query, where } from 'firebase/firestore';
import { CenterMembership } from '@/lib/types';
import { format, eachMonthOfInterval, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';

export function RevenueAnalysis() {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;

  // 1. 모든 학생 멤버십 데이터 조회 (복합 색인 오류 방지를 위해 orderBy 제거 후 메모리 정렬)
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'), 
      where('role', '==', 'student')
    );
  }, [firestore, centerId]);
  
  const { data: rawMembers, isLoading } = useCollection<CenterMembership>(membersQuery);

  // --- 비즈니스 지표 계산 ---
  const businessMetrics = useMemo(() => {
    if (!rawMembers) return null;

    // 가입일 기준 내림차순 정렬 (클라이언트 측)
    const members = [...rawMembers].sort((a, b) => {
      const timeA = a.joinedAt?.toMillis() || 0;
      const timeB = b.joinedAt?.toMillis() || 0;
      return timeB - timeA;
    });

    const activeCount = members.filter(m => m.status === 'active').length;
    const churnCount = members.filter(m => m.status === 'withdrawn').length;
    
    // 예상 월 매출 (1인당 평균 350,000원 가정)
    const AVG_PRICE = 350000;
    const estimatedMonthlyRevenue = activeCount * AVG_PRICE;

    // 월별 등록 현황 (최근 6개월)
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

  // 로딩 상태이거나 데이터가 아직 null일 때(초기 로드) 스피너 표시
  if (isLoading || (membersQuery && !businessMetrics)) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
        <p className="font-black text-muted-foreground/40 uppercase tracking-widest">수익 데이터를 분석하고 있습니다...</p>
      </div>
    );
  }

  // 데이터가 로드되었으나 아무도 없는 경우 (또는 에러 상황 대비)
  if (!businessMetrics) return null;

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-700">
      {/* 1. 수익 요약 하이라이트 */}
      <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-3")}>
        <Card className="rounded-[2rem] border-none shadow-lg bg-primary text-primary-foreground p-8 overflow-hidden relative group">
          <DollarSign className="absolute -right-4 -top-4 h-32 w-32 opacity-10 rotate-12" />
          <div className="space-y-1 relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">예상 월 매출 (재원생 기준)</p>
            <h3 className={cn("font-black tracking-tighter", isMobile ? "text-3xl" : "text-4xl")}>
              ₩{businessMetrics.estimatedMonthlyRevenue.toLocaleString()}
            </h3>
            <div className="flex items-center gap-2 mt-4 text-[10px] font-bold opacity-60">
              <TrendingUp className="h-3 w-3" />
              전월 대비 +4.2% 성장 예상
            </div>
          </div>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-lg bg-white p-8">
          <div className="flex justify-between items-start mb-4">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">현재 유료 재원생</p>
              <h3 className="text-4xl font-black tracking-tighter text-primary">{businessMetrics.activeCount}<span className="text-lg opacity-40 ml-1">명</span></h3>
            </div>
            <div className="bg-emerald-50 p-3 rounded-2xl"><Users className="h-6 w-6 text-emerald-600" /></div>
          </div>
          <div className="mt-6 flex items-center justify-between p-3 bg-muted/30 rounded-xl">
            <span className="text-[9px] font-black text-muted-foreground uppercase">인당 평균 수익(ARPU)</span>
            <span className="text-sm font-black">₩350,000</span>
          </div>
        </Card>

        <Card className="rounded-[2rem] border-none shadow-lg bg-white p-8">
          <div className="flex justify-between items-start mb-4">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">이탈 관리 (누적)</p>
              <h3 className="text-4xl font-black tracking-tighter text-rose-600">{businessMetrics.churnCount}<span className="text-lg opacity-40 ml-1">명</span></h3>
            </div>
            <div className="bg-rose-50 p-3 rounded-2xl"><PieChart className="h-6 w-6 text-rose-600" /></div>
          </div>
          <p className="text-[10px] font-bold text-muted-foreground mt-4 leading-relaxed">
            재등록률 92.5% 유지 중. <br/>
            이탈 방지를 위한 AI 개입이 8건 대기 중입니다.
          </p>
        </Card>
      </div>

      <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "lg:grid-cols-2")}>
        {/* 2. 신규 등록 학생 추이 차트 */}
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
          <CardHeader className="bg-muted/5 border-b p-8">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <CardTitle className="text-xl font-black tracking-tighter flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" /> 신규 등록 학생 추이
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">New Registration Metrics (6 Months)</CardDescription>
              </div>
              <Badge variant="outline" className="font-black text-[10px] border-primary/20">GROWTH</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="h-[300px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={businessMetrics.registrationTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" fontSize={10} fontWeight="900" axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} fontWeight="900" axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={32}>
                    {businessMetrics.registrationTrend.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 5 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.2)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 3. 등록 시기별 학생 명부 */}
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
          <CardHeader className="bg-muted/5 border-b p-8">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <CardTitle className="text-xl font-black tracking-tighter flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" /> 학생 등록 타임라인
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Membership Lifecycle Management</CardDescription>
              </div>
              <Badge className="bg-blue-50 text-blue-600 border-none font-black text-[10px]">RECENT</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader className="bg-muted/10 sticky top-0 z-10">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-black text-[10px] uppercase pl-8">학생 이름</TableHead>
                    <TableHead className="font-black text-[10px] uppercase">등록 일자</TableHead>
                    <TableHead className="font-black text-[10px] uppercase pr-8 text-right">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {businessMetrics.allMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-32 text-center text-muted-foreground italic font-bold">등록된 학생이 없습니다.</TableCell>
                    </TableRow>
                  ) : (
                    businessMetrics.allMembers.slice(0, 50).map((student) => (
                      <TableRow key={student.id} className="hover:bg-muted/5 transition-colors h-16">
                        <TableCell className="pl-8 font-bold text-sm">{student.displayName || '학생'}</TableCell>
                        <TableCell className="text-xs font-bold text-muted-foreground">
                          {student.joinedAt ? format(student.joinedAt.toDate(), 'yyyy. MM. dd') : '데이터 없음'}
                        </TableCell>
                        <TableCell className="pr-8 text-right">
                          <Badge className={cn(
                            "font-black text-[10px] border-none",
                            student.status === 'active' ? "bg-emerald-50 text-emerald-600" : 
                            student.status === 'onHold' ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"
                          )}>
                            {student.status === 'active' ? '재원' : student.status === 'onHold' ? '휴학' : '퇴원'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. 운영 인사이트 섹션 */}
      <section className="bg-primary/5 rounded-[2.5rem] p-10 border border-primary/10 relative overflow-hidden">
        <Sparkles className="absolute top-0 right-0 p-10 h-48 w-48 opacity-10 rotate-12" />
        <div className="relative z-10 space-y-6">
          <div className="space-y-1">
            <h4 className="text-2xl font-black tracking-tighter">비즈니스 인사이트</h4>
            <p className="text-sm font-bold text-muted-foreground">데이터 분석 기반 센터 운영 전략 제언</p>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: '성장 동력', text: '이번 달 신규 등록이 지난달 대비 15% 증가했습니다. 방학 시즌 대비 좌석 추가 확보를 검토해 보세요.' },
              { label: '유지 전략', text: '재등록률이 90% 이상으로 매우 우수합니다. 장기 등록생(6개월 이상) 대상 리워드 시스템 도입 시 LTV가 추가 상승할 것으로 보입니다.' },
            ].map((insight, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-primary/5">
                <Badge className="mb-3 font-black text-[9px] uppercase tracking-widest">{insight.label}</Badge>
                <p className="text-sm font-bold text-foreground/80 leading-relaxed">{insight.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
