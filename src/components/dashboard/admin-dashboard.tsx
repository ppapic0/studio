
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
import { collection, query, where, collectionGroup, Timestamp, doc } from 'firebase/firestore';
import { AttendanceCurrent, DailyStudentStat, DailyReport, CenterMembership, StudyLogDay, InviteCode, GrowthProgress, ParentActivityEvent } from '@/lib/types';
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

  // 2. 벌점 데이터 소스
  const progressQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'growthProgress');
  }, [firestore, centerId]);
  const { data: progressList } = useCollection<GrowthProgress>(progressQuery, { enabled: isActive });

  // 3. 실시간 좌석 데이터
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isActive });

  // 4. 실시간 학습 로그 집계
  const todayStatsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return collection(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students');
  }, [firestore, centerId, todayKey]);
  const { data: todayStats, isLoading: statsLoading } = useCollection<DailyStudentStat>(todayStatsQuery, { enabled: isActive });

  // 5. 데일리 리포트 데이터
  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return query(collection(firestore, 'centers', centerId, 'dailyReports'), where('dateKey', '==', todayKey));
  }, [firestore, centerId, todayKey]);
  const { data: dailyReports } = useCollection<DailyReport>(reportsQuery, { enabled: isActive });
  const parentActivityQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'parentActivityEvents');
  }, [firestore, centerId]);
  const { data: parentActivityEvents } = useCollection<ParentActivityEvent>(parentActivityQuery, { enabled: isActive });

  const parentCommunicationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'parentCommunications');
  }, [firestore, centerId]);
  const { data: parentCommunications } = useCollection<any>(parentCommunicationsQuery, { enabled: isActive });

  const availableClasses = useMemo(() => {
    if (!activeMembers) return [];
    const classes = new Set<string>();
    activeMembers.forEach(m => { if (m.className) classes.add(m.className); });
    return Array.from(classes).sort();
  }, [activeMembers]);

  // --- 실시간 KPI 엔진 ---
  const metrics = useMemo(() => {
    if (!activeMembers || !attendanceList || !isMounted || !progressList) return null;

    const filteredMembers = activeMembers.filter(m => selectedClass === 'all' || m.className === selectedClass);
    const targetMemberIds = new Set(filteredMembers.map(m => m.id));

    let totalTodayMins = 0;
    const studentLiveMinutes: number[] = [];
    let highRiskCount = 0;

    filteredMembers.forEach(member => {
      const studentStat = todayStats?.find(s => s.studentId === member.id);
      const studentProgress = progressList.find(p => p.id === member.id);
      let cumulative = studentStat?.totalStudyMinutes || 0;

      const seat = attendanceList.find(a => a.studentId === member.id);
      if (seat?.status === 'studying' && seat.lastCheckInAt) {
        const liveSession = Math.floor((now - seat.lastCheckInAt.toMillis()) / 60000);
        if (liveSession > 0) cumulative += liveSession;
      }

      totalTodayMins += cumulative;
      studentLiveMinutes.push(cumulative);

      // 리스크 점수 계산 (RiskIntelligence와 동일 로직 적용)
      let riskScore = 0;
      if (studentStat) {
        if (studentStat.studyTimeGrowthRate <= -0.2) riskScore += 30;
        else if (studentStat.studyTimeGrowthRate <= -0.1) riskScore += 15;
        if (studentStat.todayPlanCompletionRate < 50) riskScore += 20;
      }
      if ((studentProgress?.penaltyPoints || 0) >= 10) riskScore += 40;

      if (riskScore >= 70) highRiskCount++;
    });

    const checkedInCount = attendanceList.filter(a => a.studentId && targetMemberIds.has(a.studentId) && a.status === 'studying').length;
    const seatOccupancy = targetMemberIds.size > 0 ? Math.round((checkedInCount / targetMemberIds.size) * 100) : 0;

    const filteredTodayStats = todayStats?.filter(s => targetMemberIds.has(s.studentId)) || [];
    const avgCompletion = filteredTodayStats.length > 0 
      ? Math.round(filteredTodayStats.reduce((acc, s) => acc + (s.todayPlanCompletionRate || 0), 0) / filteredTodayStats.length) 
      : 0;

    const filteredReports = dailyReports?.filter(r => targetMemberIds.has(r.studentId)) || [];
    const sentReports = filteredReports.filter(r => r.status === 'sent');

    const thirtyDaysAgoMs = now - (30 * 24 * 60 * 60 * 1000);
    const recentParentEvents = (parentActivityEvents || []).filter((event) => {
      if (!targetMemberIds.has(event.studentId)) return false;
      const createdAtMs = (event.createdAt as any)?.toMillis?.() ?? 0;
      return createdAtMs >= thirtyDaysAgoMs;
    });
    const recentParentCommunications = (parentCommunications || []).filter((item: any) => {
      if (!targetMemberIds.has(item.studentId)) return false;
      const createdAtMs = item?.createdAt?.toMillis?.() ?? 0;
      return createdAtMs >= thirtyDaysAgoMs;
    });

    const parentVisitCount30d = recentParentEvents.filter((event) => event.eventType === 'app_visit').length;
    const activeParentCount30d = new Set(
      recentParentEvents
        .filter((event) => event.eventType === 'app_visit')
        .map((event) => event.parentUid)
        .filter((uid): uid is string => typeof uid === 'string' && uid.length > 0)
    ).size;

    const consultationEventCount30d = recentParentEvents.filter((event) => event.eventType === 'consultation_request').length;
    const consultationDocCount30d = recentParentCommunications.filter((item: any) => item.type === 'consultation').length;
    const consultationRequestCount30d = Math.max(consultationEventCount30d, consultationDocCount30d);

    const reportReadCount30d = recentParentEvents.filter((event) => event.eventType === 'report_read').length;

    return {
      totalTodayMins,
      checkedInCount,
      seatOccupancy,
      totalStudents: targetMemberIds.size,
      avgCompletion,
      riskCount: highRiskCount,
      regularityRate: targetMemberIds.size > 0 ? Math.round((sentReports.length / targetMemberIds.size) * 100) : 0,
      readRate: sentReports.length > 0 ? Math.round((sentReports.filter(r => r.viewedAt).length / sentReports.length) * 100) : 0,
      commentWriteRate: sentReports.length > 0 ? Math.round((sentReports.filter(r => r.content.length > 200).length / sentReports.length) * 100) : 0,
      parentVisitCount30d,
      activeParentCount30d,
      avgVisitsPerStudent30d: targetMemberIds.size > 0 ? Number((parentVisitCount30d / targetMemberIds.size).toFixed(1)) : 0,
      consultationRequestCount30d,
      reportReadCount30d,
    };
  }, [activeMembers, attendanceList, todayStats, dailyReports, progressList, parentActivityEvents, parentCommunications, selectedClass, now, isMounted]);

  if (!isActive) return null;

  if (membersLoading || !isMounted) {
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
          <p className="text-sm font-bold text-muted-foreground/70 mt-2">센터의 실시간 활성도와 리스크를 통합 관리합니다.</p>
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
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">이탈 위험 고득점자</p>
                    <h3 className="text-5xl font-black tracking-tighter text-rose-600">{metrics.riskCount}<span className="text-2xl opacity-40 ml-1">명</span></h3>
                  </div>
                  <div className="bg-rose-50 p-4 rounded-[1.5rem] group-hover:bg-rose-600 group-hover:text-white transition-all duration-500 shadow-sm"><ShieldAlert className="h-8 w-8 text-rose-600 group-hover:text-white" /></div>
                </div>
                <div className="mt-8 pt-8 border-t border-dashed">
                  <p className="text-[9px] font-bold text-muted-foreground leading-relaxed italic">
                    "위험 점수 70점 이상의 즉시 개입이 필요한 학생 수입니다."
                  </p>
                </div>
              </Card>
            </div>
          </section>

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
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="grid gap-1">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-blue-500" /> 최근 30일 앱 방문 수</span>
                        <div className="text-5xl font-black text-blue-600 tabular-nums">{metrics.parentVisitCount30d}</div>
                        <p className="text-[11px] font-bold text-blue-500/80">활성 학부모 {metrics.activeParentCount30d}명</p>
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-blue-50 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, metrics.avgVisitsPerStudent30d * 8)}%` }} />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground">학생 1인당 평균 방문 {metrics.avgVisitsPerStudent30d}회</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="grid gap-1">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><MessageSquare className="h-3 w-3 text-emerald-500" /> 최근 30일 상담 신청</span>
                        <div className="text-5xl font-black text-emerald-600 tabular-nums">{metrics.consultationRequestCount30d}</div>
                        <p className="text-[11px] font-bold text-emerald-500/80">학부모 요청 누적 건수</p>
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-emerald-50 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, metrics.consultationRequestCount30d * 6)}%` }} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="grid gap-1">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><Eye className="h-3 w-3 text-amber-500" /> 최근 30일 리포트 열람</span>
                        <div className="text-5xl font-black text-amber-600 tabular-nums">{metrics.reportReadCount30d}</div>
                        <p className="text-[11px] font-bold text-amber-500/80">당일 리포트 열람률 {metrics.readRate}%</p>
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-amber-50 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, Math.max(metrics.readRate, metrics.reportReadCount30d * 5))}%` }} />
                    </div>
                  </div>
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
