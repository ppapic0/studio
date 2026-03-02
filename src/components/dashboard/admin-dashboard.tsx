
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
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  HeartHandshake,
  Filter,
  Trophy,
  Target,
  Sparkles,
  FileText,
  History,
  CheckCircle2,
  Eye,
  PenTool
} from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, collectionGroup } from 'firebase/firestore';
import { AttendanceCurrent, DailyStudentStat, DailyReport, CenterMembership, StudyLogDay, InviteCode } from '@/lib/types';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function AdminDashboard({ isActive }: { isActive: boolean }) {
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [today, setToday] = useState<Date | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    setIsMounted(true);
    setToday(new Date());
    
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;
  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';
  const yesterdayKey = today ? format(subDays(today, 1), 'yyyy-MM-dd') : '';

  // 1. 센터 모든 재원생
  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'), 
      where('role', '==', 'student'), 
      where('status', '==', 'active')
    );
  }, [firestore, centerId]);
  const { data: activeMembers, isLoading: membersLoading } = useCollection<CenterMembership>(membersQuery, { enabled: isActive });

  // 2. 초대 코드 조회 (반 목록 추출용)
  const invitesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'inviteCodes'), where('centerId', '==', centerId));
  }, [firestore, centerId]);
  const { data: inviteCodes } = useCollection<InviteCode>(invitesQuery, { enabled: isActive });

  // 사용 가능한 반 목록 추출 (학생 멤버십 + 초대 코드 설정 조사)
  const availableClasses = useMemo(() => {
    const classes = new Set<string>();
    activeMembers?.forEach(m => { 
      if (m.className) classes.add(m.className); 
    });
    inviteCodes?.forEach(i => {
      if (i.targetClassName) classes.add(i.targetClassName);
    });
    return Array.from(classes).sort();
  }, [activeMembers, inviteCodes]);

  // 3. 실시간 좌석 데이터
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isActive });

  // 4. 실시간 학습 로그 집계
  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collectionGroup(firestore, 'days'),
      where('centerId', '==', centerId),
      where('dateKey', 'in', [todayKey, yesterdayKey])
    );
  }, [firestore, centerId, todayKey, yesterdayKey]);
  const { data: centerLogs, isLoading: logsLoading } = useCollection<StudyLogDay>(logsQuery, { enabled: isActive });

  // 5. 데일리 리포트 데이터
  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return query(collection(firestore, 'centers', centerId, 'dailyReports'), where('dateKey', '==', todayKey));
  }, [firestore, centerId, todayKey]);
  const { data: dailyReports } = useCollection<DailyReport>(reportsQuery, { enabled: isActive });

  // 6. 통계 보조 데이터
  const todayStatsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return collection(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students');
  }, [firestore, centerId, todayKey]);
  const { data: todayStats, isLoading: statsLoading } = useCollection<DailyStudentStat>(todayStatsQuery, { enabled: isActive });

  // --- 실시간 KPI 엔진 ---
  const metrics = useMemo(() => {
    if (!activeMembers || !attendanceList || !isMounted) return null;

    const filteredMembers = activeMembers.filter(m => selectedClass === 'all' || m.className === selectedClass);
    const targetMemberIds = new Set(filteredMembers.map(m => m.id));

    let totalTodayMins = 0;
    let totalYestMins = 0;
    const studentLiveMinutes: number[] = [];

    filteredMembers.forEach(member => {
      const todayLog = centerLogs?.find(l => l.studentId === member.id && l.dateKey === todayKey);
      let cumulative = todayLog?.totalMinutes || 0;

      const seat = attendanceList.find(a => a.studentId === member.id);
      if (seat?.status === 'studying' && seat.lastCheckInAt) {
        const liveSession = Math.floor((now - seat.lastCheckInAt.toMillis()) / 60000);
        if (liveSession > 0) cumulative += liveSession;
      }

      totalTodayMins += cumulative;
      studentLiveMinutes.push(cumulative);

      const yestLog = centerLogs?.find(l => l.studentId === member.id && l.dateKey === yesterdayKey);
      totalYestMins += yestLog?.totalMinutes || 0;
    });

    const studyTimeGrowth = totalYestMins > 0 ? ((totalTodayMins - totalYestMins) / totalYestMins) * 100 : 0;
    const checkedInCount = attendanceList.filter(a => a.studentId && targetMemberIds.has(a.studentId) && a.status === 'studying').length;
    
    const seatOccupancy = targetMemberIds.size > 0 ? Math.round((checkedInCount / targetMemberIds.size) * 100) : 0;

    const sortedMinutes = [...studentLiveMinutes].sort((a, b) => b - a);
    const top20Count = Math.max(1, Math.ceil(sortedMinutes.length * 0.2));
    const top20Avg = sortedMinutes.length > 0 ? sortedMinutes.slice(0, top20Count).reduce((acc, m) => acc + m, 0) / top20Count : 0;
    const bottom20Avg = sortedMinutes.length > 0 ? sortedMinutes.slice(-top20Count).reduce((acc, m) => acc + m, 0) / top20Count : 0;

    const filteredTodayStats = todayStats?.filter(s => targetMemberIds.has(s.studentId)) || [];
    const avgCompletion = filteredTodayStats.length > 0 
      ? Math.round(filteredTodayStats.reduce((acc, s) => acc + (s.todayPlanCompletionRate || 0), 0) / filteredTodayStats.length) 
      : 0;

    const highAchieverRate = filteredTodayStats.length > 0
      ? Math.round((filteredTodayStats.filter(s => (s.todayPlanCompletionRate || 0) >= 80).length / filteredTodayStats.length) * 100)
      : 0;

    const riskCount = filteredTodayStats.filter(s => s.riskDetected || (s.totalStudyMinutes < 180 && s.todayPlanCompletionRate < 50)).length;
    
    // 신뢰 지표 분석
    const filteredReports = dailyReports?.filter(r => targetMemberIds.has(r.studentId)) || [];
    const sentReports = filteredReports.filter(r => r.status === 'sent');
    
    const regularityRate = targetMemberIds.size > 0 ? Math.round((sentReports.length / targetMemberIds.size) * 100) : 0;
    const readRate = sentReports.length > 0 ? Math.round((sentReports.filter(r => r.viewedAt).length / sentReports.length) * 100) : 0;
    
    const commentWriteRate = sentReports.length > 0 
      ? Math.round((sentReports.filter(r => r.content.length > 200).length / sentReports.length) * 100)
      : 0;

    return {
      totalTodayMins,
      studyTimeGrowth,
      checkedInCount,
      seatOccupancy,
      totalStudents: targetMemberIds.size,
      top20Avg,
      bottom20Avg,
      avgCompletion,
      highAchieverRate,
      lowAchieverRate: 100 - highAchieverRate,
      riskCount,
      counselingNeedCount: filteredTodayStats.filter(s => (s.studyTimeGrowthRate || 0) <= -0.3).length,
      regularityRate,
      readRate,
      commentWriteRate
    };
  }, [activeMembers, attendanceList, centerLogs, todayStats, dailyReports, selectedClass, now, isMounted, todayKey, yesterdayKey]);

  if (!isActive) return null;
  const isEssentialLoading = membersLoading || !isMounted;

  if (isEssentialLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
        <p className="font-black text-muted-foreground/40 uppercase tracking-widest italic">Synchronizing Operational Command...</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-8 w-full max-w-[1400px] mx-auto", isMobile ? "px-1" : "px-4 py-6")}>
      <header className={cn("flex justify-between items-end", isMobile ? "flex-col items-start gap-6" : "")}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary/60">
            <Sparkles className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">Management Intelligence</span>
          </div>
          <h1 className={cn("font-black tracking-tighter text-primary leading-none", isMobile ? "text-3xl" : "text-5xl")}>
            운영 핵심 지표 (KPI)
          </h1>
          <p className="text-sm font-bold text-muted-foreground/70 mt-2">센터의 실시간 활성도와 학습 퀄리티를 통합 관리합니다.</p>
        </div>

        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md p-2 rounded-[1.5rem] border shadow-xl ring-1 ring-black/5">
          <div className="flex items-center gap-2 px-3">
            <Filter className="h-4 w-4 text-primary opacity-40" />
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">분석 대상</span>
          </div>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-[160px] h-11 rounded-xl border-none bg-primary text-white font-black text-xs shadow-lg focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-2xl">
              <SelectItem value="all" className="font-black">센터 전체</SelectItem>
              {availableClasses.map(c => (
                <SelectItem key={c} value={c} className="font-black">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {metrics ? (
        <>
          <section className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-black tracking-tighter">실시간 현황 분석</h2>
              <Badge className="bg-blue-600 text-white border-none font-black text-[10px] rounded-full px-2.5">LIVE TRACKING</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="rounded-[2.5rem] border-none shadow-2xl bg-primary text-primary-foreground p-10 overflow-hidden relative group">
                <div className="absolute -right-4 -top-4 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-1000">
                  <Flame className="h-48 w-48" />
                </div>
                <div className="space-y-1 relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">오늘의 트랙 총량 (Accrued)</p>
                  <div className="flex items-baseline gap-1">
                    <h3 className="text-6xl font-black tracking-tighter">{(metrics.totalTodayMins / 60).toFixed(1)}<span className="text-2xl opacity-40 ml-1">h</span></h3>
                    <div className={cn("flex items-center text-xs font-bold px-3 py-1 rounded-full bg-white/10 shadow-inner", metrics.studyTimeGrowth >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {metrics.studyTimeGrowth >= 0 ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                      {Math.abs(metrics.studyTimeGrowth).toFixed(1)}%
                    </div>
                  </div>
                  <div className="pt-8 space-y-3">
                    <div className="flex justify-between text-[10px] font-black opacity-60 uppercase tracking-widest">
                      <span>일일 활성 목표 (Avg 6h)</span>
                      <span>{Math.min(100, Math.round((metrics.totalTodayMins / (metrics.totalStudents * 360 || 1)) * 100))}%</span>
                    </div>
                    <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-white transition-all duration-1000" style={{ width: `${Math.min(100, (metrics.totalTodayMins / (metrics.totalStudents * 360 || 1)) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-10 group hover:shadow-2xl transition-all ring-1 ring-black/[0.03]">
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">현재 착석 인원</p>
                    <h3 className="text-5xl font-black tracking-tighter text-primary">{metrics.checkedInCount}<span className="text-2xl opacity-40 ml-1">명</span></h3>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-[1.5rem] group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-sm"><Users className="h-8 w-8 text-blue-600 group-hover:text-white" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-dashed">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-muted-foreground uppercase opacity-60">재원생(대상)</p>
                    <p className="text-xl font-black">{metrics.totalStudents}명</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[9px] font-black text-muted-foreground uppercase opacity-60">실시간 점유율</p>
                    <p className="text-xl font-black text-blue-600">{metrics.seatOccupancy}%</p>
                  </div>
                </div>
              </Card>

              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-10 group hover:shadow-2xl transition-all ring-1 ring-black/[0.03]">
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">인당 평균 시간</p>
                    <h3 className="text-5xl font-black tracking-tighter text-primary">{(metrics.totalTodayMins / (metrics.totalStudents || 1) / 60).toFixed(1)}<span className="text-2xl opacity-40 ml-1">h</span></h3>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-[1.5rem] group-hover:bg-amber-500 group-hover:text-white transition-all duration-500 shadow-sm"><Clock className="h-8 w-8 text-amber-600 group-hover:text-white" /></div>
                </div>
                <div className="space-y-4 mt-8 pt-8 border-t border-dashed">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-emerald-600">상위 20% 리듬</span></div>
                    <span className="font-black text-base">{(metrics.top20Avg / 60).toFixed(1)}h</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-rose-500" /><span className="text-rose-600">하위 20% 리듬</span></div>
                    <span className="font-black text-base">{(metrics.bottom20Avg / 60).toFixed(1)}h</span>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-black/[0.03]">
              <CardHeader className="bg-muted/5 border-b p-10">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3">
                      <TrendingUp className="h-6 w-6 text-emerald-600" /> 학습 퀄리티 지표
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Plan Performance & Growth Trend</CardDescription>
                  </div>
                  <Badge variant="outline" className="font-black text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50/50">DAILY VIEW</Badge>
                </div>
              </CardHeader>
              <CardContent className={cn("space-y-10", isMobile ? "p-6" : "p-10")}>
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-[#fafafa] p-6 rounded-3xl border shadow-inner text-center space-y-1">
                    <p className="text-[10px] font-black text-muted-foreground uppercase">평균 완수율</p>
                    <div className="text-3xl font-black text-primary">{metrics.avgCompletion}%</div>
                  </div>
                  <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 text-center space-y-1">
                    <p className="text-[10px] font-black text-emerald-600 uppercase">최상위 그룹</p>
                    <div className="text-3xl font-black text-emerald-600">{metrics.highAchieverRate}%</div>
                  </div>
                  <div className="bg-rose-50/50 p-6 rounded-3xl border border-rose-100 text-center space-y-1">
                    <p className="text-[10px] font-black text-rose-600 uppercase">집중 필요군</p>
                    <div className="text-3xl font-black text-rose-600">{metrics.lowAchieverRate}%</div>
                  </div>
                </div>
                
                <div className="p-8 rounded-[2rem] bg-emerald-50/30 border border-emerald-100 space-y-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-emerald-600" />
                    <h4 className="text-[11px] font-black text-emerald-700 uppercase tracking-widest">학습 성취 요약</h4>
                  </div>
                  <p className="text-sm font-bold text-emerald-900/70 leading-relaxed">
                    {selectedClass === 'all' ? '센터' : selectedClass}의 현재 완수율은 **{metrics.avgCompletion}%** 입니다. 상위권 그룹은 평균보다 높은 몰입 밀도를 유지하고 있습니다.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[3rem] border-none shadow-2xl bg-white overflow-hidden ring-1 ring-black/[0.03]">
              <CardHeader className="bg-rose-50/30 border-b p-10">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-black tracking-tighter flex items-center gap-3">
                      <ShieldAlert className="h-6 w-6 text-rose-600" /> 이상 징후 조기 탐지
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-rose-600/60">Risk & Intervention Management</CardDescription>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-rose-500" />
                </div>
              </CardHeader>
              <CardContent className={cn("space-y-10", isMobile ? "p-6" : "p-10")}>
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-8 rounded-[2.5rem] bg-rose-50/50 border-2 border-rose-100 flex flex-col items-center text-center gap-3 shadow-xl shadow-rose-500/5 group hover:bg-rose-500 hover:border-rose-500 transition-all duration-500">
                    <AlertTriangle className="h-12 w-12 text-rose-600 group-hover:text-white transition-colors" />
                    <div>
                      <p className="text-5xl font-black text-rose-700 group-hover:text-white transition-colors">{metrics.riskCount}</p>
                      <p className="text-[10px] font-black text-rose-600/60 uppercase group-hover:text-white/60 transition-colors tracking-widest mt-1">학습 위험군</p>
                    </div>
                  </div>
                  <div className="p-8 rounded-[2.5rem] bg-blue-50/50 border-2 border-blue-100 flex flex-col items-center text-center gap-3 shadow-xl shadow-blue-500/5 group hover:bg-blue-600 hover:border-blue-600 transition-all duration-500">
                    <MessageSquare className="h-12 w-12 text-blue-600 group-hover:text-white transition-colors" />
                    <div>
                      <p className="text-5xl font-black text-blue-700 group-hover:text-white transition-colors">{metrics.counselingNeedCount}</p>
                      <p className="text-[10px] font-black text-blue-600/60 uppercase group-hover:text-white/60 transition-colors tracking-widest mt-1">상담 필요군</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-8 rounded-[2rem] bg-[#fafafa] border-2 border-dashed border-muted-foreground/10 space-y-5">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500 fill-current" />
                    <h5 className="text-[11px] font-black text-primary uppercase tracking-widest">자동 개입 알고리즘 작동 중</h5>
                  </div>
                  <ul className="space-y-3">
                    {[
                      { text: '최근 3일 연속 목표 시간 미달', color: 'bg-rose-400' },
                      { text: '주간 계획 완수율 40% 이하 지속', color: 'bg-amber-400' },
                      { text: '직전 주 대비 학습량 30% 이상 급감', color: 'bg-blue-400' }
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-xs font-bold text-muted-foreground/80">
                        <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", item.color)} />
                        {item.text}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          <section className="pb-10 px-1">
            <Card className="rounded-[3rem] border-none shadow-2xl bg-white p-10 overflow-hidden relative group ring-1 ring-black/[0.03]">
              <div className="absolute -right-10 -bottom-10 opacity-5 rotate-12 transition-transform duration-1000 group-hover:scale-110">
                <HeartHandshake className="h-64 w-64" />
              </div>
              <div className="space-y-10 relative z-10">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-black tracking-tighter">부모님 신뢰 및 관리 지표</CardTitle>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">Parental Trust & Service Quality Index</p>
                  </div>
                  <Badge className="bg-primary text-white border-none font-black text-[10px] px-3 py-1 shadow-lg">TRUST KPI</Badge>
                </div>
                
                <div className="grid gap-10 md:grid-cols-3">
                  {/* 발송 정기성 */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="grid gap-1">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-blue-500" /> 리포트 발송 정기성</span>
                        <div className="text-5xl font-black text-blue-600 tabular-nums">{metrics.regularityRate}%</div>
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-blue-50 rounded-full overflow-hidden shadow-inner border border-blue-100/50">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${metrics.regularityRate}%` }} />
                    </div>
                    <p className="text-[9px] font-bold text-muted-foreground/60">대상 인원 대비 발송된 리포트 비율</p>
                  </div>

                  {/* 코멘트 작성률 */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="grid gap-1">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><PenTool className="h-3 w-3 text-emerald-500" /> 선생님 코멘트 작성률</span>
                        <div className="text-5xl font-black text-emerald-600 tabular-nums">{metrics.commentWriteRate}%</div>
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-emerald-50 rounded-full overflow-hidden shadow-inner border border-emerald-100/50">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${metrics.commentWriteRate}%` }} />
                    </div>
                    <p className="text-[9px] font-bold text-muted-foreground/60">선생님의 고유 의견이 포함된 정밀 분석 비중</p>
                  </div>

                  {/* 학부모 열람률 */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="grid gap-1">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><Eye className="h-3 w-3 text-amber-500" /> 학부모 리포트 열람률</span>
                        <div className="text-5xl font-black text-amber-600 tabular-nums">{metrics.readRate}%</div>
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-amber-50 rounded-full overflow-hidden shadow-inner border border-amber-100/50">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-1000" style={{ width: `${metrics.readRate}%` }} />
                    </div>
                    <p className="text-[9px] font-bold text-muted-foreground/60">발송된 리포트 중 실제 확인된 비율</p>
                  </div>
                </div>

                <div className="p-6 rounded-[1.5rem] bg-muted/20 border-2 border-dashed flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white rounded-2xl shadow-sm"><Target className="h-6 w-6 text-primary" /></div>
                    <p className="text-sm font-bold text-foreground/70 leading-relaxed max-w-md">"학부모 신뢰도는 리포트의 **발송 정기성**과 **선생님의 진심 어린 코멘트**에서 결정됩니다."</p>
                  </div>
                  <Button asChild variant="outline" className="rounded-xl font-black text-xs gap-2 bg-white border-2 shadow-sm hover:bg-primary hover:text-white transition-all">
                    <Link href="/dashboard/reports">리포트 센터 관리 <ChevronRight className="h-4 w-4" /></Link>
                  </Button>
                </div>
              </div>
            </Card>
          </section>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-20">
          <Activity className="h-16 w-16 animate-pulse" />
          <p className="font-black text-xl tracking-tighter">분석 데이터를 집계하고 있습니다...</p>
        </div>
      )}
    </div>
  );
}
