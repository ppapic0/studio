
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
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  PenTool,
  UserCog,
  UserX,
  Mail,
  Phone
} from 'lucide-react';
import { useFirestore, useCollection, useFunctions } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, collectionGroup, Timestamp, doc, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { AttendanceCurrent, DailyStudentStat, DailyReport, CenterMembership, StudyLogDay, InviteCode, GrowthProgress, ParentActivityEvent, CounselingLog } from '@/lib/types';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export function AdminDashboard({ isActive }: { isActive: boolean }) {
  const firestore = useFirestore();
  const functions = useFunctions();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [today, setToday] = useState<Date | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [now, setNow] = useState<number>(Date.now());
  const [teacherSearch, setTeacherSearch] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [deletingTeacherId, setDeletingTeacherId] = useState<string | null>(null);
  const [isParentTrustDialogOpen, setIsParentTrustDialogOpen] = useState(false);
  const [parentTrustSearch, setParentTrustSearch] = useState('');

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

  const teacherMembersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'teacher'));
  }, [firestore, centerId]);
  const { data: teacherMembers } = useCollection<CenterMembership>(teacherMembersQuery, { enabled: isActive });

  const parentMembersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'parent'));
  }, [firestore, centerId]);
  const { data: parentMembers } = useCollection<CenterMembership>(parentMembersQuery, { enabled: isActive });

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

  const allReportsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'dailyReports'), limit(600));
  }, [firestore, centerId]);
  const { data: allReports } = useCollection<DailyReport>(allReportsQuery, { enabled: isActive });

  const counselingLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'counselingLogs'), limit(600));
  }, [firestore, centerId]);
  const { data: counselingLogs } = useCollection<CounselingLog>(counselingLogsQuery, { enabled: isActive });
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

  const filteredStudentMembers = useMemo(() => {
    if (!activeMembers) return [];
    return activeMembers.filter((member) => selectedClass === 'all' || member.className === selectedClass);
  }, [activeMembers, selectedClass]);

  const targetMemberIds = useMemo(
    () => new Set(filteredStudentMembers.map((member) => member.id)),
    [filteredStudentMembers]
  );

  const studentNameById = useMemo(() => {
    const map = new Map<string, string>();
    (activeMembers || []).forEach((member) => {
      map.set(member.id, member.displayName || member.id);
    });
    return map;
  }, [activeMembers]);

  const teacherRows = useMemo(() => {
    const reportByTeacher = new Map<string, DailyReport[]>();
    (allReports || []).forEach((report) => {
      const teacherId = report.teacherId;
      if (!teacherId) return;
      const bucket = reportByTeacher.get(teacherId) || [];
      bucket.push(report);
      reportByTeacher.set(teacherId, bucket);
    });

    const counselingByTeacher = new Map<string, CounselingLog[]>();
    (counselingLogs || []).forEach((log) => {
      const teacherId = log.teacherId;
      if (!teacherId) return;
      const bucket = counselingByTeacher.get(teacherId) || [];
      bucket.push(log);
      counselingByTeacher.set(teacherId, bucket);
    });

    return (teacherMembers || [])
      .map((teacher) => {
        const reports = [...(reportByTeacher.get(teacher.id) || [])].sort(
          (a, b) => ((b.createdAt as any)?.toMillis?.() || 0) - ((a.createdAt as any)?.toMillis?.() || 0)
        );
        const logs = [...(counselingByTeacher.get(teacher.id) || [])].sort(
          (a, b) => ((b.createdAt as any)?.toMillis?.() || 0) - ((a.createdAt as any)?.toMillis?.() || 0)
        );

        return {
          ...teacher,
          teacherName: teacher.displayName || `선생님-${teacher.id.slice(0, 6)}`,
          reports,
          sentReports: reports.filter((report) => report.status === 'sent'),
          logs,
        };
      })
      .sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'ko'));
  }, [teacherMembers, allReports, counselingLogs]);

  const filteredTeacherRows = useMemo(() => {
    const keyword = teacherSearch.trim().toLowerCase();
    if (!keyword) return teacherRows;
    return teacherRows.filter((teacher) => {
      const name = teacher.teacherName.toLowerCase();
      const phone = (teacher.phoneNumber || '').toLowerCase();
      const id = teacher.id.toLowerCase();
      return name.includes(keyword) || phone.includes(keyword) || id.includes(keyword);
    });
  }, [teacherRows, teacherSearch]);

  const selectedTeacher = useMemo(
    () => teacherRows.find((teacher) => teacher.id === selectedTeacherId) || null,
    [teacherRows, selectedTeacherId]
  );

  const handleDeleteTeacher = async (teacher: { id: string; teacherName: string }) => {
    if (!functions || !centerId) return;

    const confirmed = window.confirm(`${teacher.teacherName} 계정을 삭제할까요?\n삭제 후에는 이 센터에 다시 초대해야 접근할 수 있습니다.`);
    if (!confirmed) return;

    setDeletingTeacherId(teacher.id);
    try {
      const removeTeacher = httpsCallable(functions, 'deleteTeacherAccount', { timeout: 600000 });
      await removeTeacher({ teacherId: teacher.id, centerId });

      toast({
        title: '선생님 계정 삭제 완료',
        description: `${teacher.teacherName} 계정을 센터에서 삭제했습니다.`,
      });

      if (selectedTeacherId === teacher.id) {
        setSelectedTeacherId(null);
      }
    } catch (error: any) {
      console.error(error);
      const message = String(error?.message || '').replace(/^FirebaseError:\s*/, '') || '선생님 계정 삭제 중 오류가 발생했습니다.';
      toast({
        variant: 'destructive',
        title: '삭제 실패',
        description: message,
      });
    } finally {
      setDeletingTeacherId(null);
    }
  };

  const parentTrustRows = useMemo(() => {
    if (!isMounted) return [];

    const dayMs = 24 * 60 * 60 * 1000;
    const thirtyDaysAgoMs = now - (30 * dayMs);
    const parentMemberMap = new Map<string, CenterMembership>(
      (parentMembers || []).map((member) => [member.id, member])
    );

    const buckets = new Map<string, {
      parentUid: string;
      parentName: string;
      parentPhone: string;
      studentIds: Set<string>;
      visitCount: number;
      reportReadCount: number;
      consultationEventCount: number;
      consultationDocCount: number;
      requestCount: number;
      suggestionCount: number;
      latestVisitMs: number;
      latestInteractionMs: number;
    }>();

    const ensureBucket = (parentUid: string) => {
      let bucket = buckets.get(parentUid);
      if (bucket) return bucket;
      const parentMember = parentMemberMap.get(parentUid);
      bucket = {
        parentUid,
        parentName: parentMember?.displayName || '',
        parentPhone: parentMember?.phoneNumber || '',
        studentIds: new Set(parentMember?.linkedStudentIds || []),
        visitCount: 0,
        reportReadCount: 0,
        consultationEventCount: 0,
        consultationDocCount: 0,
        requestCount: 0,
        suggestionCount: 0,
        latestVisitMs: 0,
        latestInteractionMs: 0,
      };
      buckets.set(parentUid, bucket);
      return bucket;
    };

    (parentMembers || []).forEach((member) => {
      const linkedIds = member.linkedStudentIds || [];
      if (linkedIds.length > 0 && !linkedIds.some((id) => targetMemberIds.has(id))) return;
      ensureBucket(member.id);
    });

    (parentActivityEvents || []).forEach((event) => {
      const createdAtMs = (event.createdAt as any)?.toMillis?.() ?? 0;
      if (createdAtMs < thirtyDaysAgoMs) return;
      if (!targetMemberIds.has(event.studentId)) return;
      if (!event.parentUid) return;

      const bucket = ensureBucket(event.parentUid);
      bucket.studentIds.add(event.studentId);
      bucket.latestInteractionMs = Math.max(bucket.latestInteractionMs, createdAtMs);

      if (event.eventType === 'app_visit') {
        bucket.visitCount += 1;
        bucket.latestVisitMs = Math.max(bucket.latestVisitMs, createdAtMs);
      } else if (event.eventType === 'report_read') {
        bucket.reportReadCount += 1;
      } else if (event.eventType === 'consultation_request') {
        bucket.consultationEventCount += 1;
      }

      const metaName = event.metadata?.parentName;
      const metaPhone = event.metadata?.parentPhone;
      if (!bucket.parentName && typeof metaName === 'string' && metaName.trim()) {
        bucket.parentName = metaName.trim();
      }
      if (!bucket.parentPhone && typeof metaPhone === 'string' && metaPhone.trim()) {
        bucket.parentPhone = metaPhone.trim();
      }
    });

    (parentCommunications || []).forEach((item: any) => {
      const createdAtMs = item?.createdAt?.toMillis?.() ?? item?.updatedAt?.toMillis?.() ?? 0;
      if (createdAtMs < thirtyDaysAgoMs) return;
      if (!targetMemberIds.has(item.studentId)) return;
      if (!item.parentUid) return;

      const bucket = ensureBucket(item.parentUid);
      bucket.studentIds.add(item.studentId);
      bucket.latestInteractionMs = Math.max(bucket.latestInteractionMs, createdAtMs);

      if (item.type === 'consultation') bucket.consultationDocCount += 1;
      if (item.type === 'request') bucket.requestCount += 1;
      if (item.type === 'suggestion') bucket.suggestionCount += 1;

      if (!bucket.parentName && typeof item.parentName === 'string' && item.parentName.trim()) {
        bucket.parentName = item.parentName.trim();
      }
    });

    const rows = Array.from(buckets.values()).map((bucket) => {
      const consultationRequestCount = Math.max(bucket.consultationEventCount, bucket.consultationDocCount);
      const daysSinceVisit = bucket.latestVisitMs > 0 ? Math.floor((now - bucket.latestVisitMs) / dayMs) : 999;

      const trustScoreRaw =
        72
        + Math.min(22, bucket.visitCount * 2)
        + Math.min(16, bucket.reportReadCount * 2)
        - (consultationRequestCount * 14)
        - (bucket.requestCount * 6)
        - (bucket.suggestionCount * 4)
        - (bucket.reportReadCount === 0 ? 8 : 0);
      const trustScore = Math.max(0, Math.min(100, Math.round(trustScoreRaw)));

      const inactivityRisk = bucket.latestVisitMs > 0
        ? Math.min(28, Math.max(0, daysSinceVisit - 3) * 2)
        : 28;
      const riskScore = Math.max(
        0,
        Math.min(
          100,
          (consultationRequestCount * 30)
          + (bucket.requestCount * 12)
          + (bucket.suggestionCount * 8)
          + inactivityRisk
          + (bucket.reportReadCount === 0 ? 12 : 0)
        )
      );

      const priority = consultationRequestCount >= 2 || riskScore >= 70
        ? '긴급'
        : consultationRequestCount >= 1 || riskScore >= 45
          ? '우선'
          : riskScore >= 25
            ? '관찰'
            : '안정';

      const recommendedAction =
        priority === '긴급'
          ? '24시간 내 전화 상담 권장'
          : priority === '우선'
            ? '48시간 내 상담 일정 제안'
            : priority === '관찰'
              ? '리포트 확인/안부 메시지 발송'
              : '정기 모니터링 유지';

      const linkedStudentNames = Array.from(bucket.studentIds)
        .filter((id) => targetMemberIds.has(id))
        .map((id) => studentNameById.get(id) || id)
        .sort((a, b) => a.localeCompare(b, 'ko'));

      const parentName = bucket.parentName || `학부모-${bucket.parentUid.slice(0, 6)}`;

      return {
        parentUid: bucket.parentUid,
        parentName,
        parentPhone: bucket.parentPhone || '-',
        linkedStudentNames,
        visitCount: bucket.visitCount,
        reportReadCount: bucket.reportReadCount,
        consultationRequestCount,
        requestCount: bucket.requestCount,
        suggestionCount: bucket.suggestionCount,
        trustScore,
        riskScore,
        priority,
        recommendedAction,
        lastVisitLabel: bucket.latestVisitMs > 0 ? format(new Date(bucket.latestVisitMs), 'MM.dd HH:mm') : '방문 기록 없음',
        lastInteractionLabel: bucket.latestInteractionMs > 0 ? format(new Date(bucket.latestInteractionMs), 'MM.dd HH:mm') : '요청 기록 없음',
      };
    });

    return rows.sort((a, b) => {
      if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
      if (a.trustScore !== b.trustScore) return a.trustScore - b.trustScore;
      return a.parentName.localeCompare(b.parentName, 'ko');
    });
  }, [isMounted, now, parentMembers, parentActivityEvents, parentCommunications, studentNameById, targetMemberIds]);

  const filteredParentTrustRows = useMemo(() => {
    const keyword = parentTrustSearch.trim().toLowerCase();
    if (!keyword) return parentTrustRows;
    return parentTrustRows.filter((row) => {
      const studentsText = row.linkedStudentNames.join(' ').toLowerCase();
      return (
        row.parentName.toLowerCase().includes(keyword)
        || row.parentPhone.toLowerCase().includes(keyword)
        || studentsText.includes(keyword)
        || row.parentUid.toLowerCase().includes(keyword)
      );
    });
  }, [parentTrustRows, parentTrustSearch]);

  const parentContactRecommendations = useMemo(
    () => parentTrustRows.filter((row) => row.priority !== '안정').slice(0, 5),
    [parentTrustRows]
  );

  // --- 실시간 KPI 엔진 ---
  const metrics = useMemo(() => {
    if (!activeMembers || !attendanceList || !isMounted || !progressList) return null;

    let totalTodayMins = 0;
    const studentLiveMinutes: number[] = [];
    let highRiskCount = 0;

    filteredStudentMembers.forEach(member => {
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
      consultationRiskIndex30d: activeParentCount30d > 0
        ? Math.min(100, Math.round((consultationRequestCount30d / activeParentCount30d) * 100))
        : 0,
      reportReadCount30d,
    };
  }, [activeMembers, attendanceList, todayStats, dailyReports, progressList, parentActivityEvents, parentCommunications, targetMemberIds, filteredStudentMembers, now, isMounted]);

  if (!isActive) return null;

  if (membersLoading || !isMounted) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
        <p className="font-black text-muted-foreground/40 uppercase tracking-widest italic">운영 현황 동기화 중...</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-8 w-full max-w-[1400px] mx-auto", isMobile ? "px-1" : "px-4 py-6")}>
      <header className={cn("flex justify-between items-end", isMobile ? "flex-col items-start gap-6" : "")}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-primary/60">
            <Sparkles className="h-4 w-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">운영 인텔리전스</span>
          </div>
          <h1 className={cn("font-black tracking-tighter text-primary leading-none", isMobile ? "text-3xl" : "text-5xl")}>
            운영 핵심 지표
          </h1>
          <p className="text-sm font-bold text-muted-foreground/70 mt-2">센터의 실시간 활성도와 리스크를 통합 관리합니다.</p>
        </div>

        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md p-2 rounded-[1.5rem] border shadow-xl ring-1 ring-black/5">
          <div className="flex items-center gap-2 px-3">
            <Filter className="h-4 w-4 text-primary opacity-40" />
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">분석 대상</span>
          </div>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-[160px] h-11 rounded-xl border border-slate-200 bg-white text-black font-black text-xs shadow-lg focus:ring-0">
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
              <Badge className="bg-blue-600 text-white border-none font-black text-[10px] rounded-full px-2.5">실시간 추적</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="rounded-[2.5rem] border border-[#2A4E97]/40 bg-[linear-gradient(145deg,#12275A_0%,#1C4285_58%,#244B90_100%)] p-10 text-white shadow-[0_28px_60px_rgba(20,41,95,0.28),0_10px_20px_rgba(20,41,95,0.12),inset_0_1px_0_rgba(255,255,255,0.12)] overflow-hidden relative group">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(255,122,22,0.26),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_34%)]" />
                <div className="absolute -right-4 -top-4 opacity-[0.12] rotate-12 group-hover:scale-110 transition-transform duration-1000">
                  <Flame className="h-48 w-48" />
                </div>
                <div className="space-y-1 relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/70">오늘의 트랙 총량 (누적)</p>
                  <div className="flex items-baseline gap-1">
                    <h3 className="dashboard-number text-6xl text-white drop-shadow-[0_10px_24px_rgba(7,16,40,0.35)]">{(metrics.totalTodayMins / 60).toFixed(1)}<span className="ml-1 text-2xl text-white/50">시간</span></h3>
                  </div>
                  <div className="pt-8 space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/70">
                      <span>일일 활성 목표 (평균 6시간)</span>
                      <span>{Math.min(100, Math.round((metrics.totalTodayMins / (metrics.totalStudents * 360 || 1)) * 100))}%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-white/15 overflow-hidden shadow-[inset_0_2px_4px_rgba(6,15,38,0.32)]">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#FFE1C0_0%,#FFB46C_42%,#FF7A16_100%)] shadow-[0_0_18px_rgba(255,122,22,0.38)] transition-all duration-700"
                        style={{ width: `${Math.min(100, (metrics.totalTodayMins / (metrics.totalStudents * 360 || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-10 group hover:shadow-2xl transition-all ring-1 ring-black/[0.03]">
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">현재 착석 인원</p>
                    <h3 className="dashboard-number text-5xl text-primary">{metrics.checkedInCount}<span className="ml-1 text-2xl opacity-40">명</span></h3>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-[1.5rem] group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-sm"><Users className="h-8 w-8 text-blue-600 group-hover:text-white" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-dashed">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-muted-foreground uppercase opacity-60">재원생(대상)</p>
                    <p className="dashboard-number text-xl">{metrics.totalStudents}명</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[9px] font-black text-muted-foreground uppercase opacity-60">실시간 점유율</p>
                    <p className="dashboard-number text-xl text-blue-600">{metrics.seatOccupancy}%</p>
                  </div>
                </div>
              </Card>

              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-10 group hover:shadow-2xl transition-all ring-1 ring-black/[0.03]">
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">이탈 위험 고득점자</p>
                    <h3 className="dashboard-number text-5xl text-rose-600">{metrics.riskCount}<span className="ml-1 text-2xl opacity-40">명</span></h3>
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
            <Card
              className="rounded-[3rem] border-none shadow-2xl bg-white p-10 overflow-hidden relative group ring-1 ring-black/[0.03] cursor-pointer"
              role="button"
              onClick={() => setIsParentTrustDialogOpen(true)}
            >
              <div className="absolute -right-10 -bottom-10 opacity-5 rotate-12 transition-transform duration-1000 group-hover:scale-110">
                <HeartHandshake className="h-64 w-64" />
              </div>
              <div className="space-y-10 relative z-10">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-black tracking-tighter">부모님 신뢰 및 관리 지표</CardTitle>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest opacity-60">학부모 신뢰·서비스 품질 지수</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary text-white border-none font-black text-[10px] px-3 py-1 shadow-lg whitespace-nowrap">신뢰 지표</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl font-black text-xs"
                      onClick={() => setIsParentTrustDialogOpen(true)}
                    >
                      부모님별 상세
                    </Button>
                  </div>
                </div>
                <div className="grid gap-10 md:grid-cols-3">
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="grid gap-1">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-blue-500" /> 최근 30일 앱 방문 수</span>
                        <div className="dashboard-number text-5xl text-blue-600">{metrics.parentVisitCount30d}</div>
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
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><MessageSquare className="h-3 w-3 text-rose-500" /> 최근 30일 상담 신청 (주의)</span>
                        <div className="dashboard-number text-5xl text-rose-600">{metrics.consultationRequestCount30d}</div>
                        <p className="text-[11px] font-bold text-rose-500/80">신뢰 하락 리스크 이벤트</p>
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-rose-50 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-rose-500 rounded-full transition-all duration-1000" style={{ width: `${metrics.consultationRiskIndex30d}%` }} />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground">상담 신청 리스크 지수 {metrics.consultationRiskIndex30d}%</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="grid gap-1">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><Eye className="h-3 w-3 text-amber-500" /> 최근 30일 리포트 열람</span>
                        <div className="dashboard-number text-5xl text-amber-600">{metrics.reportReadCount30d}</div>
                        <p className="text-[11px] font-bold text-amber-500/80">당일 리포트 열람률 {metrics.readRate}%</p>
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-amber-50 rounded-full overflow-hidden shadow-inner">
                      <div className="h-full bg-amber-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, Math.max(metrics.readRate, metrics.reportReadCount30d * 5))}%` }} />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-black uppercase tracking-widest text-rose-700">우선 연락 추천</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-lg px-2 text-[10px] font-black text-rose-700 hover:bg-rose-100"
                      onClick={() => setIsParentTrustDialogOpen(true)}
                    >
                      전체 보기
                    </Button>
                  </div>
                  <div className="mt-2 grid gap-2">
                    {parentContactRecommendations.length === 0 ? (
                      <p className="text-xs font-bold text-slate-500">현재 즉시 연락이 필요한 학부모가 없습니다.</p>
                    ) : (
                      parentContactRecommendations.slice(0, 3).map((row) => (
                        <div key={row.parentUid} className="rounded-xl border border-rose-100 bg-white px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-black text-slate-900 truncate">{row.parentName}</p>
                            <Badge className={cn(
                              'h-5 border-none px-2 text-[10px] font-black',
                              row.priority === '긴급'
                                ? 'bg-rose-100 text-rose-700'
                                : row.priority === '우선'
                                  ? 'bg-orange-100 text-orange-700'
                                  : 'bg-amber-100 text-amber-700'
                            )}>
                              {row.priority}
                            </Badge>
                          </div>
                          <p className="text-[11px] font-bold text-slate-600">
                            상담 {row.consultationRequestCount}건 · 방문 {row.visitCount}회 · 조치: {row.recommendedAction}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </section>

          <section className="pb-10 px-1 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserCog className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-black tracking-tighter">선생님 계정 관리</h2>
              </div>
              <Badge className="bg-slate-900 text-white border-none font-black text-[10px] px-3 py-1">
                {teacherRows.length}명
              </Badge>
            </div>

            <Card className="rounded-[2rem] border-none shadow-lg bg-white ring-1 ring-black/[0.03]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-black tracking-tight">선생님 활동 요약</CardTitle>
                <CardDescription className="font-bold text-xs">
                  상담일지 작성 건수와 발송 리포트를 함께 확인하고 계정을 관리할 수 있습니다.
                </CardDescription>
                <div className="pt-2">
                  <Input
                    value={teacherSearch}
                    onChange={(event) => setTeacherSearch(event.target.value)}
                    placeholder="선생님 이름/전화번호/사용자번호 검색"
                    className="h-11 rounded-xl border-2 font-bold"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {filteredTeacherRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed py-10 text-center text-sm font-bold text-muted-foreground">
                    조회된 선생님 계정이 없습니다.
                  </div>
                ) : (
                  filteredTeacherRows.map((teacher) => (
                    <div key={teacher.id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 truncate">{teacher.teacherName}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-500">
                            <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {teacher.phoneNumber || '전화번호 미등록'}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> 상담일지 {teacher.logs.length}건</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> 발송 리포트 {teacher.sentReports.length}건</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-xl font-black text-xs"
                            onClick={() => setSelectedTeacherId(teacher.id)}
                          >
                            상세 보기
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-9 rounded-xl font-black text-xs gap-1.5"
                            onClick={() => void handleDeleteTeacher({ id: teacher.id, teacherName: teacher.teacherName })}
                            disabled={deletingTeacherId === teacher.id}
                          >
                            {deletingTeacherId === teacher.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                            삭제
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-20">
          <Activity className="h-16 w-16 animate-pulse" />
          <p className="font-black text-xl tracking-tighter">분석 데이터를 집계하고 있습니다...</p>
        </div>
      )}

      <Dialog open={isParentTrustDialogOpen} onOpenChange={setIsParentTrustDialogOpen}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-4xl">
          <div className="bg-primary p-6 text-primary-foreground">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">부모님별 신뢰 지표 상세</DialogTitle>
              <DialogDescription className="text-primary-foreground/80 font-bold">
                방문/리포트 열람/상담 신청을 합산해 우선 연락 대상을 추천합니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[72vh] overflow-y-auto bg-white p-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">대상 학부모</p>
                <p className="text-2xl font-black text-blue-800">{parentTrustRows.length}명</p>
              </div>
              <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">우선 연락(긴급+우선)</p>
                <p className="text-2xl font-black text-rose-800">{parentTrustRows.filter((row) => row.priority === '긴급' || row.priority === '우선').length}명</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">상담 신청 총합</p>
                <p className="text-2xl font-black text-amber-800">
                  {parentTrustRows.reduce((sum, row) => sum + row.consultationRequestCount, 0)}건
                </p>
              </div>
            </div>

            <Input
              value={parentTrustSearch}
              onChange={(event) => setParentTrustSearch(event.target.value)}
              placeholder="학부모 이름/연락처/학생 이름으로 검색"
              className="h-11 rounded-xl border-2 font-bold"
            />

            {filteredParentTrustRows.length === 0 ? (
              <div className="rounded-xl border border-dashed py-12 text-center text-sm font-bold text-muted-foreground">
                조회된 학부모 데이터가 없습니다.
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredParentTrustRows.map((row) => (
                  <div key={row.parentUid} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-black text-slate-900 truncate">{row.parentName}</p>
                          <Badge className={cn(
                            'h-6 border-none px-2.5 text-[10px] font-black',
                            row.priority === '긴급'
                              ? 'bg-rose-100 text-rose-700'
                              : row.priority === '우선'
                                ? 'bg-orange-100 text-orange-700'
                                : row.priority === '관찰'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                          )}>
                            {row.priority}
                          </Badge>
                        </div>
                        <p className="text-[11px] font-bold text-slate-500">
                          {row.parentPhone} · 학생: {row.linkedStudentNames.length > 0 ? row.linkedStudentNames.join(', ') : '-'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">신뢰 점수</p>
                        <p className="dashboard-number text-2xl text-primary">{row.trustScore}점</p>
                        <p className="text-[10px] font-bold text-rose-500">리스크 {row.riskScore}점</p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700">앱 방문 {row.visitCount}회</div>
                      <div className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700">리포트 열람 {row.reportReadCount}회</div>
                      <div className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-rose-700">상담 신청 {row.consultationRequestCount}건</div>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <p className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-600">최근 방문: {row.lastVisitLabel}</p>
                      <p className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-600">최근 상호작용: {row.lastInteractionLabel}</p>
                    </div>
                    <p className="mt-2 rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2 text-xs font-black text-rose-700">
                      연락 추천: {row.recommendedAction}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t bg-white p-4">
            <DialogClose asChild>
              <Button className="h-11 rounded-xl px-6 font-black">닫기</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTeacher} onOpenChange={(open) => !open && setSelectedTeacherId(null)}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-3xl">
          {selectedTeacher && (
            <>
              <div className="bg-primary p-6 text-primary-foreground">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black tracking-tight">{selectedTeacher.teacherName}</DialogTitle>
                  <DialogDescription className="text-primary-foreground/80 font-bold">
                    상담일지 {selectedTeacher.logs.length}건 · 발송 리포트 {selectedTeacher.sentReports.length}건
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="max-h-[70vh] overflow-y-auto bg-white p-6 space-y-5">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">계정 정보</p>
                  <div className="mt-2 grid gap-1 text-sm font-bold text-slate-700">
                    <p>사용자번호: {selectedTeacher.id}</p>
                    <p>전화번호: {selectedTeacher.phoneNumber || '미등록'}</p>
                    <p>상태: {selectedTeacher.status}</p>
                  </div>
                </div>

                <section className="space-y-2">
                  <h4 className="text-sm font-black tracking-tight text-slate-900">작성 상담일지</h4>
                  {selectedTeacher.logs.length === 0 ? (
                    <div className="rounded-xl border border-dashed py-8 text-center text-xs font-bold text-slate-400">
                      작성된 상담일지가 없습니다.
                    </div>
                  ) : (
                    selectedTeacher.logs.slice(0, 12).map((log) => (
                      <div key={log.id} className="rounded-xl border border-slate-100 bg-white p-3">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] font-black text-slate-500">
                          <Badge className="h-5 border-none bg-emerald-100 px-2 text-[10px] font-black text-emerald-700">
                            {log.type === 'academic' ? '학습 상담' : log.type === 'life' ? '생활 상담' : '진로 상담'}
                          </Badge>
                          <span>{log.createdAt ? format(log.createdAt.toDate(), 'yyyy.MM.dd HH:mm') : '-'}</span>
                          <span>·</span>
                          <span>{log.studentName || log.studentId}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-700 leading-relaxed">{log.content}</p>
                        {log.improvement && <p className="mt-1 text-xs font-semibold text-emerald-700">개선 포인트: {log.improvement}</p>}
                      </div>
                    ))
                  )}
                </section>

                <section className="space-y-2">
                  <h4 className="text-sm font-black tracking-tight text-slate-900">발송 리포트 내역</h4>
                  {selectedTeacher.sentReports.length === 0 ? (
                    <div className="rounded-xl border border-dashed py-8 text-center text-xs font-bold text-slate-400">
                      발송된 리포트가 없습니다.
                    </div>
                  ) : (
                    selectedTeacher.sentReports.slice(0, 12).map((report) => (
                      <div key={report.id} className="rounded-xl border border-slate-100 bg-white p-3">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] font-black text-slate-500">
                          <Badge className="h-5 border-none bg-blue-100 px-2 text-[10px] font-black text-blue-700">{report.dateKey}</Badge>
                          <span>{report.studentName || report.studentId}</span>
                          <span>·</span>
                          <span>{report.createdAt ? format(report.createdAt.toDate(), 'yyyy.MM.dd HH:mm') : '-'}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-700 line-clamp-2">{report.content || '리포트 내용 없음'}</p>
                      </div>
                    ))
                  )}
                </section>
              </div>

              <DialogFooter className="border-t bg-white p-4">
                <DialogClose asChild>
                  <Button className="h-11 rounded-xl px-6 font-black">닫기</Button>
                </DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
