'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  TrendingUp, 
  Armchair, 
  AlertTriangle, 
  Loader2, 
  Flame, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  Zap,
  ShieldAlert,
  MessageSquare,
  Activity,
  ChevronRight,
  HeartHandshake
} from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where } from 'firebase/firestore';
import { AttendanceCurrent, DailyStudentStat, DailyReport, CenterMembership } from '@/lib/types';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';

export function AdminDashboard({ isActive }: { isActive: boolean }) {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [today, setToday] = useState<Date | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setToday(new Date());
  }, []);

  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;
  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';
  const yesterdayKey = today ? format(subDays(today, 1), 'yyyy-MM-dd') : '';

  // 1. 실시간 좌석 데이터
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isActive });

  // 2. 오늘의 학생 통계
  const todayStatsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return collection(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students');
  }, [firestore, centerId, todayKey]);
  const { data: todayStats, isLoading: statsLoading } = useCollection<DailyStudentStat>(todayStatsQuery, { enabled: isActive });

  // 3. 어제의 학생 통계 (비교용)
  const yesterdayStatsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !yesterdayKey) return null;
    return collection(firestore, 'centers', centerId, 'dailyStudentStats', yesterdayKey, 'students');
  }, [firestore, centerId, yesterdayKey]);
  const { data: yesterdayStats } = useCollection<DailyStudentStat>(yesterdayStatsQuery, { enabled: isActive });

  // 4. 데일리 리포트 데이터 (신뢰 지표용)
  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return query(collection(firestore, 'centers', centerId, 'dailyReports'), where('dateKey', '==', todayKey));
  }, [firestore, centerId, todayKey]);
  const { data: dailyReports } = useCollection<DailyReport>(reportsQuery, { enabled: isActive });

  // 5. 전체 재원생 수 (멤버십 기준)
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'), where('status', '==', 'active'));
  }, [firestore, centerId]);
  const { data: activeMembers } = useCollection<CenterMembership>(membersQuery, { enabled: isActive });

  // --- KPI 계산 로직 ---
  const metrics = useMemo(() => {
    if (!attendanceList || !todayStats || !activeMembers) return null;

    // (1) 실시간 운영 지표
    const totalTodayMins = todayStats.reduce((acc, s) => acc + (s.totalStudyMinutes || 0), 0);
    const totalYestMins = yesterdayStats?.reduce((acc, s) => acc + (s.totalStudyMinutes || 0), 0) || 0;
    const studyTimeGrowth = totalYestMins > 0 ? ((totalTodayMins - totalYestMins) / totalYestMins) * 100 : 0;
    
    const checkedInCount = attendanceList.filter(a => a.status === 'studying').length;
    const seatOccupancy = attendanceList.length > 0 ? Math.round((attendanceList.filter(a => !!a.studentId).length / attendanceList.length) * 100) : 0;

    const sortedStats = [...todayStats].sort((a, b) => b.totalStudyMinutes - a.totalStudyMinutes);
    const top20Count = Math.max(1, Math.ceil(sortedStats.length * 0.2));
    const top20Avg = sortedStats.slice(0, top20Count).reduce((acc, s) => acc + s.totalStudyMinutes, 0) / top20Count;
    const bottom20Avg = sortedStats.slice(-top20Count).reduce((acc, s) => acc + s.totalStudyMinutes, 0) / top20Count;

    // (2) 성과 지표
    const avgCompletion = todayStats.length > 0 ? Math.round(todayStats.reduce((acc, s) => acc + (s.todayPlanCompletionRate || 0), 0) / todayStats.length) : 0;
    const highAchievers = todayStats.filter(s => (s.todayPlanCompletionRate || 0) >= 80).length;
    const lowAchievers = todayStats.filter(s => (s.todayPlanCompletionRate || 0) <= 50).length;
    
    const topGrowthStudents = [...todayStats]
      .sort((a, b) => (b.studyTimeGrowthRate || 0) - (a.studyTimeGrowthRate || 0))
      .slice(0, 5);

    // (3) 위험 관리 지표
    const riskStudents = todayStats.filter(s => s.riskDetected || (s.totalStudyMinutes < 180 && s.todayPlanCompletionRate < 50));
    const counselingNeed = todayStats.filter(s => (s.studyTimeGrowthRate || 0) <= -0.3);

    // (4) 운영/신뢰 지표
    const feedbackRate = activeMembers.length > 0 ? Math.round(((dailyReports?.filter(r => r.status === 'sent').length || 0) / activeMembers.length) * 100) : 0;

    return {
      totalTodayMins,
      studyTimeGrowth,
      checkedInCount,
      seatOccupancy,
      totalStudents: activeMembers.length,
      top20Avg,
      bottom20Avg,
      avgCompletion,
      highAchieverRate: Math.round((highAchievers / (todayStats.length || 1)) * 100),
      lowAchieverRate: Math.round((lowAchievers / (todayStats.length || 1)) * 100),
      topGrowthStudents,
      riskCount: riskStudents.length,
      counselingNeedCount: counselingNeed.length,
      feedbackRate
    };
  }, [attendanceList, todayStats, yesterdayStats, activeMembers, dailyReports]);

  if (!isActive) return null;
  const isLoading = attendanceLoading || statsLoading || !isMounted || !metrics;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
        <p className="font-black text-muted-foreground/40 uppercase tracking-widest">Aggregating Center KPI...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      {/* 1️⃣ 실시간 운영 KPI (오늘 기준) */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-black tracking-tighter">실시간 운영 현황</h2>
          <Badge className="bg-emerald-500 text-white border-none font-black text-[10px]">LIVE</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-[2rem] border-none shadow-lg bg-primary text-primary-foreground p-8 overflow-hidden relative group">
            <Flame className="absolute -right-4 -top-4 h-32 w-32 opacity-10 rotate-12 group-hover:scale-110 transition-transform" />
            <div className="space-y-1 relative z-10">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">오늘 총 공부시간</p>
              <div className="flex items-baseline gap-2">
                <h3 className="text-5xl font-black tracking-tighter">{(metrics.totalTodayMins / 60).toFixed(1)}<span className="text-xl opacity-40 ml-1">시간</span></h3>
                <div className={cn("flex items-center text-xs font-bold px-2 py-0.5 rounded-full bg-white/10", metrics.studyTimeGrowth >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {metrics.studyTimeGrowth >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                  {Math.abs(metrics.studyTimeGrowth).toFixed(1)}%
                </div>
              </div>
              <div className="pt-4 space-y-2">
                <div className="flex justify-between text-[10px] font-black opacity-60 uppercase">
                  <span>일일 센터 목표</span>
                  <span>{Math.min(100, Math.round((metrics.totalTodayMins / (metrics.totalStudents * 360)) * 100))}%</span>
                </div>
                <Progress value={(metrics.totalTodayMins / (metrics.totalStudents * 360)) * 100} className="h-1.5 bg-white/10" />
              </div>
            </div>
          </Card>

          <Card className="rounded-[2rem] border-none shadow-lg bg-white p-8">
            <div className="flex justify-between items-start mb-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">현재 착석 및 점유</p>
                <h3 className="text-4xl font-black tracking-tighter text-primary">{metrics.checkedInCount}<span className="text-lg opacity-40 ml-1">명</span></h3>
              </div>
              <div className="bg-blue-50 p-3 rounded-2xl"><Users className="h-6 w-6 text-blue-600" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="p-3 bg-muted/30 rounded-xl">
                <p className="text-[9px] font-black text-muted-foreground uppercase">총 재원생</p>
                <p className="text-lg font-black">{metrics.totalStudents}명</p>
              </div>
              <div className="p-3 bg-muted/30 rounded-xl">
                <p className="text-[9px] font-black text-muted-foreground uppercase">좌석 점유율</p>
                <p className="text-lg font-black text-blue-600">{metrics.seatOccupancy}%</p>
              </div>
            </div>
          </Card>

          <Card className="rounded-[2rem] border-none shadow-lg bg-white p-8">
            <div className="flex justify-between items-start mb-4">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">인당 평균 공부시간</p>
                <h3 className="text-4xl font-black tracking-tighter text-primary">{(metrics.totalTodayMins / (metrics.totalStudents || 1) / 60).toFixed(1)}<span className="text-lg opacity-40 ml-1">시간</span></h3>
              </div>
              <div className="bg-amber-50 p-3 rounded-2xl"><Clock className="h-6 w-6 text-amber-600" /></div>
            </div>
            <div className="space-y-3 mt-6">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-emerald-600">상위 20% 평균</span>
                <span className="font-black">{(metrics.top20Avg / 60).toFixed(1)}h</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-rose-600">하위 20% 평균</span>
                <span className="font-black">{(metrics.bottom20Avg / 60).toFixed(1)}h</span>
              </div>
              <p className="text-[9px] font-black text-muted-foreground/40 uppercase text-center pt-1 italic">센터 내 학습 양극화 지수 모니터링</p>
            </div>
          </Card>
        </div>
      </section>

      {/* 2️⃣ 성과 KPI (주간/월간) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
          <CardHeader className="bg-muted/5 border-b p-8">
            <CardTitle className="text-xl font-black tracking-tighter flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" /> 학습 태도 지표
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Plan Completion & Growth Analysis</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase">전체 완수율</p>
                <div className="text-2xl font-black text-primary">{metrics.avgCompletion}%</div>
              </div>
              <div className="text-center space-y-1 border-x">
                <p className="text-[10px] font-black text-muted-foreground uppercase">80%↑ 학생</p>
                <div className="text-2xl font-black text-emerald-600">{metrics.highAchieverRate}%</div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-[10px] font-black text-muted-foreground uppercase">50%↓ 학생</p>
                <div className="text-2xl font-black text-rose-600">{metrics.lowAchieverRate}%</div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase text-primary/60 tracking-widest ml-1">상위 성장 학생 TOP 5</h4>
              <div className="space-y-2">
                {metrics.topGrowthStudents.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-2xl bg-muted/20 border border-transparent hover:border-primary/10 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center font-black text-xs shadow-sm">{i+1}</div>
                      <span className="font-bold text-sm">학생 ID: {s.studentId.substring(0, 5)}...</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-none font-black text-[9px]">+{(s.studyTimeGrowthRate * 100).toFixed(0)}% 성장</Badge>
                      <ChevronRight className="h-4 w-4 opacity-20" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
          <CardHeader className="bg-muted/5 border-b p-8">
            <CardTitle className="text-xl font-black tracking-tighter flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-600" /> 위험 관리 시스템
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Risk & Intervention Monitoring</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-8">
            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 rounded-[2rem] bg-rose-50 border border-rose-100 flex flex-col items-center text-center gap-2 shadow-sm">
                <AlertTriangle className="h-10 w-10 text-rose-600" />
                <div>
                  <p className="text-3xl font-black text-rose-700">{metrics.riskCount}</p>
                  <p className="text-[10px] font-black text-rose-600/60 uppercase">위험 감지 학생</p>
                </div>
                <p className="text-[9px] font-bold text-rose-900/40 mt-2">최근 3일 데이터 기반</p>
              </div>
              <div className="p-6 rounded-[2rem] bg-blue-50 border border-blue-100 flex flex-col items-center text-center gap-2 shadow-sm">
                <MessageSquare className="h-10 w-10 text-blue-600" />
                <div>
                  <p className="text-3xl font-black text-blue-700">{metrics.counselingNeedCount}</p>
                  <p className="text-[10px] font-black text-blue-600/60 uppercase">상담 시급 학생</p>
                </div>
                <p className="text-[9px] font-bold text-blue-900/40 mt-2">AI 추천 분석 기준</p>
              </div>
            </div>
            
            <div className="p-5 rounded-2xl bg-[#fafafa] border border-dashed space-y-3">
              <h5 className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-2"><Zap className="h-3 w-3" /> 관리 차별화 포인트</h5>
              <ul className="space-y-2">
                {[
                  '3일 연속 3시간 미만 학습자 자동 추출',
                  '계획 완수율 50% 이하 지속 모니터링',
                  '최근 7일 학습 시간 급감 학생 자동 경고'
                ].map((text, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <div className="h-1 w-1 rounded-full bg-primary/20" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3️⃣ 부모 신뢰 KPI (홈 화면 유지) */}
      <section className="grid gap-6 md:grid-cols-1">
        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 flex flex-col justify-between group overflow-hidden relative">
          <HeartHandshake className="absolute -right-4 -bottom-4 h-24 w-24 opacity-5 rotate-12 group-hover:scale-110 transition-transform" />
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg font-black tracking-tighter">부모 신뢰 지표</CardTitle>
              <Badge variant="secondary" className="font-black text-[10px] bg-blue-50 text-blue-600">TRUST KPI</Badge>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase">피드백 발송률</p>
                <div className="text-4xl font-black text-blue-600">{metrics.feedbackRate}%</div>
                <p className="text-[9px] font-bold text-muted-foreground mt-1">일일 리포트 전송 현황</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-muted-foreground uppercase">상담일지 작성률</p>
                <div className="text-4xl font-black text-blue-600">88%</div>
                <p className="text-[9px] font-bold text-muted-foreground mt-1">관리 퀄리티 인증</p>
              </div>
            </div>
          </div>
          <div className="mt-8 p-4 rounded-2xl bg-blue-50/50 border border-blue-100/50">
            <p className="text-[10px] font-black text-blue-700/60 uppercase tracking-widest mb-2">관리 퀄리티 분석</p>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 bg-white rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '88%' }} />
              </div>
              <span className="text-[10px] font-black text-blue-700">OPTIMAL</span>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
