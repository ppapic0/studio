
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
import { Textarea } from '@/components/ui/textarea';
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
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import {
  Users, 
  TrendingUp, 
  Armchair, 
  AlertTriangle, 
  Loader2, 
  Clock, 
  ArrowUpRight, 
  ArrowDownRight,
  Zap,
  ShieldAlert,
  MessageSquare,
  Activity,
  ChevronRight,
  HeartHandshake,
  Trophy,
  Sparkles,
  History,
  CheckCircle2,
  Eye,
  UserCog,
  UserX,
  Phone,
  Megaphone,
  LayoutGrid,
  ClipboardCheck,
} from 'lucide-react';
import { useFirestore, useCollection, useFunctions, useDoc } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { addDoc, collection, query, where, Timestamp, doc, limit, getDoc, getDocs, orderBy, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { AttendanceCurrent, DailyStudentStat, DailyReport, CenterMembership, InviteCode, GrowthProgress, ParentActivityEvent, CounselingLog, LayoutRoomConfig, StudentProfile, StudyLogDay, OpenClawIntegrationDoc, OpenClawSnapshotRecordCounts } from '@/lib/types';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { AdminWorkbenchCommandBar } from '@/components/dashboard/admin-workbench-command-bar';
import { CenterAdminAttendanceBoard } from '@/components/dashboard/center-admin-attendance-board';
import { CenterAdminHeatmapCharts } from '@/components/dashboard/center-admin-heatmap-charts';
import { useCenterAdminAttendanceBoard } from '@/hooks/use-center-admin-attendance-board';
import { useCenterAdminHeatmap } from '@/hooks/use-center-admin-heatmap';
import {
  buildSeatId,
  getGlobalSeatNo,
  normalizeLayoutRooms,
  resolveSeatIdentity,
} from '@/lib/seat-layout';

const isLikelyUid = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized) return false;
  if (normalized.length < 12 || normalized.length > 64) return false;
  if (/[가-힣\s]/.test(normalized)) return false;
  return /^[A-Za-z0-9_-]+$/.test(normalized);
};

const toSafeStudentName = (displayName?: string | null, memberId?: string): string => {
  const normalizedDisplayName = (displayName || '').trim();
  if (normalizedDisplayName && !isLikelyUid(normalizedDisplayName)) {
    return normalizedDisplayName;
  }
  const normalizedMemberId = (memberId || '').trim();
  if (normalizedMemberId && !isLikelyUid(normalizedMemberId)) {
    return normalizedMemberId;
  }
  return '이름 미등록';
};

const normalizePhoneNumber = (value?: string | null): string => {
  return String(value || '').replace(/\D/g, '').trim();
};

const toTimestampDateSafe = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const calculateRhythmScoreFromMinutes = (minutes: number[]): number => {
  if (!minutes.length) return 0;
  const average = minutes.reduce((sum, value) => sum + value, 0) / minutes.length;
  if (average <= 0) return 0;
  const variance = minutes.reduce((sum, value) => sum + (value - average) ** 2, 0) / minutes.length;
  const standardDeviation = Math.sqrt(variance);
  return Math.max(0, Math.min(100, Math.round(100 - (standardDeviation / average) * 100)));
};

type ResolvedAttendanceSeat = AttendanceCurrent & {
  roomId: string;
  roomSeatNo: number;
};

const EMPTY_ADMIN_METRICS = {
  totalTodayMins: 0,
  checkedInCount: 0,
  seatOccupancy: 0,
  totalStudents: 0,
  avgCompletion: 0,
  riskCount: 0,
  regularityRate: 0,
  readRate: 0,
  commentWriteRate: 0,
  parentVisitCount30d: 0,
  activeParentCount30d: 0,
  avgVisitsPerStudent30d: 0,
  consultationRequestCount30d: 0,
  leadPipelineCount30d: 0,
  consultationRiskIndex30d: 0,
  reportReadCount30d: 0,
  focusKpi: {
    score: 0,
    levelLabel: '집계 대기',
    levelBadgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    delta: 0,
    completion: 0,
    avgStudyMinutes: 0,
    avgAwayMinutes: 0,
    avgGrowthRate: 0,
    highPenaltyCount: 0,
    lowCompletionCount: 0,
    strengths: [] as string[],
    risks: [] as string[],
    actions: [] as string[],
  },
  focusRows: [] as Array<{
    studentId: string;
    name: string;
    className: string;
    score: number;
    completion: number;
    studyMinutes: number;
    todayMinutes: number;
  }>,
  focusTop10: [] as Array<{
    studentId: string;
    name: string;
    className: string;
    score: number;
    completion: number;
    studyMinutes: number;
    todayMinutes: number;
  }>,
  focusBottom10: [] as Array<{
    studentId: string;
    name: string;
    className: string;
    score: number;
    completion: number;
    studyMinutes: number;
    todayMinutes: number;
  }>,
};

type GenerateOpenClawSnapshotResult = {
  ok: boolean;
  centerId: string;
  generatedAt: string;
  objectPath: string;
  latestObjectPath: string;
  recordCounts: OpenClawSnapshotRecordCounts;
};

const getCallableErrorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object') {
    const details = (error as { details?: unknown }).details;
    if (details && typeof details === 'object') {
      const userMessage = (details as { userMessage?: unknown }).userMessage;
      if (typeof userMessage === 'string' && userMessage.trim()) {
        return userMessage.trim();
      }
    }

    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message.replace(/^FirebaseError:\s*/, '').trim();
    }
  }

  return fallback;
};

const formatOpenClawCountSummary = (counts: OpenClawSnapshotRecordCounts): string => {
  const studentTotal = counts.students.memberships + counts.students.profiles + counts.students.growthProgress;
  const attendanceTotal = counts.attendance.records + counts.attendance.schedules + counts.attendance.currentSeats;
  const consultationTotal = counts.consultations.logs + counts.consultations.reservations;
  const billingTotal = counts.billing.invoices + counts.billing.payments + counts.billing.kpiDaily;
  const studyRoomTotal =
    counts.studyRoomUsage.dailyStudentStats + counts.studyRoomUsage.studyLogDays + counts.studyRoomUsage.sessions;

  return `학생 ${studentTotal} · 출결 ${attendanceTotal} · 상담 ${consultationTotal} · 수납 ${billingTotal} · 독서실 ${studyRoomTotal}`;
};

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
  const [isTeacherManagementDialogOpen, setIsTeacherManagementDialogOpen] = useState(false);
  const [isParentTrustDialogOpen, setIsParentTrustDialogOpen] = useState(false);
  const [parentTrustSearch, setParentTrustSearch] = useState('');
  const [selectedFocusStudentId, setSelectedFocusStudentId] = useState<string | null>(null);
  const [isStudyingStudentsDialogOpen, setIsStudyingStudentsDialogOpen] = useState(false);
  const [isAttendanceFullscreenOpen, setIsAttendanceFullscreenOpen] = useState(false);
  const [selectedRoomView, setSelectedRoomView] = useState<'all' | string>('all');
  const [focusDayData, setFocusDayData] = useState<Record<string, { awayMinutes: number; startHour: number | null; endHour: number | null }>>({});
  const [dayDataLoading, setDayDataLoading] = useState(false);
  const [dailyGrowthWindowIndex, setDailyGrowthWindowIndex] = useState(0);
  const [liveTickMs, setLiveTickMs] = useState<number>(Date.now());
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeAudience, setNoticeAudience] = useState<'parent' | 'student' | 'all'>('parent');
  const [isNoticeSubmitting, setIsNoticeSubmitting] = useState(false);
  const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] = useState(false);
  const [isOpenClawExporting, setIsOpenClawExporting] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setToday(new Date());
    
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!today) return;
    const nextDate = new Date(now);
    if (format(today, 'yyyy-MM-dd') !== format(nextDate, 'yyyy-MM-dd')) {
      setToday(nextDate);
    }
  }, [now, today]);

  useEffect(() => {
    const syncLiveTick = () => setLiveTickMs(Date.now());
    syncLiveTick();
    const tenMinuteTimer = setInterval(syncLiveTick, 10 * 60 * 1000);
    return () => clearInterval(tenMinuteTimer);
  }, []);

  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;
  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';
  const yesterdayKey = today ? format(subDays(today, 1), 'yyyy-MM-dd') : '';

  const centerRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId);
  }, [firestore, centerId]);
  const { data: centerData } = useDoc<any>(centerRef);

  const openClawIntegrationRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId, 'integrations', 'openclaw');
  }, [firestore, centerId]);
  const { data: openClawIntegration } = useDoc<OpenClawIntegrationDoc>(openClawIntegrationRef);

  const roomConfigs = useMemo(
    () => normalizeLayoutRooms(centerData?.layoutSettings),
    [centerData?.layoutSettings]
  );
  const roomNameById = useMemo(
    () =>
      new Map(
        roomConfigs.map((room, index) => [room.id, room.name?.trim() || `${index + 1}호실`])
      ),
    [roomConfigs]
  );
  const roomOrderById = useMemo(
    () =>
      new Map(
        roomConfigs.map((room, index) => [room.id, typeof room.order === 'number' ? room.order : index])
      ),
    [roomConfigs]
  );

  useEffect(() => {
    if (selectedRoomView === 'all') return;
    const hasSelectedRoom = roomConfigs.some((room) => room.id === selectedRoomView);
    if (!hasSelectedRoom) {
      setSelectedRoomView('all');
    }
  }, [roomConfigs, selectedRoomView]);

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
  const hasMetricsReady = Boolean(activeMembers && attendanceList && isMounted && progressList);

  // 4. 실시간 학습 로그 집계
  const todayStatsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return collection(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students');
  }, [firestore, centerId, todayKey]);
  const { data: todayStats, isLoading: statsLoading } = useCollection<DailyStudentStat>(todayStatsQuery, { enabled: isActive });

  const yesterdayStatsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !yesterdayKey) return null;
    return collection(firestore, 'centers', centerId, 'dailyStudentStats', yesterdayKey, 'students');
  }, [firestore, centerId, yesterdayKey]);
  const { data: yesterdayStats } = useCollection<DailyStudentStat>(yesterdayStatsQuery, { enabled: isActive });

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('name', 'asc'));
  }, [firestore, centerId]);
  const { data: students } = useCollection<StudentProfile>(studentsQuery, { enabled: isActive });

  const resolvedAttendanceList = useMemo<ResolvedAttendanceSeat[]>(
    () =>
      (attendanceList || []).map((seat) => {
        const identity = resolveSeatIdentity(seat);
        return {
          ...seat,
          roomId: identity.roomId,
          roomSeatNo: identity.roomSeatNo,
          seatNo: identity.seatNo,
          type: seat.type || 'seat',
        };
      }),
    [attendanceList]
  );

  const studentsById = useMemo(
    () => new Map((students || []).map((student) => [student.id, student])),
    [students]
  );

  const studentMembersById = useMemo(
    () => new Map((activeMembers || []).map((member) => [member.id, member])),
    [activeMembers]
  );

  const seatById = useMemo(
    () => new Map(resolvedAttendanceList.map((seat) => [seat.id, seat])),
    [resolvedAttendanceList]
  );

  const {
    rows: adminHeatmapRows,
    interventionSignals: heatmapInterventionSignals,
    isLoading: adminHeatmapLoading,
    weeklyStudyMinutesByStudent,
  } = useCenterAdminHeatmap({
    centerId,
    isActive,
    selectedClass,
    referenceDate: today,
    preloadedActiveMembers: activeMembers,
    preloadedActiveMembersLoading: membersLoading,
    preloadedProgressList: progressList,
    preloadedProgressListLoading: !progressList && isActive,
    preloadedAttendanceList: attendanceList,
    preloadedAttendanceListLoading: attendanceLoading,
  });

  const getSeatForRoom = (room: LayoutRoomConfig, roomSeatNo: number): ResolvedAttendanceSeat => {
    const seatId = buildSeatId(room.id, roomSeatNo);
    const existingSeat = seatById.get(seatId);
    if (existingSeat) return existingSeat;

    return {
      id: seatId,
      roomId: room.id,
      roomSeatNo,
      seatNo: getGlobalSeatNo(room.id, roomSeatNo),
      status: 'absent',
      type: 'seat',
      updatedAt: Timestamp.now(),
    };
  };

  const {
    seatSignalsBySeatId: attendanceSeatSignalsBySeatId,
    summary: attendanceBoardSummary,
    isLoading: attendanceBoardLoading,
  } = useCenterAdminAttendanceBoard({
    centerId,
    isActive,
    selectedClass,
    referenceDate: today,
    students,
    studentMembers: activeMembers,
    attendanceList: resolvedAttendanceList,
    todayStats,
    nowMs: now,
  });

  const [focusStudyLogDaysRaw, setFocusStudyLogDaysRaw] = useState<StudyLogDay[]>([]);
  const [focusStudentTrendRaw, setFocusStudentTrendRaw] = useState<DailyStudentStat[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  useEffect(() => {
    if (!firestore || !centerId || !selectedFocusStudentId || !today || !todayKey || !isActive) {
      setFocusStudyLogDaysRaw([]);
      setFocusStudentTrendRaw([]);
      setTrendLoading(false);
      return;
    }

    let disposed = false;
    const loadTrendData = async () => {
      setTrendLoading(true);
      try {
        const studyLogStartKey = format(subDays(today, 89), 'yyyy-MM-dd');
        const studyLogDaysRef = collection(firestore, 'centers', centerId, 'studyLogs', selectedFocusStudentId, 'days');
        const last7DateKeys = Array.from({ length: 7 }, (_, index) => format(subDays(today, index), 'yyyy-MM-dd'));
        const [studyLogSnap, trendStatSnaps] = await Promise.all([
          getDocs(
            query(
              studyLogDaysRef,
              where('dateKey', '>=', studyLogStartKey),
              where('dateKey', '<=', todayKey),
              orderBy('dateKey', 'asc')
            )
          ),
          Promise.all(
            last7DateKeys.map((dateKey) =>
              getDoc(doc(firestore, 'centers', centerId, 'dailyStudentStats', dateKey, 'students', selectedFocusStudentId))
            )
          ),
        ]);

        if (!disposed) {
          setFocusStudyLogDaysRaw(
            studyLogSnap.docs
              .map((docSnap) => docSnap.data() as StudyLogDay)
              .filter((row) => typeof row.dateKey === 'string' && row.dateKey.length > 0)
          );
          setFocusStudentTrendRaw(
            trendStatSnaps
              .filter((snap) => snap.exists())
              .map((snap) => snap.data() as DailyStudentStat)
              .filter((row) => typeof row.dateKey === 'string' && row.dateKey.length > 0)
          );
        }
      } catch {
        if (!disposed) {
          setFocusStudyLogDaysRaw([]);
          setFocusStudentTrendRaw([]);
        }
      } finally {
        if (!disposed) setTrendLoading(false);
      }
    };

    void loadTrendData();
    return () => {
      disposed = true;
    };
  }, [firestore, centerId, selectedFocusStudentId, today, todayKey, isActive]);

  // 5. 데일리 리포트 데이터
  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return query(collection(firestore, 'centers', centerId, 'dailyReports'), where('dateKey', '==', todayKey));
  }, [firestore, centerId, todayKey]);
  const { data: dailyReports } = useCollection<DailyReport>(reportsQuery, { enabled: isActive });

  const allReportsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'dailyReports'), orderBy('createdAt', 'desc'), limit(600));
  }, [firestore, centerId]);
  const { data: allReports } = useCollection<DailyReport>(allReportsQuery, { enabled: isActive });

  const counselingLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'counselingLogs'), orderBy('createdAt', 'desc'), limit(600));
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

  const consultingLeadsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'consultingLeads'), orderBy('createdAt', 'desc'), limit(800));
  }, [firestore, centerId]);
  const { data: consultingLeads } = useCollection<any>(consultingLeadsQuery, { enabled: isActive });

  const websiteConsultRequestsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'websiteConsultRequests'), orderBy('createdAt', 'desc'), limit(800));
  }, [firestore, centerId]);
  const { data: websiteConsultRequests } = useCollection<any>(websiteConsultRequestsQuery, { enabled: isActive });

  const centerAnnouncementsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'centerAnnouncements'),
      orderBy('createdAt', 'desc'),
      limit(20),
    );
  }, [firestore, centerId]);
  const { data: centerAnnouncements } = useCollection<any>(centerAnnouncementsQuery, { enabled: isActive });

  const availableClasses = useMemo(() => {
    if (!activeMembers) return [];
    const classes = new Set<string>();
    activeMembers.forEach(m => { if (m.className) classes.add(m.className); });
    return Array.from(classes).sort();
  }, [activeMembers]);

  const classFilterOptions = useMemo(
    () => [
      { value: 'all', label: '센터 전체' },
      ...availableClasses.map((className) => ({ value: className, label: className })),
    ],
    [availableClasses]
  );

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
      map.set(member.id, toSafeStudentName(member.displayName, member.id));
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
      .filter((teacher): teacher is CenterMembership => Boolean(teacher))
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
          sentReports: reports.filter((report) => report?.status === 'sent'),
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

  const teacherActivityPreviewRows = useMemo(
    () =>
      [...teacherRows]
        .sort((left, right) => {
          const leftScore = left.logs.length + left.sentReports.length;
          const rightScore = right.logs.length + right.sentReports.length;
          if (leftScore !== rightScore) return rightScore - leftScore;
          return left.teacherName.localeCompare(right.teacherName, 'ko');
        })
        .slice(0, 3),
    [teacherRows]
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

  const handleGenerateOpenClawSnapshot = async () => {
    if (!functions || !centerId) return;

    setIsOpenClawExporting(true);
    try {
      const generateSnapshot = httpsCallable<{ centerId: string }, GenerateOpenClawSnapshotResult>(
        functions,
        'generateOpenClawSnapshot',
        { timeout: 600000 }
      );
      const result = await generateSnapshot({ centerId });
      const generatedLabel = result.data.generatedAt
        ? format(new Date(result.data.generatedAt), 'MM.dd HH:mm')
        : '방금';

      toast({
        title: 'OpenClaw 스냅샷 생성 완료',
        description: `${generatedLabel} · ${formatOpenClawCountSummary(result.data.recordCounts)}`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'OpenClaw 스냅샷 생성 실패',
        description: getCallableErrorMessage(error, 'OpenClaw 스냅샷 생성 중 오류가 발생했습니다.'),
      });
    } finally {
      setIsOpenClawExporting(false);
    }
  };

  const parentTrustRows = useMemo(() => {
    if (!isMounted) return [];

    const dayMs = 24 * 60 * 60 * 1000;
    const thirtyDaysAgoMs = now - (30 * dayMs);
    const parentMemberMap = new Map<string, CenterMembership>(
      (parentMembers || []).map((member) => [member.id, member])
    );
    const memberCanonicalKeyById = new Map<string, string>();
    const canonicalKeyByPhone = new Map<string, string>();

    (parentMembers || []).forEach((member) => {
      const normalizedPhone = normalizePhoneNumber(member.phoneNumber);
      const canonicalKey = normalizedPhone || member.id;
      memberCanonicalKeyById.set(member.id, canonicalKey);
      if (normalizedPhone) {
        canonicalKeyByPhone.set(normalizedPhone, canonicalKey);
      }
    });

    const buckets = new Map<string, {
      bucketKey: string;
      parentUid: string;
      parentUids: Set<string>;
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

    const resolveCanonicalParentKey = (params: {
      parentUid?: string | null;
      phoneNumber?: string | null;
    }) => {
      const normalizedPhone = normalizePhoneNumber(params.phoneNumber);
      if (params.parentUid && memberCanonicalKeyById.has(params.parentUid)) {
        return memberCanonicalKeyById.get(params.parentUid)!;
      }
      if (normalizedPhone && canonicalKeyByPhone.has(normalizedPhone)) {
        return canonicalKeyByPhone.get(normalizedPhone)!;
      }
      return normalizedPhone || params.parentUid || '';
    };

    const ensureBucket = ({
      parentUid,
      phoneNumber,
      parentName,
      linkedStudentIds,
    }: {
      parentUid?: string | null;
      phoneNumber?: string | null;
      parentName?: string | null;
      linkedStudentIds?: string[];
    }) => {
      const canonicalKey = resolveCanonicalParentKey({ parentUid, phoneNumber });
      if (!canonicalKey) return null;

      let bucket = buckets.get(canonicalKey);
      if (bucket) return bucket;
      const parentMember = (parentUid && parentMemberMap.get(parentUid))
        || (parentUid
          ? (parentMembers || []).find((member) => member.id === parentUid)
          : undefined)
        || (linkedStudentIds && linkedStudentIds.length > 0
          ? (parentMembers || []).find((member) => (member.linkedStudentIds || []).some((id) => linkedStudentIds.includes(id)))
          : undefined);
      const resolvedPhone = normalizePhoneNumber(phoneNumber) || normalizePhoneNumber(parentMember?.phoneNumber);
      bucket = {
        bucketKey: canonicalKey,
        parentUid: parentUid || parentMember?.id || canonicalKey,
        parentUids: new Set([parentUid, parentMember?.id].filter((value): value is string => Boolean(value))),
        parentName: parentMember?.displayName || (parentName || '').trim(),
        parentPhone: resolvedPhone || '',
        studentIds: new Set(linkedStudentIds || parentMember?.linkedStudentIds || []),
        visitCount: 0,
        reportReadCount: 0,
        consultationEventCount: 0,
        consultationDocCount: 0,
        requestCount: 0,
        suggestionCount: 0,
        latestVisitMs: 0,
        latestInteractionMs: 0,
      };
      buckets.set(canonicalKey, bucket);
      return bucket;
    };

    (parentMembers || []).forEach((member) => {
      const linkedIds = member.linkedStudentIds || [];
      if (linkedIds.length > 0 && !linkedIds.some((id) => targetMemberIds.has(id))) return;
      ensureBucket({
        parentUid: member.id,
        phoneNumber: member.phoneNumber,
        parentName: member.displayName,
        linkedStudentIds: linkedIds,
      });
    });

    (parentActivityEvents || []).forEach((event) => {
      const createdAtMs = (event.createdAt as any)?.toMillis?.() ?? 0;
      if (createdAtMs < thirtyDaysAgoMs) return;
      if (!targetMemberIds.has(event.studentId)) return;
      if (!event.parentUid) return;

      const bucket = ensureBucket({
        parentUid: event.parentUid,
        phoneNumber: event.metadata?.parentPhone,
        parentName: event.metadata?.parentName,
        linkedStudentIds: [event.studentId],
      });
      if (!bucket) return;
      bucket.parentUids.add(event.parentUid);
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
        bucket.parentPhone = normalizePhoneNumber(metaPhone);
      }
    });

    (parentCommunications || []).forEach((item: any) => {
      const createdAtMs = item?.createdAt?.toMillis?.() ?? item?.updatedAt?.toMillis?.() ?? 0;
      if (createdAtMs < thirtyDaysAgoMs) return;
      if (!targetMemberIds.has(item.studentId)) return;
      if (!item.parentUid) return;

      const bucket = ensureBucket({
        parentUid: item.parentUid,
        phoneNumber: item.parentPhone,
        parentName: item.parentName,
        linkedStudentIds: [item.studentId],
      });
      if (!bucket) return;
      bucket.parentUids.add(item.parentUid);
      bucket.studentIds.add(item.studentId);
      bucket.latestInteractionMs = Math.max(bucket.latestInteractionMs, createdAtMs);

      if (item.type === 'consultation') bucket.consultationDocCount += 1;
      if (item.type === 'request') bucket.requestCount += 1;
      if (item.type === 'suggestion') bucket.suggestionCount += 1;

      if (!bucket.parentName && typeof item.parentName === 'string' && item.parentName.trim()) {
        bucket.parentName = item.parentName.trim();
      }
      if (!bucket.parentPhone && typeof item.parentPhone === 'string' && item.parentPhone.trim()) {
        bucket.parentPhone = normalizePhoneNumber(item.parentPhone);
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
        .map((id) => studentNameById.get(id) || toSafeStudentName(undefined, id))
        .sort((a, b) => a.localeCompare(b, 'ko'));

      const parentName = bucket.parentName || `학부모-${bucket.parentUid.slice(0, 6)}`;

      return {
        bucketKey: bucket.bucketKey,
        parentUid: bucket.parentUid,
        parentUids: Array.from(bucket.parentUids),
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
      const parentUidText = row.parentUids.join(' ').toLowerCase();
      return (
        row.parentName.toLowerCase().includes(keyword)
        || row.parentPhone.toLowerCase().includes(keyword)
        || studentsText.includes(keyword)
        || parentUidText.includes(keyword)
      );
    });
  }, [parentTrustRows, parentTrustSearch]);

  const parentContactRecommendations = useMemo(
    () => parentTrustRows.filter((row) => row.priority !== '안정').slice(0, 5),
    [parentTrustRows]
  );

  const currentlyStudyingStudents = useMemo(() => {
    return Object.values(attendanceSeatSignalsBySeatId || {})
      .filter((signal) => Boolean(signal && signal.seatStatus === 'studying'))
      .sort((a, b) => {
        const roomOrderA = roomOrderById.get(a.roomId || '') ?? Number.MAX_SAFE_INTEGER;
        const roomOrderB = roomOrderById.get(b.roomId || '') ?? Number.MAX_SAFE_INTEGER;
        if (roomOrderA !== roomOrderB) return roomOrderA - roomOrderB;

        const seatNoA = a.roomSeatNo ?? Number.MAX_SAFE_INTEGER;
        const seatNoB = b.roomSeatNo ?? Number.MAX_SAFE_INTEGER;
        if (seatNoA !== seatNoB) return seatNoA - seatNoB;

        return a.studentName.localeCompare(b.studentName, 'ko');
      })
      .map((signal) => ({
        ...signal,
        roomLabel:
          signal.roomId && signal.roomSeatNo
            ? `${roomNameById.get(signal.roomId) || signal.roomId} ${signal.roomSeatNo}번`
            : '좌석 확인중',
      }));
  }, [attendanceSeatSignalsBySeatId, roomNameById, roomOrderById]);

  const handleCreateAnnouncement = async () => {
    if (!firestore || !centerId || !activeMembership) return;
    const title = noticeTitle.trim();
    const body = noticeBody.trim();
    if (!title || !body) {
      toast({
        variant: 'destructive',
        title: '입력 확인',
        description: '공지 제목과 내용을 모두 입력해 주세요.',
      });
      return;
    }

    setIsNoticeSubmitting(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'centerAnnouncements'), {
        title,
        body,
        audience: noticeAudience,
        status: 'published',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdByUid: activeMembership.id,
        createdByRole: activeMembership.role,
      });
      setNoticeTitle('');
      setNoticeBody('');
      setIsAnnouncementDialogOpen(false);
      toast({ title: '공지사항 등록 완료', description: '학부모 소통창에 즉시 반영됩니다.' });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: '공지사항 등록 실패',
        description: '잠시 후 다시 시도해 주세요.',
      });
    } finally {
      setIsNoticeSubmitting(false);
    }
  };

  // --- 실시간 KPI 엔진 ---
  const clampScore = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
  const getLiveRoundedMinutes = (seat?: AttendanceCurrent | null) => {
    if (seat?.status !== 'studying' || !seat.lastCheckInAt) return 0;
    const elapsed = Math.max(0, Math.floor((liveTickMs - seat.lastCheckInAt.toMillis()) / 60000));
    return Math.floor(elapsed / 10) * 10;
  };

  const calculateStudentFocusScore = (stat?: DailyStudentStat | null, progress?: GrowthProgress | null) => {
    const studyMinutes = Math.max(0, stat?.totalStudyMinutes || 0);
    const completionRate = clampScore(stat?.todayPlanCompletionRate || 0);
    const growthRate = Number(stat?.studyTimeGrowthRate || 0);
    const focusStat = clampScore(progress?.stats?.focus || 0);
    const penaltyPoints = Math.max(0, progress?.penaltyPoints || 0);

    const studyScore = clampScore((studyMinutes / 180) * 100);
    const growthScore = clampScore(70 + growthRate * 120);
    const penaltyScore = clampScore(100 - penaltyPoints * 2);

    const raw =
      focusStat * 0.30 +
      completionRate * 0.25 +
      studyScore * 0.20 +
      growthScore * 0.15 +
      penaltyScore * 0.10;

    return Math.round(clampScore(raw));
  };

  const focusLevelMeta = (score: number) => {
    if (score >= 90) return { label: '매우 좋음', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    if (score >= 75) return { label: '안정적', badgeClass: 'bg-blue-100 text-blue-700 border-blue-200' };
    if (score >= 60) return { label: '흔들림 있음', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: '집중 관리 필요', badgeClass: 'bg-rose-100 text-rose-700 border-rose-200' };
  };

  const metrics = useMemo(() => {
    if (!activeMembers || !attendanceList || !isMounted || !progressList) return EMPTY_ADMIN_METRICS;

    let totalTodayMins = 0;
    let highRiskCount = 0;

    filteredStudentMembers.forEach(member => {
      const studentStat = todayStats?.find(s => s.studentId === member.id);
      const studentProgress = progressList.find(p => p.id === member.id);
      const seat = attendanceList.find(a => a.studentId === member.id);
      const liveSession = getLiveRoundedMinutes(seat);
      let cumulative = (studentStat?.totalStudyMinutes || 0) + liveSession;

      totalTodayMins += cumulative;

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

    const filteredYesterdayStats = yesterdayStats?.filter((s) => targetMemberIds.has(s.studentId)) || [];
    const todayFocusScores = filteredStudentMembers.map((member) => {
      const studentStat = filteredTodayStats.find((s) => s.studentId === member.id);
      const studentProgress = progressList.find((p) => p.id === member.id);
      return calculateStudentFocusScore(studentStat, studentProgress);
    });
    const yesterdayFocusScores = filteredStudentMembers.map((member) => {
      const studentStat = filteredYesterdayStats.find((s) => s.studentId === member.id);
      const studentProgress = progressList.find((p) => p.id === member.id);
      return calculateStudentFocusScore(studentStat, studentProgress);
    });

    const avgFocusScore = todayFocusScores.length > 0
      ? Math.round(todayFocusScores.reduce((sum, score) => sum + score, 0) / todayFocusScores.length)
      : 0;
    const prevAvgFocusScore = yesterdayFocusScores.length > 0
      ? Math.round(yesterdayFocusScores.reduce((sum, score) => sum + score, 0) / yesterdayFocusScores.length)
      : 0;
    const focusDelta = avgFocusScore - prevAvgFocusScore;
    const focusLevel = focusLevelMeta(avgFocusScore);

    const avgStudyMinutes = filteredTodayStats.length > 0
      ? Math.round(filteredTodayStats.reduce((sum, item) => sum + (item.totalStudyMinutes || 0), 0) / filteredTodayStats.length)
      : 0;
    const avgGrowthRate = filteredTodayStats.length > 0
      ? Number((filteredTodayStats.reduce((sum, item) => sum + (item.studyTimeGrowthRate || 0), 0) / filteredTodayStats.length).toFixed(2))
      : 0;
    const awayDurations = attendanceList
      .filter((seat) => seat.studentId && targetMemberIds.has(seat.studentId) && (seat.status === 'away' || seat.status === 'break') && !!seat.lastCheckInAt)
      .map((seat) => Math.max(0, Math.floor((now - seat.lastCheckInAt!.toMillis()) / 60000)));
    const avgAwayMinutes = awayDurations.length > 0
      ? Math.round(awayDurations.reduce((sum, value) => sum + value, 0) / awayDurations.length)
      : 0;
    const highPenaltyCount = filteredStudentMembers.filter((member) => {
      const progress = progressList.find((p) => p.id === member.id);
      return (progress?.penaltyPoints || 0) >= 10;
    }).length;
    const lowCompletionCount = filteredTodayStats.filter((item) => (item.todayPlanCompletionRate || 0) < 60).length;

    const focusStrengths: string[] = [];
    const focusRisks: string[] = [];
    const focusActions: string[] = [];

    if (avgCompletion >= 80) focusStrengths.push(`평균 계획 완료율 ${avgCompletion}%로 실행력이 좋습니다.`);
    if (avgAwayMinutes <= 15) focusStrengths.push(`외출 평균시간 ${avgAwayMinutes}분으로 학습 흐름 이탈이 낮습니다.`);
    if (avgGrowthRate >= 0.05) focusStrengths.push('전일 대비 학습 성장률이 상승 흐름입니다.');
    if (avgStudyMinutes < 120 && avgFocusScore >= 75) focusStrengths.push('학습시간이 길지 않아도 집중 품질이 유지되고 있습니다.');

    if (lowCompletionCount > 0) focusRisks.push(`완료율 60% 미만 학생이 ${lowCompletionCount}명입니다.`);
    if (highPenaltyCount > 0) focusRisks.push(`벌점 10점 이상 학생이 ${highPenaltyCount}명입니다.`);
    if (avgGrowthRate <= -0.1) focusRisks.push('학습 성장률이 하락 구간입니다.');
    if (avgFocusScore < 60) focusRisks.push('센터 평균 집중도가 관리 구간으로 내려갔습니다.');

    if (lowCompletionCount > 0) focusActions.push('내일 계획 수를 3~4개 핵심 과제로 축소해 완료율을 먼저 회복하세요.');
    if (highPenaltyCount > 0) focusActions.push('벌점 누적 학생은 첫 90분 밀착 체크로 이탈을 줄이세요.');
    if (avgGrowthRate <= -0.1) focusActions.push('초반 60분 단일 과목 고정 운영으로 첫 이탈 시간을 늘려보세요.');
    if (focusActions.length === 0) focusActions.push('현재 리듬을 유지하면서 오답 복습 루틴 점검만 추가하세요.');

    const filteredReports = (dailyReports || []).filter(
      (report): report is DailyReport => Boolean(report) && targetMemberIds.has(report.studentId)
    );
    const sentReports = filteredReports.filter((report) => report?.status === 'sent');

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
    const recentWebsiteConsultRequests = (websiteConsultRequests || []).filter((item: any) => {
      const createdAtMs = item?.createdAt?.toMillis?.() ?? item?.updatedAt?.toMillis?.() ?? 0;
      return createdAtMs >= thirtyDaysAgoMs;
    });
    const recentWebsiteLeadIds = new Set(
      recentWebsiteConsultRequests
        .map((item: any) => item?.linkedLeadId)
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    );
    const manualLeadCount30d = (consultingLeads || []).filter((lead: any) => {
      const createdAtMs = lead?.createdAt?.toMillis?.() ?? lead?.updatedAt?.toMillis?.() ?? 0;
      if (createdAtMs < thirtyDaysAgoMs) return false;
      if (recentWebsiteLeadIds.has(lead?.id || '')) return false;
      return !(lead?.source === 'website' || lead?.sourceRequestId);
    }).length;
    const leadPipelineCount30d = recentWebsiteConsultRequests.length + manualLeadCount30d;

    const reportReadCount30d = recentParentEvents.filter((event) => event.eventType === 'report_read').length;
    const focusRows = filteredStudentMembers.map((member) => {
      const studentStat = filteredTodayStats.find((s) => s.studentId === member.id);
      const studentProgress = progressList.find((p) => p.id === member.id);
      const seat = attendanceList.find((a) => a.studentId === member.id);
      const liveSession = getLiveRoundedMinutes(seat);
      const todayMinutes = Math.max(0, Math.round((studentStat?.totalStudyMinutes || 0) + liveSession));
      const weeklyMinutes = Math.max(
        0,
        Math.round((weeklyStudyMinutesByStudent[member.id] || 0) + liveSession)
      );
      const score = calculateStudentFocusScore(studentStat, studentProgress);
      return {
        studentId: member.id,
        name: toSafeStudentName(member.displayName, member.id),
        className: member.className || '-',
        score,
        completion: Math.round(studentStat?.todayPlanCompletionRate || 0),
        studyMinutes: weeklyMinutes,
        todayMinutes,
      };
    }).sort((a, b) => b.studyMinutes - a.studyMinutes);

    const focusTop10 = focusRows.slice(0, 10);
    const focusBottom10 = [...focusRows].reverse().slice(0, 10);

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
      leadPipelineCount30d,
      consultationRiskIndex30d: activeParentCount30d > 0
        ? Math.min(100, Math.round((consultationRequestCount30d / activeParentCount30d) * 100))
        : 0,
      reportReadCount30d,
      focusKpi: {
        score: avgFocusScore,
        levelLabel: focusLevel.label,
        levelBadgeClass: focusLevel.badgeClass,
        delta: focusDelta,
        completion: avgCompletion,
        avgStudyMinutes,
        avgAwayMinutes,
        avgGrowthRate,
        highPenaltyCount,
        lowCompletionCount,
        strengths: focusStrengths.slice(0, 2),
        risks: focusRisks.slice(0, 2),
        actions: focusActions.slice(0, 2),
      },
      focusRows,
      focusTop10,
      focusBottom10,
    };
  }, [activeMembers, attendanceList, todayStats, yesterdayStats, dailyReports, progressList, parentActivityEvents, parentCommunications, consultingLeads, websiteConsultRequests, targetMemberIds, filteredStudentMembers, now, isMounted, weeklyStudyMinutesByStudent, liveTickMs]);

  const recentAnnouncementsPreview = (centerAnnouncements || []).slice(0, 3);
  const topFocusPreview = metrics.focusTop10.slice(0, 4);
  const bottomFocusPreview = metrics.focusBottom10.slice(0, 4);

  const selectedFocusStudent = useMemo(() => {
    if (!selectedFocusStudentId || !metrics) return null;
    return (
      metrics.focusRows.find((row) => row.studentId === selectedFocusStudentId)
      || metrics.focusBottom10.find((row) => row.studentId === selectedFocusStudentId)
      || null
    );
  }, [metrics, selectedFocusStudentId]);

  const selectedFocusStat = useMemo(
    () => (selectedFocusStudentId ? (todayStats || []).find((row) => row.studentId === selectedFocusStudentId) || null : null),
    [todayStats, selectedFocusStudentId]
  );

  const selectedFocusProgress = useMemo(
    () => (selectedFocusStudentId ? (progressList || []).find((row) => row.id === selectedFocusStudentId) || null : null),
    [progressList, selectedFocusStudentId]
  );

  const selectedFocusBreakdown = useMemo(() => {
    if (!selectedFocusStudent) return null;
    const completionRate = clampScore(selectedFocusStat?.todayPlanCompletionRate || 0);
    const studyMinutes = Math.max(0, selectedFocusStat?.totalStudyMinutes || selectedFocusStudent.studyMinutes || 0);
    const growthRate = Number(selectedFocusStat?.studyTimeGrowthRate || 0);
    const focusStat = clampScore(selectedFocusProgress?.stats?.focus || 0);
    const penaltyPoints = Math.max(0, selectedFocusProgress?.penaltyPoints || 0);

    const studyScore = clampScore((studyMinutes / 180) * 100);
    const growthScore = clampScore(70 + growthRate * 120);
    const penaltyScore = clampScore(100 - penaltyPoints * 2);

    const weighted = {
      focus: Math.round(focusStat * 0.3),
      completion: Math.round(completionRate * 0.25),
      study: Math.round(studyScore * 0.2),
      growth: Math.round(growthScore * 0.15),
      penalty: Math.round(penaltyScore * 0.1),
    };

    return {
      focusStat,
      completionRate,
      studyScore,
      growthScore,
      penaltyScore,
      weighted,
    };
  }, [selectedFocusStudent, selectedFocusStat, selectedFocusProgress]);

  const focusStudentTrend = useMemo(() => {
    const progress = progressList?.find((p) => p.id === selectedFocusStudentId);
    const minutesByDateKey = new Map(
      (focusStudyLogDaysRaw || []).map((row) => [row.dateKey, Math.round(row.totalMinutes || 0)])
    );
    const statByDateKey = new Map(
      (focusStudentTrendRaw || [])
        .filter((row) => typeof row.dateKey === 'string' && row.dateKey.length > 0)
        .map((row) => [row.dateKey, row])
    );

    const baseDate = today || new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const day = subDays(baseDate, 6 - index);
      const dateKey = format(day, 'yyyy-MM-dd');
      const stat = statByDateKey.get(dateKey);
      const minutes = minutesByDateKey.get(dateKey) ?? Math.round(stat?.totalStudyMinutes || 0);
      const score = stat
        ? calculateStudentFocusScore(
            {
              ...stat,
              totalStudyMinutes: minutes,
            },
            progress
          )
        : 0;
      return {
        date: format(day, 'MM/dd'),
        score,
        completion: stat ? Math.round(stat.todayPlanCompletionRate || 0) : 0,
        minutes,
      };
    });
  }, [focusStudentTrendRaw, focusStudyLogDaysRaw, progressList, selectedFocusStudentId, today]);

  // ── 선택 학생 세션 데이터 로드 (시작시간 분포·외출시간 산출용) ──
  useEffect(() => {
    if (!firestore || !centerId || !selectedFocusStudentId || !today) {
      setFocusDayData({});
      return;
    }
    let disposed = false;
    const loadDayData = async () => {
      setDayDataLoading(true);
      try {
        const last14Days = Array.from({ length: 14 }, (_, i) => format(subDays(today, i), 'yyyy-MM-dd'));
        const daySummaryByDateKey = new Map(
          (focusStudyLogDaysRaw || []).map((row) => [row.dateKey, row])
        );
        const result: Record<string, { awayMinutes: number; startHour: number | null; endHour: number | null }> = {};
        const fallbackDateKeys: string[] = [];

        last14Days.forEach((dateKey) => {
          const daySummary = daySummaryByDateKey.get(dateKey);
          if (!daySummary) {
            result[dateKey] = { awayMinutes: 0, startHour: null, endHour: null };
            return;
          }

          const firstSessionStartAt = toTimestampDateSafe(daySummary.firstSessionStartAt);
          const lastSessionEndAt = toTimestampDateSafe(daySummary.lastSessionEndAt);
          const awayMinutes = Number(daySummary.awayMinutes || 0);

          if (firstSessionStartAt && lastSessionEndAt) {
            result[dateKey] = {
              awayMinutes: Math.max(0, Math.round(awayMinutes)),
              startHour: firstSessionStartAt.getHours() + (firstSessionStartAt.getMinutes() / 60),
              endHour: lastSessionEndAt.getHours() + (lastSessionEndAt.getMinutes() / 60),
            };
            return;
          }

          fallbackDateKeys.push(dateKey);
        });

        await Promise.all(fallbackDateKeys.map(async (dateKey) => {
          try {
            const sessionsRef = collection(firestore, 'centers', centerId, 'studyLogs', selectedFocusStudentId, 'days', dateKey, 'sessions');
            const snap = await getDocs(query(sessionsRef, orderBy('startTime')));
            if (snap.empty) { result[dateKey] = { awayMinutes: 0, startHour: null, endHour: null }; return; }
            const sessions = snap.docs.map((d) => {
              const raw = d.data() as any;
              return {
                startTime: (raw.startTime as Timestamp).toDate(),
                endTime: (raw.endTime as Timestamp).toDate(),
              };
            }).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
            const firstSession = sessions[0];
            const lastSession = sessions[sessions.length - 1];
            const startHour = firstSession.startTime.getHours() + (firstSession.startTime.getMinutes() / 60);
            const endHour = lastSession.endTime.getHours() + (lastSession.endTime.getMinutes() / 60);
            let awayMinutes = 0;
            for (let i = 1; i < sessions.length; i++) {
              const gap = (sessions[i].startTime.getTime() - sessions[i - 1].endTime.getTime()) / 60000;
              if (gap > 0 && gap < 180) awayMinutes += Math.round(gap);
            }
            result[dateKey] = { awayMinutes, startHour, endHour };
          } catch { result[dateKey] = { awayMinutes: 0, startHour: null, endHour: null }; }
        }));
        if (!disposed) setFocusDayData(result);
      } catch { if (!disposed) setFocusDayData({}); }
      finally { if (!disposed) setDayDataLoading(false); }
    };
    loadDayData();
    return () => { disposed = true; };
  }, [firestore, centerId, selectedFocusStudentId, today, focusStudyLogDaysRaw]);

  // ── 4 KPI 그래프 데이터 계산 ──

  // 1) 주간 학습시간 성장률 (최근 6주)
  const weeklyGrowthData = useMemo(() => {
    if (!focusStudyLogDaysRaw || !today) return [];
    const minutesByDateKey = new Map(
      (focusStudyLogDaysRaw || []).map((row) => [row.dateKey, Math.round(row.totalMinutes || 0)])
    );
    const weeks = Array.from({ length: 6 }, (_, weekIdx) => {
      const weekEnd = subDays(today, weekIdx * 7);
      const weekDays = Array.from({ length: 7 }, (_, d) => format(subDays(weekEnd, d), 'yyyy-MM-dd'));
      const totalMinutes = weekDays.reduce((sum, dateKey) => sum + (minutesByDateKey.get(dateKey) ?? 0), 0);
      return { label: `${format(subDays(today, (weekIdx + 1) * 7), 'M/d')}~`, totalMinutes };
    }).reverse();
    return weeks.map((week, i, arr) => {
      const growth = i > 0 && arr[i - 1].totalMinutes > 0
        ? Math.round((week.totalMinutes - arr[i - 1].totalMinutes) / arr[i - 1].totalMinutes * 100) : 0;
      return { ...week, growth };
    });
  }, [focusStudyLogDaysRaw, today]);

  // 2) 일자별 학습시간 성장률 (최근 6주, 7일 단위로 조회)
  const dailyGrowthData = useMemo(() => {
    if (!today) return [];
    const minutesByDateKey = new Map(
      (focusStudyLogDaysRaw || []).map((row) => [row.dateKey, Math.round(row.totalMinutes || 0)])
    );

    const series = Array.from({ length: 42 }, (_, idx) => {
      const day = subDays(today, 41 - idx);
      const dateKey = format(day, 'yyyy-MM-dd');
      const minutes = minutesByDateKey.get(dateKey) ?? 0;
      return {
        dateKey,
        label: format(day, 'M/d'),
        minutes,
        avgMinutes: minutes,
      };
    });

    return series.map((item, index) => {
      if (index === 0) return { ...item, growth: 0 };
      const prev = series[index - 1].minutes;
      const growth = prev > 0 ? Math.round(((item.minutes - prev) / prev) * 100) : 0;
      return { ...item, growth };
    });
  }, [focusStudyLogDaysRaw, today]);

  // 3) 학습 시간 분포 리듬 (요일별 평균 시작/종료시각)
  const rhythmData = useMemo(() => {
    if (!today) return [];
    const DOW = ['월', '화', '수', '목', '금', '토', '일'];
    const buckets = Array(7).fill(null).map((_, i) => ({
      label: DOW[i],
      startTotal: 0,
      startCount: 0,
      endTotal: 0,
      endCount: 0,
    }));

    Array.from({ length: 14 }, (_, i) => format(subDays(today, i), 'yyyy-MM-dd')).forEach((dateKey) => {
      const dayData = focusDayData[dateKey];
      if (!dayData) return;
      const dow = (new Date(dateKey + 'T12:00:00').getDay() + 6) % 7; // 0=Mon
      if (typeof dayData.startHour === 'number') {
        buckets[dow].startTotal += dayData.startHour;
        buckets[dow].startCount += 1;
      }
      if (typeof dayData.endHour === 'number') {
        buckets[dow].endTotal += dayData.endHour;
        buckets[dow].endCount += 1;
      }
    });
    return buckets.map((b) => ({
      label: b.label,
      startHour: b.startCount > 0 ? Number((b.startTotal / b.startCount).toFixed(1)) : 0,
      endHour: b.endCount > 0 ? Number((b.endTotal / b.endCount).toFixed(1)) : 0,
    }));
  }, [focusDayData, today]);

  // 4) 학습 중간 외출시간 추이 (14일)
  const awayTimeData = useMemo(() => {
    if (!today) return [];
    return Array.from({ length: 14 }, (_, i) => {
      const dateKey = format(subDays(today, 13 - i), 'yyyy-MM-dd');
      return { date: format(subDays(today, 13 - i), 'M/d'), awayMinutes: focusDayData[dateKey]?.awayMinutes ?? 0 };
    });
  }, [focusDayData, today]);

  const rhythmScoreTrendData = useMemo(() => {
    if (!today) return [] as Array<{ date: string; score: number }>;
    const dailyRhythm = Array.from({ length: 14 }, (_, i) => {
      const day = subDays(today, 13 - i);
      const dateKey = format(day, 'yyyy-MM-dd');
      const startHour = focusDayData[dateKey]?.startHour;
      return {
        date: format(day, 'M/d'),
        rhythmMinutes: typeof startHour === 'number' ? Math.round(startHour * 60) : null as number | null,
      };
    });
    return dailyRhythm.map((point, index) => {
      const values = dailyRhythm
        .slice(Math.max(0, index - 2), index + 1)
        .map((item) => item.rhythmMinutes)
        .filter((value): value is number => typeof value === 'number');
      const score = values.length >= 2 ? calculateRhythmScoreFromMinutes(values) : values.length === 1 ? 100 : 0;
      return { date: point.date, score };
    });
  }, [focusDayData, today]);

  const hasWeeklyGrowthData = weeklyGrowthData.some((week) => (week.totalMinutes ?? 0) > 0);
  const hasDailyGrowthData = dailyGrowthData.some((day) => (day.minutes ?? 0) > 0);
  const hasRhythmScoreChangeData = rhythmScoreTrendData.some((day) => (day.score ?? 0) > 0);
  const averageRhythmScore = useMemo(() => {
    const valid = rhythmScoreTrendData.filter((day) => day.score > 0);
    if (!valid.length) return 0;
    return Math.round(valid.reduce((sum, day) => sum + day.score, 0) / valid.length);
  }, [rhythmScoreTrendData]);
  const hasRhythmData = rhythmData.some((day) => (day.startHour ?? 0) > 0 || (day.endHour ?? 0) > 0);
  const previous7AvgStudyMinutes = useMemo(() => {
    if (!today) return 0;
    const prev7DateKeys = Array.from({ length: 7 }, (_, i) => format(subDays(today, i + 1), 'yyyy-MM-dd'));
    const prev7Rows = (focusStudentTrendRaw || []).filter((row) => prev7DateKeys.includes(row.dateKey));
    if (prev7Rows.length === 0) return 0;
    return Math.round(prev7Rows.reduce((sum, row) => sum + (row.totalStudyMinutes || 0), 0) / prev7Rows.length);
  }, [focusStudentTrendRaw, today]);
  const todayStudyMinutes = Math.round(selectedFocusStudent?.todayMinutes ?? selectedFocusStat?.totalStudyMinutes ?? 0);
  const todayLearningGrowthPercent = previous7AvgStudyMinutes > 0
    ? Math.round(((todayStudyMinutes - previous7AvgStudyMinutes) / previous7AvgStudyMinutes) * 100)
    : 0;
  const latestWeeklyLearningGrowthPercent = weeklyGrowthData.length > 0
    ? (weeklyGrowthData[weeklyGrowthData.length - 1]?.growth ?? 0)
    : 0;
  const dailyGrowthWindowCount = Math.max(1, Math.ceil(dailyGrowthData.length / 7));
  const boundedDailyGrowthWindowIndex = Math.min(Math.max(0, dailyGrowthWindowIndex), dailyGrowthWindowCount - 1);
  const dailyGrowthWindowData = useMemo(() => {
    if (dailyGrowthData.length === 0) return [];
    const end = dailyGrowthData.length - (boundedDailyGrowthWindowIndex * 7);
    const start = Math.max(0, end - 7);
    return dailyGrowthData.slice(start, end);
  }, [dailyGrowthData, boundedDailyGrowthWindowIndex]);

  useEffect(() => {
    setDailyGrowthWindowIndex(0);
  }, [selectedFocusStudentId]);

  // ── 선택 학생 통합 KPI 계산 ──
  const selectedFocusKpi = useMemo(() => {
    if (!selectedFocusStudent) return null;

    const trend = focusStudentTrend;
    const todayScore = selectedFocusStudent.score;
    const growthRate = selectedFocusStat?.studyTimeGrowthRate ?? 0;
    const penaltyPoints = selectedFocusProgress?.penaltyPoints ?? 0;
    const consistencyStat = selectedFocusProgress?.stats?.consistency ?? 0;

    // 7일 평균 (학습 데이터 있는 날만)
    const activeDays = trend.filter((d) => d.score > 0);
    // 주간 성장률: 주 초반(0~2일) vs 주 후반(4~6일)
    const firstHalf = trend.slice(0, 3).filter((d) => d.score > 0);
    const lastHalf = trend.slice(4).filter((d) => d.score > 0);
    const firstHalfAvg = firstHalf.length > 0
      ? firstHalf.reduce((sum, d) => sum + d.score, 0) / firstHalf.length : 0;
    const lastHalfAvg = lastHalf.length > 0
      ? lastHalf.reduce((sum, d) => sum + d.score, 0) / lastHalf.length : 0;
    const weekGrowthRate = firstHalfAvg > 0
      ? Math.round(((lastHalfAvg - firstHalfAvg) / firstHalfAvg) * 100) : 0;

    // 최고/최저 집중일
    const bestDay = activeDays.length > 0
      ? activeDays.reduce((best, d) => d.score > best.score ? d : best)
      : null;
    const worstDay = activeDays.length > 0
      ? activeDays.reduce((worst, d) => d.score < worst.score ? d : worst)
      : null;

    // 학습시간 통계
    const activeMins = trend.filter((d) => d.minutes > 0);
    const avgMinutes = activeMins.length > 0
      ? Math.round(activeMins.reduce((sum, d) => sum + d.minutes, 0) / activeMins.length)
      : 0;
    const maxMinutes = activeMins.length > 0 ? Math.max(...activeMins.map((d) => d.minutes)) : 0;

    // 트렌드 방향: 최근 3일 vs 첫 3일
    const recent3 = trend.slice(-3).filter((d) => d.score > 0).map((d) => d.score);
    const older3 = trend.slice(0, 3).filter((d) => d.score > 0).map((d) => d.score);
    const recent3Avg = recent3.length > 0 ? recent3.reduce((s, v) => s + v, 0) / recent3.length : 0;
    const older3Avg = older3.length > 0 ? older3.reduce((s, v) => s + v, 0) / older3.length : 0;
    const trendDirection: 'up' | 'down' | 'stable' =
      recent3Avg > older3Avg + 5 ? 'up' : recent3Avg < older3Avg - 5 ? 'down' : 'stable';

    // 위험도 판정
    const isHighRisk = todayScore < 60 || growthRate <= -0.2 || penaltyPoints >= 10;
    const isMediumRisk = !isHighRisk && (todayScore < 75 || growthRate <= -0.1 || selectedFocusStudent.completion < 60);
    const riskStatus = isHighRisk
      ? { label: '위험', badgeClass: 'bg-rose-500 text-white border-none' }
      : isMediumRisk
        ? { label: '주의', badgeClass: 'bg-amber-400 text-white border-none' }
        : { label: '안정', badgeClass: 'bg-emerald-500 text-white border-none' };

    // 위험 신호
    const riskAlerts: string[] = [];
    if (growthRate <= -0.2) riskAlerts.push(`학습 성장률 ${Math.round(growthRate * 100)}%로 급감했습니다. 즉각 면담이 필요합니다.`);
    else if (growthRate <= -0.1) riskAlerts.push(`학습 성장률 ${Math.round(growthRate * 100)}% 하락 중입니다. 원인 파악이 필요합니다.`);
    if (todayScore < 60) riskAlerts.push('오늘 학습 흐름이 불안정합니다. 집중 관리 구간입니다.');
    if (penaltyPoints >= 10) riskAlerts.push(`벌점 ${penaltyPoints}점으로 기준치(10점) 초과. 규정 점검이 필요합니다.`);
    if (selectedFocusStudent.completion < 50) riskAlerts.push(`계획 완료율 ${selectedFocusStudent.completion}% — 목표 수 조정을 권장합니다.`);
    if (trendDirection === 'down' && activeDays.length >= 3) riskAlerts.push('최근 3일 집중도 지속 하락 추세입니다.');

    // 관리자 인사이트
    const insights: string[] = [];
    if (trendDirection === 'up') insights.push('집중 흐름이 상승 추세입니다. 현재 패턴을 유지하도록 격려해주세요.');
    else if (trendDirection === 'down') insights.push('집중 흐름이 하락 추세입니다. 오늘 면담을 권장합니다.');

    if (weekGrowthRate > 5) insights.push(`주간 성장률 +${weekGrowthRate}%. 주 중반 이후 집중도가 개선되고 있습니다.`);
    else if (weekGrowthRate < -5) insights.push(`주간 성장률 ${weekGrowthRate}%. 주 중반 이후 집중도가 낮아지고 있습니다.`);

    if (selectedFocusStudent.completion >= 80)
      insights.push(`계획 완료율 ${selectedFocusStudent.completion}%로 실행력이 우수합니다. 목표 난이도를 높여볼 수 있습니다.`);
    else if (selectedFocusStudent.completion < 60)
      insights.push(`계획 완료율 ${selectedFocusStudent.completion}%. 오늘 과제를 3~4개로 줄여 성공 경험을 쌓아주세요.`);

    if (avgMinutes > 0)
      insights.push(`7일 평균 학습시간 ${Math.floor(avgMinutes / 60)}h ${avgMinutes % 60}m. 최장 ${Math.floor(maxMinutes / 60)}h ${maxMinutes % 60}m 기록.`);

    if (bestDay && worstDay && bestDay.date !== worstDay.date)
      insights.push(`학습 리듬 최고일 ${bestDay.date} / 최저일 ${worstDay.date} — 리듬 편차가 있습니다.`);

    if (consistencyStat >= 70) insights.push(`꾸준함 스탯 ${Math.round(consistencyStat)}점으로 규칙적인 학습 습관이 형성되어 있습니다.`);
    else if (consistencyStat < 40 && consistencyStat > 0) insights.push(`꾸준함 스탯 ${Math.round(consistencyStat)}점 — 불규칙 패턴. 매일 트랙 시작을 독려해 주세요.`);

    if (penaltyPoints > 0 && penaltyPoints < 10) insights.push(`현재 벌점 ${penaltyPoints}점. 10점 초과 시 학습 지표에 큰 감점이 발생합니다.`);

    if (insights.length === 0) insights.push('현재 안정적인 상태입니다. 정기 모니터링을 유지하세요.');

    return {
      weekGrowthRate,
      bestDay,
      worstDay,
      avgMinutes,
      maxMinutes,
      trendDirection,
      riskStatus,
      riskAlerts,
      insights,
      activeDaysCount: activeDays.length,
      consistencyStat,
    };
  }, [selectedFocusStudent, focusStudentTrend, selectedFocusStat, selectedFocusProgress]);

  const urgentInterventionStudents = useMemo(() => {
    return [...(heatmapInterventionSignals || [])]
      .sort((a, b) => {
        if (a.compositeHealth !== b.compositeHealth) return a.compositeHealth - b.compositeHealth;
        if ((b.effectivePenaltyPoints || 0) !== (a.effectivePenaltyPoints || 0)) {
          return (b.effectivePenaltyPoints || 0) - (a.effectivePenaltyPoints || 0);
        }
        if ((b.currentAwayMinutes || 0) !== (a.currentAwayMinutes || 0)) {
          return (b.currentAwayMinutes || 0) - (a.currentAwayMinutes || 0);
        }
        return (b.todayMinutes || 0) - (a.todayMinutes || 0);
      })
      .slice(0, 6);
  }, [heatmapInterventionSignals]);

  const quickActionLinks = useMemo(
    () => [
      {
        href: '/dashboard/teacher',
        label: '실시간 교실',
        description: '도면과 좌석 상태를 바로 열어 조치합니다.',
        icon: LayoutGrid,
      },
      {
        href: '/dashboard/teacher/students',
        label: '학생 360',
        description: '학생별 KPI와 원본 로그를 바로 봅니다.',
        icon: Users,
      },
      {
        href: '/dashboard/attendance',
        label: '출결 KPI',
        description: '미처리 요청과 반복 지각 학생을 봅니다.',
        icon: ClipboardCheck,
      },
      {
        href: '/dashboard/settings/notifications',
        label: '문자 콘솔',
        description: '오늘 문자 접수와 비용 흐름을 확인합니다.',
        icon: MessageSquare,
      },
      {
        href: '/dashboard/leads',
        label: '리드 / 상담',
        description: '입학 대기와 상담 후속 관리를 이어갑니다.',
        icon: Megaphone,
      },
      {
        href: '/dashboard/revenue',
        label: '수익 분석',
        description: '수납 경고와 운영 비용 흐름을 봅니다.',
        icon: TrendingUp,
      },
    ],
    []
  );

  const isOpenClawBusy = isOpenClawExporting || openClawIntegration?.status === 'exporting';
  const openClawStatus = isOpenClawBusy ? 'exporting' : openClawIntegration?.status || 'idle';
  const openClawStatusMeta =
    openClawStatus === 'exporting'
      ? {
          label: '생성 중',
          badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
          description: '스냅샷 파일과 상태 문서를 동기화하고 있습니다.',
          icon: Loader2,
          iconClassName: 'animate-spin text-amber-600',
        }
      : openClawStatus === 'success'
        ? {
            label: '정상',
            badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            description: '최근 스냅샷이 정상적으로 저장되었습니다.',
            icon: CheckCircle2,
            iconClassName: 'text-emerald-600',
          }
        : openClawStatus === 'error'
          ? {
              label: '오류',
              badgeClass: 'bg-rose-100 text-rose-700 border-rose-200',
              description: '마지막 생성 시도에서 오류가 발생했습니다.',
              icon: AlertTriangle,
              iconClassName: 'text-rose-600',
            }
          : {
              label: openClawIntegration?.enabled ? '대기' : '미설정',
              badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
              description: openClawIntegration?.enabled
                ? '자동 배치는 켜져 있지만 아직 성공 이력이 없습니다.'
                : '수동 생성 시 자동 배치가 함께 활성화됩니다.',
              icon: History,
              iconClassName: 'text-slate-500',
            };
  const OpenClawStatusIcon = openClawStatusMeta.icon;
  const openClawLastExportLabel = openClawIntegration?.lastExportedAt
    ? format(openClawIntegration.lastExportedAt.toDate(), 'MM.dd HH:mm')
    : '미생성';
  const openClawLastRequestedLabel = openClawIntegration?.lastRequestedAt
    ? format(openClawIntegration.lastRequestedAt.toDate(), 'MM.dd HH:mm')
    : '기록 없음';
  const openClawLatestPathLabel = openClawIntegration?.lastSnapshotPath
    ? openClawIntegration.lastSnapshotPath.replace(`openclaw/centers/${centerId || ''}/`, '')
    : 'history 경로 미생성';
  const isOpenClawActionDisabled = !functions || !centerId || isOpenClawBusy;

  const centerHealthAxes = useMemo(() => {
    return adminHeatmapRows.slice(0, 5).map((row) => {
      const firstScore = row.trend[0]?.score ?? row.summaryScore;
      const lastScore = row.trend[row.trend.length - 1]?.score ?? row.summaryScore;
      const delta = Math.round(lastScore - firstScore);
      const trendLabel = delta > 0 ? '상승' : delta < 0 ? '하락' : '유지';
      const tone =
        row.summaryScore >= 85
          ? {
              badge: 'bg-emerald-100 text-emerald-700',
              card: 'border-emerald-100 bg-[linear-gradient(180deg,#f6fffb_0%,#ffffff_100%)]',
              dot: 'bg-emerald-500',
            }
          : row.summaryScore >= 70
            ? {
                badge: 'bg-sky-100 text-sky-700',
                card: 'border-sky-100 bg-[linear-gradient(180deg,#f5fbff_0%,#ffffff_100%)]',
                dot: 'bg-sky-500',
              }
            : row.summaryScore >= 50
              ? {
                  badge: 'bg-amber-100 text-amber-700',
                  card: 'border-amber-100 bg-[linear-gradient(180deg,#fffaf2_0%,#ffffff_100%)]',
                  dot: 'bg-amber-500',
                }
              : {
                  badge: 'bg-rose-100 text-rose-700',
                  card: 'border-rose-100 bg-[linear-gradient(180deg,#fff6f7_0%,#ffffff_100%)]',
                  dot: 'bg-rose-500',
                };
      return {
        ...row,
        delta,
        trendLabel,
        tone,
      };
    });
  }, [adminHeatmapRows]);

  const todayActionQueue = useMemo(
    () =>
      [
        {
          key: 'intervention',
          title: `즉시 개입 학생 ${urgentInterventionStudents.length}명`,
          detail:
            urgentInterventionStudents[0]
              ? `${urgentInterventionStudents[0].studentName} · ${urgentInterventionStudents[0].topReason}`
              : '좌석 히트맵과 학생 360에서 우선 개입 학생을 먼저 확인하세요.',
          actionLabel: '학생 360',
          href: '/dashboard/teacher/students?showRisk=1#risk-analysis',
          icon: ShieldAlert,
          toneClass: 'bg-rose-100 text-rose-700',
        },
        {
          key: 'attendance',
          title: `미입실·지각 ${attendanceBoardSummary.lateOrAbsentCount}명`,
          detail: '오늘 출결 KPI에서 미입실, 지각 반복 학생을 먼저 확인하세요.',
          actionLabel: '출결 KPI',
          href: '/dashboard/attendance',
          icon: ClipboardCheck,
          toneClass: 'bg-rose-100 text-rose-700',
        },
        {
          key: 'away',
          title: `장기 외출 ${attendanceBoardSummary.longAwayCount}명`,
          detail: '실시간 교실 도면에서 장기 외출 학생의 복귀 여부를 바로 점검하세요.',
          actionLabel: '실시간 교실',
          href: '/dashboard/teacher',
          icon: LayoutGrid,
          toneClass: 'bg-amber-100 text-amber-700',
        },
        {
          key: 'guardian',
          title: `즉시 연락 추천 보호자 ${parentContactRecommendations.length}명`,
          detail: '리포트 미열람, 상담 공백, 앱 방문 저조 보호자를 우선 연락 대상으로 묶었습니다.',
          actionLabel: '보호자 보기',
          actionType: 'dialog' as const,
          icon: HeartHandshake,
          toneClass: 'bg-violet-100 text-violet-700',
        },
        {
          key: 'lead',
          title: `상담·리드 ${metrics?.leadPipelineCount30d ?? 0}건`,
          detail: '웹 상담폼, 입학 대기, 수동 리드를 같은 흐름에서 확인할 수 있습니다.',
          actionLabel: '리드 워크벤치',
          href: '/dashboard/leads',
          icon: Megaphone,
          toneClass: 'bg-blue-100 text-blue-700',
        },
        {
          key: 'cost',
          title: `문자·수납 비용 흐름`,
          detail: '비용 분석에서 문자 비용과 수납/전환 효율을 함께 점검하세요.',
          actionLabel: '비용 분석',
          href: '/dashboard/revenue',
          icon: TrendingUp,
          toneClass: 'bg-emerald-100 text-emerald-700',
        },
      ].filter((item) => {
        if (item.key === 'intervention') return urgentInterventionStudents.length > 0;
        if (item.key === 'attendance') return attendanceBoardSummary.lateOrAbsentCount > 0;
        if (item.key === 'away') return attendanceBoardSummary.longAwayCount > 0;
        if (item.key === 'guardian') return parentContactRecommendations.length > 0;
        if (item.key === 'lead') return (metrics?.leadPipelineCount30d ?? 0) > 0;
        return true;
      }),
    [attendanceBoardSummary, metrics, parentContactRecommendations, urgentInterventionStudents]
  );

  const todayAttendanceContactTargets = useMemo(() => {
    const priorityByStatus: Record<string, number> = {
      absent: 0,
      late: 1,
      routine_missing: 2,
      present_missing_routine: 3,
      checked_out: 4,
      away: 5,
      returned: 6,
      present: 7,
      planned: 8,
      excused_absent: 9,
    };

    return Object.values(attendanceSeatSignalsBySeatId || {})
      .filter((signal) => {
        if (signal.boardStatus === 'absent' || signal.boardStatus === 'late') return true;
        if (signal.boardStatus === 'routine_missing' || signal.boardStatus === 'present_missing_routine') return true;
        return signal.attendanceRiskLevel !== 'stable';
      })
      .sort((left, right) => {
        const statusDelta =
          (priorityByStatus[left.boardStatus] ?? 99) - (priorityByStatus[right.boardStatus] ?? 99);
        if (statusDelta !== 0) return statusDelta;
        if (left.attendanceRiskLevel !== right.attendanceRiskLevel) {
          const getRiskWeight = (level: string) => {
            if (level === 'risk') return 0;
            if (level === 'warning') return 1;
            return 2;
          };
          return getRiskWeight(left.attendanceRiskLevel) - getRiskWeight(right.attendanceRiskLevel);
        }
        return left.studentName.localeCompare(right.studentName, 'ko');
      })
      .slice(0, 4)
      .map((signal) => {
        const issueLabel =
          signal.boardStatus === 'absent'
            ? '미입실'
            : signal.boardStatus === 'late'
              ? '지각'
              : signal.boardStatus === 'routine_missing' || signal.boardStatus === 'present_missing_routine'
                ? '루틴누락'
                : signal.attendanceRiskLabel;

        const detailLabel =
          signal.routineExpectedArrivalTime
            ? `${signal.routineExpectedArrivalTime} 기준`
            : signal.checkedAtLabel
              ? `${signal.checkedAtLabel} 확인`
              : signal.note;

        return {
          studentId: signal.studentId,
          studentName: signal.studentName,
          issueLabel,
          detailLabel,
        };
      });
  }, [attendanceSeatSignalsBySeatId]);

  function renderAttendanceDashboardSection() {
    return (
      <>
        <Card className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_18px_48px_-36px_rgba(20,41,95,0.32)]">
          <CardHeader className="border-b border-slate-200/70 bg-slate-50/70 px-4 py-4 sm:px-5">
            <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-start justify-between')}>
              <div className="grid gap-1">
                <div className="flex items-center gap-2 text-primary/70">
                  <ClipboardCheck className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.28em]">Real-Time Seat Control</span>
                  {selectedClass !== 'all' ? (
                    <Badge className="h-5 border-none bg-white px-2 text-[10px] font-black text-slate-700 shadow-sm">
                      {selectedClass}
                    </Badge>
                  ) : null}
                </div>
                <CardTitle className="text-xl font-black tracking-tight text-[#14295F]">실시간 좌석 관제</CardTitle>
                <CardDescription className="text-xs font-bold text-slate-500">
                  좌석과 출결 신호를 먼저 보고, 필요한 학생은 바로 상세 KPI로 연결합니다.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={selectedRoomView === 'all' ? 'default' : 'outline'}
                  onClick={() => {
                    setSelectedRoomView('all');
                    setIsAttendanceFullscreenOpen(true);
                  }}
                  className={cn(
                    'h-10 rounded-xl font-black',
                    selectedRoomView === 'all' ? 'bg-primary text-white hover:bg-primary/95' : 'border-slate-200 bg-white text-[#17306f]'
                  )}
                >
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  전체보기
                </Button>
                {roomConfigs.map((room) => (
                  <Button
                    key={room.id}
                    type="button"
                    variant={selectedRoomView === room.id ? 'default' : 'outline'}
                    onClick={() => setSelectedRoomView(room.id)}
                    className={cn(
                      'h-10 rounded-xl font-black',
                      selectedRoomView === room.id ? 'bg-primary text-white hover:bg-primary/95' : 'border-slate-200 bg-white text-[#17306f]'
                    )}
                  >
                    {room.name}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-4">
            <CenterAdminAttendanceBoard
              roomConfigs={roomConfigs}
              selectedRoomView={selectedRoomView}
              selectedClass={selectedClass}
              isMobile={isMobile}
              seatDetailLevel="nameOnly"
              isLoading={attendanceBoardLoading}
              summary={attendanceBoardSummary}
              seatSignalsBySeatId={attendanceSeatSignalsBySeatId}
              studentsById={studentsById}
              studentMembersById={studentMembersById}
              getSeatForRoom={getSeatForRoom}
              onSeatClick={(seat) => {
                if (seat.studentId) {
                  setSelectedFocusStudentId(seat.studentId);
                }
              }}
            />
          </CardContent>
        </Card>

        <Dialog open={isAttendanceFullscreenOpen} onOpenChange={setIsAttendanceFullscreenOpen}>
          <DialogContent className="h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden rounded-[2rem] border-none bg-[#f6f8ff] p-0 shadow-[0_24px_80px_rgba(20,41,95,0.28)]">
            <div className="border-b border-primary/10 bg-white/90 px-5 py-4 backdrop-blur sm:px-6">
              <DialogHeader className="gap-2 text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="h-6 border-none bg-primary px-2.5 text-[10px] font-black text-white">
                    FULL SCREEN
                  </Badge>
                  {selectedClass !== 'all' && (
                    <Badge className="h-6 border-none bg-slate-100 px-2.5 text-[10px] font-black text-slate-700">
                      {selectedClass}
                    </Badge>
                  )}
                </div>
                <DialogTitle className="text-2xl font-black tracking-tight text-primary">
                  등하원 관제 전체보기
                </DialogTitle>
                <DialogDescription className="text-xs font-bold text-muted-foreground">
                  두 호실을 한 화면에서 크게 확인합니다. `Esc`를 누르면 대시보드로 돌아갑니다.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-4">
              <CenterAdminAttendanceBoard
                roomConfigs={roomConfigs}
                selectedRoomView="all"
                selectedClass={selectedClass}
                isMobile={isMobile}
                seatDetailLevel="nameOnly"
                isLoading={attendanceBoardLoading}
                summary={attendanceBoardSummary}
                seatSignalsBySeatId={attendanceSeatSignalsBySeatId}
                studentsById={studentsById}
                studentMembersById={studentMembersById}
                getSeatForRoom={getSeatForRoom}
                onSeatClick={(seat) => {
                  setIsAttendanceFullscreenOpen(false);
                  if (seat.studentId) {
                    setSelectedFocusStudentId(seat.studentId);
                  }
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const heatmapGraphSection = (
    <CenterAdminHeatmapCharts
      title="탭 집중형 운영 분석"
      description="5개 운영 축 중 현재 가장 낮은 축을 먼저 열고, 개입 학생까지 한 흐름으로 이어집니다."
      rows={adminHeatmapRows}
      interventionSignals={heatmapInterventionSignals}
      scopeLabel={selectedClass === 'all' ? '센터 전체' : selectedClass}
      isLoading={adminHeatmapLoading}
      actionHref="/dashboard/teacher"
      actionLabel="실시간 교실 이동"
    />
  );

  if (!isActive) return null;

  if (membersLoading || !isMounted) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
        <p className="font-black text-muted-foreground/40 uppercase tracking-widest italic">운영 현황 동기화 중...</p>
      </div>
    );
  }

  const workbenchQuickActions = [
    { label: '실시간 교실', icon: <LayoutGrid className="h-4 w-4" />, href: '/dashboard/teacher' },
    { label: '학생 360', icon: <Users className="h-4 w-4" />, href: '/dashboard/teacher/students' },
    { label: '출결 KPI', icon: <ClipboardCheck className="h-4 w-4" />, href: '/dashboard/attendance' },
    { label: '리드 / 상담', icon: <Megaphone className="h-4 w-4" />, href: '/dashboard/leads' },
    { label: '수익 분석', icon: <TrendingUp className="h-4 w-4" />, href: '/dashboard/revenue' },
  ];

  const summaryTiles = [
    {
      key: 'study',
      label: '오늘 학습',
      value: `${(metrics.totalTodayMins / 60).toFixed(1)}시간`,
      detail: `평균 완료율 ${metrics.avgCompletion}%`,
      icon: Clock,
      iconClassName: 'bg-[#eef4ff] text-[#2754d7]',
    },
    {
      key: 'studying',
      label: '현재 착석',
      value: `${metrics.checkedInCount}명`,
      detail: `점유율 ${metrics.seatOccupancy}% · 목록 열기`,
      icon: Users,
      iconClassName: 'bg-blue-50 text-blue-600',
      onClick: () => setIsStudyingStudentsDialogOpen(true),
    },
    {
      key: 'attendance',
      label: '미입실·지각',
      value: `${attendanceBoardSummary.lateOrAbsentCount}명`,
      detail: '출결 KPI에서 바로 확인',
      icon: AlertTriangle,
      iconClassName: 'bg-rose-50 text-rose-600',
      href: '/dashboard/attendance',
    },
    {
      key: 'away',
      label: '장기 외출',
      value: `${attendanceBoardSummary.longAwayCount}명`,
      detail: `외출·복귀 ${attendanceBoardSummary.awayCount + attendanceBoardSummary.returnedCount}건`,
      icon: History,
      iconClassName: 'bg-amber-50 text-amber-600',
      href: '/dashboard/teacher',
    },
    {
      key: 'intervention',
      label: '즉시 개입',
      value: `${urgentInterventionStudents.length}명`,
      detail: urgentInterventionStudents[0]?.topReason || '개입 대상 없음',
      icon: ShieldAlert,
      iconClassName: 'bg-rose-50 text-rose-600',
      href: '/dashboard/teacher/students?showRisk=1#risk-analysis',
    },
    {
      key: 'guardian',
      label: '보호자 연락',
      value: `${parentContactRecommendations.length}명`,
      detail: '우선 연락 추천 보기',
      icon: HeartHandshake,
      iconClassName: 'bg-violet-50 text-violet-600',
      onClick: () => setIsParentTrustDialogOpen(true),
    },
    {
      key: 'lead',
      label: '상담·리드',
      value: `${metrics.leadPipelineCount30d}건`,
      detail: '최근 30일 누적 흐름',
      icon: Megaphone,
      iconClassName: 'bg-emerald-50 text-emerald-600',
      href: '/dashboard/leads',
    },
    {
      key: 'openclaw',
      label: 'OpenClaw',
      value: openClawStatusMeta.label,
      detail: `마지막 성공 ${openClawLastExportLabel}`,
      icon: OpenClawStatusIcon,
      iconClassName: cn('bg-slate-100', openClawStatusMeta.iconClassName),
      onClick: () => void handleGenerateOpenClawSnapshot(),
    },
  ];

  const topFocusCompactPreview = topFocusPreview.slice(0, 3);
  const bottomFocusCompactPreview = bottomFocusPreview.slice(0, 3);
  const parentContactCompactPreview = parentContactRecommendations.slice(0, 2);
  const leadAnnouncement = recentAnnouncementsPreview[0] || null;
  const leadTeacherActivity = teacherActivityPreviewRows[0] || null;
  const adminPriorityActions = todayActionQueue.slice(0, 3);
  const topAdminPriority = adminPriorityActions[0] || null;
  const secondaryAdminPriorityActions = adminPriorityActions.slice(1);
  const TopAdminPriorityIcon = topAdminPriority?.icon;

  return (
    <div className={cn('mx-auto flex w-full max-w-[1400px] flex-col gap-6', isMobile ? 'px-1 pb-6' : 'px-4 py-6')}>
      <AdminWorkbenchCommandBar
        eyebrow="센터관리자 홈"
        title="실시간 운영 워크벤치"
        description="출결, 좌석, 개입 대상, 운영 분석을 한 화면 흐름으로 정리했습니다."
        quickActions={workbenchQuickActions}
        selectValue={selectedClass}
        onSelectChange={setSelectedClass}
        selectOptions={classFilterOptions}
        selectLabel="분석 대상"
        className="top-3"
      />

      {hasMetricsReady ? (
        <>
          <section className="space-y-4 px-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-black tracking-tighter">운영 요약 스트립</h2>
              <Badge className="rounded-full border-none bg-[#14295F] px-2.5 py-1 text-[10px] font-black text-white">
                첫 화면 요약
              </Badge>
            </div>
            <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.6fr)_360px]')}>
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                {summaryTiles.map((item) => {
                  const tileInner = (
                    <div className="flex h-full flex-col justify-between rounded-[1.6rem] border border-slate-200/80 bg-white p-4 shadow-[0_14px_34px_-28px_rgba(20,41,95,0.32)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                          <p className="mt-2 dashboard-number text-3xl tracking-tight text-[#14295F]">{item.value}</p>
                        </div>
                        <span className={cn('inline-flex h-10 w-10 items-center justify-center rounded-2xl', item.iconClassName)}>
                          <item.icon className="h-5 w-5" />
                        </span>
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-[11px] font-bold leading-5 text-slate-500">{item.detail}</p>
                        {(item.href || item.onClick) ? (
                          <span className="shrink-0 text-[11px] font-black text-primary">열기</span>
                        ) : null}
                      </div>
                    </div>
                  );

                  if (item.href) {
                    return (
                      <Link key={item.key} href={item.href} className="block transition-transform hover:-translate-y-0.5">
                        {tileInner}
                      </Link>
                    );
                  }

                  if (item.onClick) {
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={item.onClick}
                        className="block text-left transition-transform hover:-translate-y-0.5"
                      >
                        {tileInner}
                      </button>
                    );
                  }

                  return <div key={item.key}>{tileInner}</div>;
                })}
              </div>

              <Card className="rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_18px_44px_-34px_rgba(20,41,95,0.34)]">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">오늘의 우선순위</p>
                      <CardTitle className="mt-2 text-xl font-black tracking-tight text-[#14295F]">운영실에 들어오면 먼저 할 일 TOP 3</CardTitle>
                      <CardDescription className="mt-1 text-xs font-bold text-slate-500">
                        가장 먼저 처리해야 할 항목만 순서대로 고정해 두었습니다.
                      </CardDescription>
                    </div>
                    <AlertTriangle className="h-5 w-5 text-rose-500" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!topAdminPriority ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-xs font-bold text-slate-500">
                      현재 우선 처리 큐가 비어 있습니다.
                    </div>
                  ) : (
                    <>
                      <div className="rounded-[1.5rem] border border-[#FFD7BA] bg-[linear-gradient(135deg,#FFF8F2_0%,#ffffff_100%)] px-4 py-4 shadow-[0_18px_36px_-30px_rgba(255,122,22,0.34)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge className="h-6 rounded-full border-none bg-[#FF7A16] px-2.5 text-[10px] font-black text-white">
                                1순위
                              </Badge>
                              <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-full', topAdminPriority.toneClass)}>
                                {TopAdminPriorityIcon ? <TopAdminPriorityIcon className="h-4 w-4" /> : null}
                              </span>
                            </div>
                            <p className="mt-3 text-base font-black tracking-tight text-[#14295F]">{topAdminPriority.title}</p>
                            <p className="mt-2 text-[11px] font-bold leading-5 text-slate-500">{topAdminPriority.detail}</p>
                          </div>
                          {topAdminPriority.actionType === 'dialog' ? (
                            <Button
                              type="button"
                              size="sm"
                              className="h-9 rounded-xl bg-[#14295F] px-3 text-[11px] font-black text-white hover:bg-[#10224C]"
                              onClick={() => setIsParentTrustDialogOpen(true)}
                            >
                              {topAdminPriority.actionLabel}
                            </Button>
                          ) : (
                            <Button asChild type="button" size="sm" className="h-9 rounded-xl bg-[#14295F] px-3 text-[11px] font-black text-white hover:bg-[#10224C]">
                              <Link href={topAdminPriority.href!}>{topAdminPriority.actionLabel}</Link>
                            </Button>
                          )}
                        </div>
                      </div>

                      {secondaryAdminPriorityActions.map((item, index) => (
                        <div key={item.key} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge className="h-5 rounded-full border-none bg-[#EEF4FF] px-2 text-[10px] font-black text-[#2554D7]">
                                  {index + 2}순위
                                </Badge>
                                <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-full', item.toneClass)}>
                                  <item.icon className="h-4 w-4" />
                                </span>
                                <p className="text-sm font-black text-[#14295F]">{item.title}</p>
                              </div>
                              <p className="mt-2 text-[11px] font-bold leading-5 text-slate-500">{item.detail}</p>
                            </div>
                            {item.actionType === 'dialog' ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-lg px-3 text-[11px] font-black"
                                onClick={() => setIsParentTrustDialogOpen(true)}
                              >
                                {item.actionLabel}
                              </Button>
                            ) : (
                              <Button asChild type="button" size="sm" variant="outline" className="h-8 rounded-lg px-3 text-[11px] font-black">
                                <Link href={item.href!}>{item.actionLabel}</Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>

          <section className="space-y-4 px-1">
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-black tracking-tighter">실시간 운영 워크스페이스</h2>
              <Badge className="rounded-full border-none bg-blue-600 px-2.5 py-1 text-[10px] font-black text-white">
                좌석 + 개입
              </Badge>
            </div>
            <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.55fr)_360px]')}>
              <div>{renderAttendanceDashboardSection()}</div>

              <div className="space-y-4">
                <Card className="rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_16px_40px_-34px_rgba(20,41,95,0.32)]">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">즉시 개입 학생</p>
                        <CardDescription className="mt-1 text-xs font-bold text-slate-500">
                          히트맵과 출결 신호를 겹쳐 가장 먼저 봐야 할 학생만 모았습니다.
                        </CardDescription>
                      </div>
                      <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg px-2 text-[11px] font-black text-primary">
                        <Link href="/dashboard/teacher/students">학생 360</Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {urgentInterventionStudents.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-xs font-bold text-slate-500">
                        현재 즉시 개입이 필요한 학생 신호가 없습니다.
                      </div>
                    ) : (
                      urgentInterventionStudents.map((signal, index) => {
                        const roomLabel = signal.roomId ? roomNameById.get(signal.roomId) || signal.roomId : '미배정';
                        return (
                          <button
                            key={`${signal.studentId}-${signal.seatId}`}
                            type="button"
                            onClick={() => setSelectedFocusStudentId(signal.studentId)}
                            className="grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-left transition-all hover:border-primary/20 hover:bg-white hover:shadow-sm"
                          >
                            <span className="text-xs font-black text-slate-400">{index + 1}</span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-black text-[#14295F]">{signal.studentName}</p>
                                {signal.className ? (
                                  <Badge className="h-5 rounded-full border-none bg-slate-100 px-2 text-[10px] font-black text-slate-700">
                                    {signal.className}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-1 truncate text-[11px] font-bold text-slate-500">
                                {roomLabel} · {signal.attendanceStatus} · {signal.topReason}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-rose-600">{signal.compositeHealth}점</p>
                              <p className="text-[10px] font-bold text-slate-400">{signal.weeklyStudyLabel}</p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_16px_40px_-34px_rgba(20,41,95,0.32)]">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">출결 바로 연락 대상</p>
                        <CardDescription className="mt-1 text-xs font-bold text-slate-500">
                          미입실, 지각, 루틴 누락 학생부터 연락 우선순위를 잡습니다.
                        </CardDescription>
                      </div>
                      <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg px-2 text-[11px] font-black text-primary">
                        <Link href="/dashboard/attendance">출결 KPI</Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {todayAttendanceContactTargets.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-xs font-bold text-slate-500">
                        현재 바로 연락이 필요한 출결 대상이 없습니다.
                      </div>
                    ) : (
                      todayAttendanceContactTargets.map((target) => (
                        <div key={target.studentId} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-black text-[#14295F]">{target.studentName}</p>
                            <Badge className="h-5 rounded-full border-none bg-rose-100 px-2 text-[10px] font-black text-rose-700">
                              {target.issueLabel}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[11px] font-bold text-slate-500">{target.detailLabel}</p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_16px_40px_-34px_rgba(20,41,95,0.32)]">
                  <CardHeader className="pb-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">빠른 드릴다운</p>
                    <CardDescription className="mt-1 text-xs font-bold text-slate-500">
                      자주 여는 운영 화면으로 바로 이동합니다.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {quickActionLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 transition-all hover:border-primary/20 hover:bg-white hover:shadow-sm"
                      >
                        <div className="flex items-center gap-2">
                          <item.icon className="h-4 w-4 text-primary" />
                          <div>
                            <p className="text-sm font-black text-[#14295F]">{item.label}</p>
                            <p className="text-[11px] font-bold text-slate-500">{item.description}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          <section className="space-y-4 px-1 pb-10">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-black tracking-tighter">운영 인사이트 스튜디오</h2>
              <Badge className="rounded-full border-none bg-[#14295F] px-2.5 py-1 text-[10px] font-black text-white">
                분석 + 운영 도구
              </Badge>
            </div>

            <div className="overflow-hidden rounded-[2.4rem] border border-[#14295F]/10 bg-[linear-gradient(180deg,rgba(20,41,95,0.05)_0%,rgba(255,122,22,0.04)_100%)] p-4 shadow-[0_26px_60px_-46px_rgba(20,41,95,0.36)] sm:p-5">
              <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-start justify-between')}>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#2554D7]">One Focus At A Time</p>
                  <p className="mt-1 text-xl font-black tracking-tight text-[#14295F]">많이 펼치지 않고, 지금 필요한 분석만 크게 봅니다.</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                    히트맵은 탭 집중형으로 압축하고, 랭킹·학부모·운영 도구는 오른쪽 레일에서 빠르게 판단하도록 정리했습니다.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full border-none bg-white px-3 py-1 text-[10px] font-black text-[#14295F] shadow-sm">
                    {selectedClass === 'all' ? '센터 전체' : selectedClass}
                  </Badge>
                  <Badge className="rounded-full border-none bg-[#FFF2E8] px-3 py-1 text-[10px] font-black text-[#C95A08]">
                    절제된 프리미엄
                  </Badge>
                </div>
              </div>

              <div className={cn('mt-5 grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.2fr)_360px]')}>
                <div className="space-y-4">
                  {centerHealthAxes.length > 0 ? (
                    <Card className="rounded-[2rem] border border-[#14295F]/10 bg-white shadow-[0_18px_40px_-34px_rgba(20,41,95,0.26)]">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-xl font-black tracking-tight text-[#14295F]">운영 5축 스냅샷</CardTitle>
                            <CardDescription className="mt-1 text-xs font-bold text-slate-500">
                              홈에서는 각 축의 상태만 빠르게 확인하고, 자세한 흐름은 아래 탭 분석에서 이어집니다.
                            </CardDescription>
                          </div>
                          <Badge className="rounded-full border-none bg-[#EEF4FF] px-2.5 py-1 text-[10px] font-black text-[#2554D7]">
                            5개 축
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5">
                        {centerHealthAxes.map((axis) => (
                          <div
                            key={axis.id}
                            className={cn(
                              'rounded-[1.4rem] border p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1',
                              axis.tone.card,
                              'hover:border-[#FF7A16]/20 hover:shadow-[0_20px_36px_-30px_rgba(20,41,95,0.28)]'
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-black tracking-tight text-[#14295F]">{axis.label}</p>
                              <span className={cn('rounded-full px-2 py-1 text-[10px] font-black', axis.tone.badge)}>
                                {axis.summaryLabel}
                              </span>
                            </div>
                            <div className="mt-3 flex items-end justify-between gap-3">
                              <div>
                                <p className="dashboard-number text-3xl tracking-tight text-[#14295F]">{axis.summaryScore}</p>
                                <p className="mt-1 text-[11px] font-bold text-slate-500">
                                  {axis.trendLabel} {axis.delta === 0 ? '0' : `${axis.delta > 0 ? '+' : ''}${axis.delta}`}
                                </p>
                              </div>
                              <div className={cn('h-3.5 w-3.5 rounded-full shadow-[0_0_0_5px_rgba(255,255,255,0.9)]', axis.tone.dot)} />
                            </div>
                            <p className="mt-3 line-clamp-3 text-[11px] font-semibold leading-5 text-slate-500">{axis.description}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ) : null}

                  {heatmapGraphSection}
                </div>

                <div className="space-y-4">
                  <Card className="group rounded-[2rem] border border-[#14295F]/10 bg-white shadow-[0_18px_40px_-34px_rgba(20,41,95,0.24)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[#FF7A16]/24 hover:shadow-[0_28px_48px_-36px_rgba(20,41,95,0.34)]">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-[#2554D7]" />
                            <CardTitle className="text-lg font-black tracking-tight text-[#14295F]">집중 / 반응 랭킹</CardTitle>
                          </div>
                          <CardDescription className="mt-1 text-xs font-bold text-slate-500">
                            상위와 보완 대상을 짧게 보고, 학생 360에서 바로 이어집니다.
                          </CardDescription>
                        </div>
                        <Button
                          asChild
                          type="button"
                          className="h-9 rounded-xl bg-[#FF7A16] px-3 text-[11px] font-black text-white hover:bg-[#E56D10]"
                        >
                          <Link href="/dashboard/teacher/students">학생 360</Link>
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[1.3rem] border border-[#dbe7ff] bg-[#eef4ff] p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2554D7]">평균 집중도</p>
                          <p className="dashboard-number mt-2 text-3xl text-[#14295F]">{metrics.focusKpi.score}점</p>
                        </div>
                        <div className="rounded-[1.3rem] border border-[#FFD7BA] bg-[#FFF2E8] p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C95A08]">평균 완료율</p>
                          <p className="dashboard-number mt-2 text-3xl text-[#C95A08]">{metrics.focusKpi.completion}%</p>
                        </div>
                      </div>

                      <div className="rounded-[1.4rem] border border-[#14295F]/10 bg-[#f8fbff] px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">관리 코멘트</p>
                        <p className="mt-2 text-xs font-bold leading-5 text-slate-600">
                          {metrics.focusKpi.risks[0] || metrics.focusKpi.actions[0] || '현재 리듬을 유지하면서 집중 흐름을 점검하세요.'}
                        </p>
                      </div>

                      <div className="grid gap-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-black text-[#14295F]">상위 3명</p>
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2554D7]">7일 누적</span>
                          </div>
                          {topFocusCompactPreview.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-xs font-bold text-slate-500">
                              집계할 학생 데이터가 없습니다.
                            </div>
                          ) : (
                            topFocusCompactPreview.map((row, index) => (
                              <button
                                key={row.studentId}
                                type="button"
                                onClick={() => setSelectedFocusStudentId(row.studentId)}
                                className="grid w-full grid-cols-[28px_1fr_auto] items-center gap-2 rounded-xl border border-[#dbe7ff] bg-[#f7f9ff] px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#14295F]/18 hover:bg-white hover:shadow-sm"
                              >
                                <span className="text-xs font-black text-[#2554D7]">{index + 1}</span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-slate-800">{row.name}</p>
                                  <p className="text-[10px] font-bold text-slate-500">{row.className} · 완료율 {row.completion}%</p>
                                </div>
                                <Badge className="h-6 rounded-full border-none bg-[#14295F] px-2.5 text-[10px] font-black text-white">
                                  {Math.floor(row.studyMinutes / 60)}h {row.studyMinutes % 60}m
                                </Badge>
                              </button>
                            ))
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-black text-[#C95A08]">보완 3명</p>
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C95A08]">우선 점검</span>
                          </div>
                          {bottomFocusCompactPreview.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-xs font-bold text-slate-500">
                              집계할 학생 데이터가 없습니다.
                            </div>
                          ) : (
                            bottomFocusCompactPreview.map((row, index) => (
                              <button
                                key={row.studentId}
                                type="button"
                                onClick={() => setSelectedFocusStudentId(row.studentId)}
                                className="grid w-full grid-cols-[28px_1fr_auto] items-center gap-2 rounded-xl border border-[#FFD7BA] bg-[#FFF8F2] px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF7A16]/26 hover:bg-white hover:shadow-sm"
                              >
                                <span className="text-xs font-black text-[#C95A08]">{index + 1}</span>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-black text-slate-800">{row.name}</p>
                                  <p className="text-[10px] font-bold text-slate-500">{row.className} · 완료율 {row.completion}%</p>
                                </div>
                                <Badge className="h-6 rounded-full border-none bg-[#FFF2E8] px-2.5 text-[10px] font-black text-[#C95A08]">
                                  {Math.floor(row.studyMinutes / 60)}h {row.studyMinutes % 60}m
                                </Badge>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="group rounded-[2rem] border border-[#14295F]/10 bg-white shadow-[0_18px_40px_-34px_rgba(20,41,95,0.24)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[#FF7A16]/24 hover:shadow-[0_28px_48px_-36px_rgba(20,41,95,0.34)]">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <HeartHandshake className="h-4 w-4 text-[#2554D7]" />
                            <CardTitle className="text-lg font-black tracking-tight text-[#14295F]">학부모 반응 / 신뢰</CardTitle>
                          </div>
                          <CardDescription className="mt-1 text-xs font-bold text-slate-500">
                            학부모 리액션은 요약으로 보고, 상세 분석은 기존 다이얼로그에서 이어집니다.
                          </CardDescription>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-xl border-[#14295F]/12 bg-white px-3 text-[11px] font-black text-[#14295F] hover:border-[#FF7A16]/24 hover:text-[#C95A08]"
                          onClick={() => setIsParentTrustDialogOpen(true)}
                        >
                          상세 보기
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[1.3rem] border border-[#dbe7ff] bg-[#eef4ff] p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#2554D7]">앱 방문</p>
                          <p className="dashboard-number mt-2 text-3xl text-[#14295F]">{metrics.parentVisitCount30d}</p>
                        </div>
                        <div className="rounded-[1.3rem] border border-slate-200 bg-white p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">활성 학부모</p>
                          <p className="dashboard-number mt-2 text-3xl text-[#14295F]">{metrics.activeParentCount30d}</p>
                        </div>
                        <div className="rounded-[1.3rem] border border-[#FFD7BA] bg-[#FFF2E8] p-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#C95A08]">상담 신청</p>
                          <p className="dashboard-number mt-2 text-3xl text-[#C95A08]">{metrics.consultationRequestCount30d}</p>
                        </div>
                      </div>

                      <div className="rounded-[1.4rem] border border-[#FFD7BA] bg-[#FFF8F2] p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#C95A08]">우선 연락 추천</p>
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                            {parentContactRecommendations.length}명
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2">
                          {parentContactCompactPreview.length === 0 ? (
                            <p className="text-xs font-bold text-slate-500">현재 즉시 연락이 필요한 학부모가 없습니다.</p>
                          ) : (
                            parentContactCompactPreview.map((row) => (
                              <div key={row.bucketKey} className="rounded-xl border border-white bg-white px-3 py-2.5 shadow-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="truncate text-sm font-black text-slate-900">{row.parentName}</p>
                                  <Badge
                                    className={cn(
                                      'h-5 border-none px-2 text-[10px] font-black',
                                      row.priority === '긴급'
                                        ? 'bg-rose-100 text-rose-700'
                                        : 'bg-[#FFF2E8] text-[#C95A08]'
                                    )}
                                  >
                                    {row.priority}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-[11px] font-bold text-slate-600">
                                  상담 {row.consultationRequestCount}건 · 방문 {row.visitCount}회
                                </p>
                                <p className="mt-1 text-[11px] font-bold text-slate-500">{row.recommendedAction}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="group rounded-[2rem] border border-[#14295F]/10 bg-white shadow-[0_18px_40px_-34px_rgba(20,41,95,0.24)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[#FF7A16]/24 hover:shadow-[0_28px_48px_-36px_rgba(20,41,95,0.34)]">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <UserCog className="h-4 w-4 text-[#2554D7]" />
                            <CardTitle className="text-lg font-black tracking-tight text-[#14295F]">운영 도구</CardTitle>
                          </div>
                          <CardDescription className="mt-1 text-xs font-bold text-slate-500">
                            공지, 계정 관리, OpenClaw를 홈에서 압축 확인하고 필요한 다이얼로그만 엽니다.
                          </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="h-9 rounded-xl bg-[#FF7A16] px-3 text-[11px] font-black text-white hover:bg-[#E56D10]"
                            onClick={() => setIsAnnouncementDialogOpen(true)}
                          >
                            공지 작성
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 rounded-xl border-[#14295F]/12 bg-white px-3 text-[11px] font-black text-[#14295F] hover:border-[#FF7A16]/24 hover:text-[#C95A08]"
                            onClick={() => setIsTeacherManagementDialogOpen(true)}
                          >
                            계정 관리
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="rounded-[1.4rem] border border-[#14295F]/10 bg-[#f8fbff] p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-[#14295F]">최근 공지</p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-lg px-2 text-[10px] font-black text-[#2554D7] hover:bg-[#eef4ff]"
                            onClick={() => setIsAnnouncementDialogOpen(true)}
                          >
                            전체 보기
                          </Button>
                        </div>
                        {leadAnnouncement ? (
                          <>
                            <p className="mt-2 text-sm font-black text-slate-900">{leadAnnouncement.title || '제목 없음'}</p>
                            <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-5 text-slate-500">
                              {leadAnnouncement.body || '내용 없음'}
                            </p>
                            <p className="mt-2 text-[10px] font-black text-slate-400">
                              {leadAnnouncement.createdAt?.toDate?.()
                                ? format(leadAnnouncement.createdAt.toDate(), 'yyyy.MM.dd HH:mm')
                                : '방금 전 등록'}
                            </p>
                          </>
                        ) : (
                          <p className="mt-2 text-xs font-bold text-slate-500">등록된 공지사항이 없습니다.</p>
                        )}
                      </div>

                      <div className="rounded-[1.4rem] border border-[#14295F]/10 bg-white p-4">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-black text-[#14295F]">선생님 활동 요약</p>
                          <Badge className="h-6 rounded-full border-none bg-[#14295F] px-2.5 text-[10px] font-black text-white">
                            {teacherRows.length}명
                          </Badge>
                        </div>
                        {leadTeacherActivity ? (
                          <>
                            <p className="mt-2 text-sm font-black text-slate-900">{leadTeacherActivity.teacherName}</p>
                            <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">
                              상담일지 {leadTeacherActivity.logs.length}건 · 발송 리포트 {leadTeacherActivity.sentReports.length}건
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="mt-2 h-7 rounded-lg px-2 text-[10px] font-black text-[#2554D7] hover:bg-[#eef4ff]"
                              onClick={() => setSelectedTeacherId(leadTeacherActivity.id)}
                            >
                              활동 상세 보기
                            </Button>
                          </>
                        ) : (
                          <p className="mt-2 text-xs font-bold text-slate-500">조회된 선생님 계정이 없습니다.</p>
                        )}
                      </div>

                      <div className="rounded-[1.4rem] border border-[#FFD7BA] bg-[#FFF8F2] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-[#14295F]">OpenClaw Snapshot</p>
                            <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">{openClawStatusMeta.description}</p>
                          </div>
                          <Badge className={cn('rounded-full border px-2.5 py-1 text-[10px] font-black', openClawStatusMeta.badgeClass)}>
                            {openClawStatusMeta.label}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-xl border border-white bg-white px-3 py-2.5 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">마지막 성공</p>
                            <p className="mt-1 text-sm font-black text-[#14295F]">{openClawLastExportLabel}</p>
                          </div>
                          <div className="rounded-xl border border-white bg-white px-3 py-2.5 shadow-sm">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">마지막 요청</p>
                            <p className="mt-1 text-sm font-black text-[#14295F]">{openClawLastRequestedLabel}</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          className="mt-3 h-10 w-full rounded-xl bg-[#14295F] text-sm font-black text-white transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-[#10224C]"
                          disabled={isOpenClawActionDisabled}
                          onClick={handleGenerateOpenClawSnapshot}
                        >
                          {isOpenClawBusy ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              생성 중...
                            </>
                          ) : (
                            'OpenClaw 스냅샷 생성'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-20">
          <Activity className="h-16 w-16 animate-pulse" />
          <p className="font-black text-xl tracking-tighter">분석 데이터를 집계하고 있습니다...</p>
        </div>
      )}
      <Dialog open={isStudyingStudentsDialogOpen} onOpenChange={setIsStudyingStudentsDialogOpen}>
        <DialogContent motionPreset="dashboard-premium" className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-2xl">
          <div className="bg-[linear-gradient(135deg,#14295F_0%,#2754D7_100%)] px-6 py-6 text-white">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-none bg-white/18 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur">
                  실시간 공부 현황
                </Badge>
                <Badge className="border-none bg-white px-2.5 py-1 text-[10px] font-black text-primary">
                  {selectedClass === 'all' ? '센터 전체' : selectedClass}
                </Badge>
              </div>
              <DialogTitle className="text-2xl font-black tracking-tight">
                현재 공부중인 학생 {currentlyStudyingStudents.length}명
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-white/75">
                현재 좌석 상태가 공부중으로 잡힌 학생만 모아 보여줍니다.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[65vh] overflow-y-auto bg-slate-50 px-4 py-4 sm:px-5">
            {attendanceBoardLoading ? (
              <div className="flex min-h-[240px] items-center justify-center gap-3 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-bold">실시간 공부중 학생을 불러오는 중입니다.</span>
              </div>
            ) : currentlyStudyingStudents.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
                <p className="text-base font-black text-slate-800">현재 공부중인 학생이 없습니다.</p>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  잠시 후 다시 확인하거나 실시간 교실 도면에서 상태를 확인해 주세요.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentlyStudyingStudents.map((student) => (
                  <div
                    key={student.studentId}
                    className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-black tracking-tight text-slate-900">
                            {student.studentName}
                          </p>
                          {student.className ? (
                            <Badge className="h-6 rounded-full border-none bg-slate-100 px-2.5 text-[10px] font-black text-slate-700">
                              {student.className}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="h-6 rounded-full border-none bg-blue-50 px-2.5 text-[10px] font-black text-blue-700">
                            {student.roomLabel}
                          </Badge>
                          <Badge className="h-6 rounded-full border-none bg-emerald-50 px-2.5 text-[10px] font-black text-emerald-700">
                            {student.todayStudyLabel}
                          </Badge>
                          <Badge className="h-6 rounded-full border-none bg-indigo-50 px-2.5 text-[10px] font-black text-indigo-700">
                            {student.boardLabel}
                          </Badge>
                        </div>
                      </div>
                      {student.checkedAtLabel ? (
                        <p className="shrink-0 text-[11px] font-bold text-slate-500">
                          입실 {student.checkedAtLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="border-t border-slate-200 bg-white px-5 py-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-11 rounded-xl px-5 font-black">
                닫기
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isAnnouncementDialogOpen} onOpenChange={setIsAnnouncementDialogOpen}>
        <DialogContent motionPreset="dashboard-premium" className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-2xl">
          <div className="bg-primary px-6 py-6 text-white">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex items-center gap-2">
                <Badge className="border-none bg-white/18 px-2.5 py-1 text-[10px] font-black text-white">공지 작성</Badge>
              </div>
              <DialogTitle className="text-2xl font-black tracking-tight">학부모 공지사항 관리</DialogTitle>
              <DialogDescription className="text-sm font-medium text-white/75">
                홈에서는 요약만 보고, 공지 작성과 최근 등록 이력은 여기서 관리합니다.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[72vh] overflow-y-auto bg-slate-50 px-5 py-5">
            <div className="grid gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <Input
                value={noticeTitle}
                onChange={(event) => setNoticeTitle(event.target.value)}
                placeholder="공지 제목"
                className="h-11 rounded-xl border-slate-200 font-bold"
              />
              <Select value={noticeAudience} onValueChange={(value) => setNoticeAudience(value as 'parent' | 'student' | 'all')}>
                <SelectTrigger className="h-11 rounded-xl border-slate-200 font-bold">
                  <SelectValue placeholder="공지 대상 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">학부모 공지</SelectItem>
                  <SelectItem value="student">학생 공지</SelectItem>
                  <SelectItem value="all">학생 + 학부모 공지</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                value={noticeBody}
                onChange={(event) => setNoticeBody(event.target.value)}
                placeholder="학부모에게 전달할 공지 내용을 입력하세요."
                className="min-h-[130px] rounded-xl border-slate-200 font-bold"
              />
              <Button
                type="button"
                className="h-11 rounded-xl bg-[#14295F] text-white font-black"
                onClick={handleCreateAnnouncement}
                disabled={isNoticeSubmitting}
              >
                {isNoticeSubmitting ? '등록 중...' : '공지사항 등록'}
              </Button>
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">최근 등록 공지</p>
              {(centerAnnouncements || []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs font-bold text-slate-500">
                  등록된 공지사항이 없습니다.
                </div>
              ) : (
                (centerAnnouncements || []).slice(0, 5).map((item: any) => {
                  const createdAt = item.createdAt?.toDate?.();
                  return (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-black text-[#14295F]">{item.title || '제목 없음'}</p>
                        <Badge className="h-5 rounded-full border-none bg-slate-100 px-2 text-[10px] font-black text-slate-700">
                          {item.audience === 'student' ? '학생' : item.audience === 'all' ? '전체' : '학부모'}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-600">{item.body || '내용 없음'}</p>
                      <p className="mt-1 text-[10px] font-black text-slate-400">
                        {createdAt ? format(createdAt, 'yyyy.MM.dd HH:mm') : '방금 전 등록'}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={isTeacherManagementDialogOpen}
        onOpenChange={(open) => {
          setIsTeacherManagementDialogOpen(open);
          if (!open) {
            setTeacherSearch('');
          }
        }}
      >
        <DialogContent motionPreset="dashboard-premium" className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-3xl">
          <div className="bg-[#14295F] px-6 py-6 text-white">
            <DialogHeader className="space-y-2 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-none bg-white/18 px-2.5 py-1 text-[10px] font-black text-white">계정 관리</Badge>
                <Badge className="border-none bg-white px-2.5 py-1 text-[10px] font-black text-primary">
                  선생님 {teacherRows.length}명
                </Badge>
              </div>
              <DialogTitle className="text-2xl font-black tracking-tight">선생님 계정 관리</DialogTitle>
              <DialogDescription className="text-sm font-medium text-white/75">
                검색, 상세 확인, 계정 삭제는 여기서 처리하고 홈에는 활동 요약만 남겨둡니다.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[72vh] overflow-y-auto bg-slate-50 px-5 py-5">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_120px_120px]')}>
                <Input
                  value={teacherSearch}
                  onChange={(event) => setTeacherSearch(event.target.value)}
                  placeholder="이름, 전화번호, 사용자번호로 검색"
                  className="h-11 rounded-xl border-slate-200 font-bold"
                />
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">상담일지</p>
                  <p className="mt-1 text-lg font-black text-[#14295F]">
                    {teacherRows.reduce((sum, teacher) => sum + teacher.logs.length, 0)}건
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">발송 리포트</p>
                  <p className="mt-1 text-lg font-black text-[#14295F]">
                    {teacherRows.reduce((sum, teacher) => sum + teacher.sentReports.length, 0)}건
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[11px] font-bold text-slate-500">
                검색 결과 {filteredTeacherRows.length}명 / 전체 {teacherRows.length}명
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {filteredTeacherRows.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
                  <p className="text-base font-black text-slate-800">검색 결과가 없습니다.</p>
                  <p className="mt-2 text-sm font-medium text-slate-500">이름이나 전화번호, 사용자번호를 다시 확인해 주세요.</p>
                </div>
              ) : (
                filteredTeacherRows.map((teacher) => (
                  <div key={teacher.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-black tracking-tight text-slate-900">{teacher.teacherName}</p>
                          <Badge className="h-6 rounded-full border-none bg-slate-100 px-2.5 text-[10px] font-black text-slate-700">
                            {teacher.status}
                          </Badge>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge className="h-6 rounded-full border-none bg-emerald-50 px-2.5 text-[10px] font-black text-emerald-700">
                            상담일지 {teacher.logs.length}건
                          </Badge>
                          <Badge className="h-6 rounded-full border-none bg-blue-50 px-2.5 text-[10px] font-black text-blue-700">
                            발송 리포트 {teacher.sentReports.length}건
                          </Badge>
                          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-slate-100 px-2.5 text-[10px] font-black text-slate-700">
                            <Phone className="h-3 w-3" />
                            {teacher.phoneNumber || '전화번호 미등록'}
                          </span>
                        </div>
                        <p className="mt-3 text-[11px] font-bold text-slate-500">사용자번호 {teacher.id}</p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-xl px-3 text-xs font-black"
                          onClick={() => {
                            setIsTeacherManagementDialogOpen(false);
                            setSelectedTeacherId(teacher.id);
                          }}
                        >
                          상세 보기
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-xl border-rose-200 px-3 text-xs font-black text-rose-700 hover:bg-rose-50"
                          disabled={deletingTeacherId === teacher.id}
                          onClick={() => void handleDeleteTeacher({ id: teacher.id, teacherName: teacher.teacherName })}
                        >
                          {deletingTeacherId === teacher.id ? (
                            <>
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                              삭제 중...
                            </>
                          ) : (
                            <>
                              <UserX className="mr-2 h-3.5 w-3.5" />
                              계정 삭제
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-slate-200 bg-white px-5 py-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-11 rounded-xl px-5 font-black">
                닫기
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!selectedFocusStudentId} onOpenChange={(open) => !open && setSelectedFocusStudentId(null)}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-3xl max-h-[92vh] flex flex-col">

          {/* ── HEADER ── */}
          <div className="bg-[#14295F] p-6 text-white flex-shrink-0">
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="text-2xl font-black tracking-tight">학생 집중도 KPI</DialogTitle>
                  <DialogDescription className="text-white/70 font-bold mt-0.5">
                    {selectedFocusStudent
                      ? `${selectedFocusStudent.name} · ${selectedFocusStudent.className}`
                      : '학생별 집중도 추이를 확인합니다.'}
                  </DialogDescription>
                </div>
                {selectedFocusKpi && (
                  <Badge className={cn('mt-1 flex-shrink-0 h-7 px-3 text-xs font-black rounded-full', selectedFocusKpi.riskStatus.badgeClass)}>
                    {selectedFocusKpi.riskStatus.label}
                  </Badge>
                )}
              </div>
              {/* 핵심 3대 지표 헤더 요약 */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">오늘의 학습 성장도</p>
                  <p className={cn('dashboard-number text-2xl mt-0.5', todayLearningGrowthPercent >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                    {todayLearningGrowthPercent >= 0 ? '+' : ''}{todayLearningGrowthPercent}%
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">7일 평균 학습시간</p>
                  <p className="dashboard-number text-2xl text-white mt-0.5">
                    {Math.floor((selectedFocusKpi?.avgMinutes ?? 0) / 60)}h {(selectedFocusKpi?.avgMinutes ?? 0) % 60}m
                  </p>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">주간 학습 성장도</p>
                  <p className={cn('dashboard-number text-2xl mt-0.5', latestWeeklyLearningGrowthPercent >= 0 ? 'text-emerald-300' : 'text-rose-300')}>
                    {latestWeeklyLearningGrowthPercent >= 0 ? '+' : ''}{latestWeeklyLearningGrowthPercent}%
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* ── SCROLLABLE BODY ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="bg-white p-5 space-y-5">

              {/* ── 위험 신호 알림 (조건부) ── */}
              {selectedFocusKpi && selectedFocusKpi.riskAlerts.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">위험 신호 감지</p>
                  </div>
                  <div className="space-y-1.5">
                    {selectedFocusKpi.riskAlerts.map((alert, idx) => (
                      <p key={idx} className="text-xs font-bold text-rose-700">• {alert}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 핵심 지표 카드 (2×2) ── */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5">핵심 지표</p>
                <div className="grid grid-cols-2 gap-2">
                  {/* 오늘 학습시간 */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Clock className="h-3 w-3 text-blue-500 flex-shrink-0" />
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-tight">오늘 학습시간</p>
                    </div>
                    <p className="dashboard-number text-xl text-[#14295F]">
                      {Math.floor(todayStudyMinutes / 60)}h {todayStudyMinutes % 60}m
                    </p>
                    {selectedFocusKpi && selectedFocusKpi.avgMinutes > 0 && (
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                        7일 평균 {Math.floor(selectedFocusKpi.avgMinutes / 60)}h {selectedFocusKpi.avgMinutes % 60}m
                      </p>
                    )}
                  </div>

                  {/* 계획 완료율 */}
                  <div className={cn('rounded-xl border p-3',
                    (selectedFocusStudent?.completion ?? 0) >= 80 ? 'border-emerald-100 bg-emerald-50/60'
                    : (selectedFocusStudent?.completion ?? 0) >= 60 ? 'border-amber-100 bg-amber-50/60'
                    : 'border-rose-100 bg-rose-50/60'
                  )}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <CheckCircle2 className={cn('h-3 w-3 flex-shrink-0',
                        (selectedFocusStudent?.completion ?? 0) >= 80 ? 'text-emerald-500'
                        : (selectedFocusStudent?.completion ?? 0) >= 60 ? 'text-amber-500'
                        : 'text-rose-500'
                      )} />
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-tight">계획 완료율</p>
                    </div>
                    <p className={cn('dashboard-number text-xl',
                      (selectedFocusStudent?.completion ?? 0) >= 80 ? 'text-emerald-700'
                      : (selectedFocusStudent?.completion ?? 0) >= 60 ? 'text-amber-700'
                      : 'text-rose-700'
                    )}>
                      {selectedFocusStudent?.completion ?? 0}%
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                      {(selectedFocusStudent?.completion ?? 0) >= 80 ? '목표 달성' : (selectedFocusStudent?.completion ?? 0) >= 60 ? '부분 달성' : '미달성'}
                    </p>
                  </div>

                  {/* 학습 성장률 */}
                  <div className={cn('rounded-xl border p-3',
                    (selectedFocusStat?.studyTimeGrowthRate ?? 0) >= 0.05 ? 'border-emerald-100 bg-emerald-50/60'
                    : (selectedFocusStat?.studyTimeGrowthRate ?? 0) <= -0.1 ? 'border-rose-100 bg-rose-50/60'
                    : 'border-slate-100 bg-slate-50/70'
                  )}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {(selectedFocusStat?.studyTimeGrowthRate ?? 0) >= 0
                        ? <ArrowUpRight className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                        : <ArrowDownRight className="h-3 w-3 text-rose-500 flex-shrink-0" />
                      }
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-tight">오늘 학습 성장률</p>
                    </div>
                    <p className={cn('dashboard-number text-xl',
                      (selectedFocusStat?.studyTimeGrowthRate ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    )}>
                      {(selectedFocusStat?.studyTimeGrowthRate ?? 0) >= 0 ? '+' : ''}
                      {Math.round((selectedFocusStat?.studyTimeGrowthRate ?? 0) * 100)}%
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">전일 대비</p>
                  </div>

                  {/* 벌점 현황 */}
                  <div className={cn('rounded-xl border p-3',
                    (selectedFocusProgress?.penaltyPoints ?? 0) >= 10 ? 'border-rose-200 bg-rose-50'
                    : (selectedFocusProgress?.penaltyPoints ?? 0) >= 5 ? 'border-amber-100 bg-amber-50/60'
                    : 'border-slate-100 bg-slate-50/70'
                  )}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <ShieldAlert className={cn('h-3 w-3 flex-shrink-0',
                        (selectedFocusProgress?.penaltyPoints ?? 0) >= 10 ? 'text-rose-500'
                        : (selectedFocusProgress?.penaltyPoints ?? 0) >= 5 ? 'text-amber-500'
                        : 'text-slate-400'
                      )} />
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-tight">벌점 현황</p>
                    </div>
                    <p className={cn('dashboard-number text-xl',
                      (selectedFocusProgress?.penaltyPoints ?? 0) >= 10 ? 'text-rose-700'
                      : (selectedFocusProgress?.penaltyPoints ?? 0) >= 5 ? 'text-amber-700'
                      : 'text-[#14295F]'
                    )}>
                      {selectedFocusProgress?.penaltyPoints ?? 0}점
                    </p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                      {(selectedFocusProgress?.penaltyPoints ?? 0) >= 10 ? '즉시 점검 필요'
                        : (selectedFocusProgress?.penaltyPoints ?? 0) >= 5 ? '주의 구간'
                        : '정상 범위'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── 4 KPI 그래프 ── */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">집중도 KPI 그래프</p>

                {/* 1. 주간 학습시간 성장률 */}
                <div className="rounded-xl border border-slate-100 bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">주간 학습시간 성장률</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">막대: 주간 누적 학습분 · 선: 전주 대비 성장률</p>
                    </div>
                    {weeklyGrowthData.length > 0 && (
                      <span className={cn('text-xs font-black',
                        (weeklyGrowthData[weeklyGrowthData.length - 1]?.growth ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      )}>
                        이번 주 {(weeklyGrowthData[weeklyGrowthData.length - 1]?.growth ?? 0) >= 0 ? '+' : ''}{weeklyGrowthData[weeklyGrowthData.length - 1]?.growth ?? 0}%
                      </span>
                    )}
                  </div>
                  {trendLoading ? (
                    <div className="h-[160px] flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
                  ) : !hasWeeklyGrowthData ? (
                    <div className="h-[160px] flex items-center justify-center text-xs font-bold text-slate-400">데이터를 수집 중입니다.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={160}>
                      <ComposedChart data={weeklyGrowthData} margin={{ top: 8, right: 36, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="min" tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={32} tickFormatter={(v) => `${Math.round(v / 60)}h`} />
                        <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 9, fontWeight: 700, fill: '#10b981' }} tickLine={false} axisLine={false} width={30} tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          formatter={(v: number, name: string) => name === 'totalMinutes' ? [`${Math.floor(v / 60)}h ${v % 60}m`, '주간 학습'] : [`${v >= 0 ? '+' : ''}${v}%`, '성장률']}
                          contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '11px', fontWeight: 700 }}
                        />
                        <Bar yAxisId="min" dataKey="totalMinutes" fill="#c7d2fe" radius={[5, 5, 0, 0]} />
                        <Line yAxisId="pct" type="monotone" dataKey="growth" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                  <div className="mt-2 flex items-center gap-4 justify-end">
                    <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded bg-indigo-200" /><p className="text-[9px] font-bold text-slate-400">누적 학습시간</p></div>
                    <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-emerald-500" /><p className="text-[9px] font-bold text-slate-400">성장률</p></div>
                  </div>
                </div>

                {/* 2. 일자별 학습시간 성장률 (7일 단위) */}
                <div className="rounded-xl border border-slate-100 bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">일자별 학습시간 성장률</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">최근 42일 중 7일 단위로 확인합니다.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {dailyGrowthWindowData.length > 0 && (
                        <span className={cn('text-xs font-black',
                          (dailyGrowthWindowData[dailyGrowthWindowData.length - 1]?.growth ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        )}>
                          최근 7일 {(dailyGrowthWindowData[dailyGrowthWindowData.length - 1]?.growth ?? 0) >= 0 ? '+' : ''}{dailyGrowthWindowData[dailyGrowthWindowData.length - 1]?.growth ?? 0}%
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[10px] font-black"
                        onClick={() => setDailyGrowthWindowIndex((prev) => Math.min(prev + 1, dailyGrowthWindowCount - 1))}
                        disabled={boundedDailyGrowthWindowIndex >= dailyGrowthWindowCount - 1}
                      >
                        이전 7일
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[10px] font-black"
                        onClick={() => setDailyGrowthWindowIndex((prev) => Math.max(prev - 1, 0))}
                        disabled={boundedDailyGrowthWindowIndex <= 0}
                      >
                        다음 7일
                      </Button>
                    </div>
                  </div>
                  {trendLoading ? (
                    <div className="h-[140px] flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
                  ) : !hasDailyGrowthData ? (
                    <div className="h-[140px] flex items-center justify-center text-xs font-bold text-slate-400">데이터를 수집 중입니다.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={140}>
                      <ComposedChart data={dailyGrowthWindowData} margin={{ top: 8, right: 36, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="min" tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={32} tickFormatter={(v) => `${Math.round(v / 60)}h`} />
                        <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 9, fontWeight: 700, fill: '#f59e0b' }} tickLine={false} axisLine={false} width={30} tickFormatter={(v) => `${v}%`} />
                        <Tooltip
                          formatter={(v: number, name: string) => name === 'avgMinutes' ? [`${Math.floor(v / 60)}h ${v % 60}m`, '일 평균'] : [`${v >= 0 ? '+' : ''}${v}%`, '전월 대비']}
                          contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '11px', fontWeight: 700 }}
                        />
                        <Bar yAxisId="min" dataKey="avgMinutes" fill="#bae6fd" radius={[5, 5, 0, 0]} barSize={40} />
                        <Line yAxisId="pct" type="monotone" dataKey="growth" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 5, fill: '#f59e0b', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                  <div className="mt-2 flex items-center gap-4 justify-end">
                    <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded bg-sky-200" /><p className="text-[9px] font-bold text-slate-400">일 평균 학습시간</p></div>
                    <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-amber-400" /><p className="text-[9px] font-bold text-slate-400">전월 대비 성장률</p></div>
                  </div>
                </div>

                {/* 3. 리듬점수 변화 그래프 */}
                <div className="rounded-xl border border-slate-100 bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">리듬점수 변화 그래프</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">최근 14일 기준 리듬 점수 변화 추이</p>
                    </div>
                    <Badge variant="outline" className="h-6 px-2 text-[10px] font-black">
                      평균 {averageRhythmScore}점
                    </Badge>
                  </div>
                  {trendLoading ? (
                    <div className="h-[130px] flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
                  ) : !hasRhythmScoreChangeData ? (
                    <div className="h-[130px] flex items-center justify-center text-xs font-bold text-slate-400">리듬 점수 데이터를 수집 중입니다.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={130}>
                      <LineChart data={rhythmScoreTrendData} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={28} />
                        <Tooltip
                          formatter={(v: number) => [`${Math.round(v)}점`, '리듬 점수']}
                          contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '11px', fontWeight: 700 }}
                        />
                        <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* 4. 학습 시간 분포 리듬 */}
                <div className="rounded-xl border border-slate-100 bg-white p-4">
                                    <div className="mb-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">학습 시간 분포 리듬</p>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5">최근 7일 기준 첫 공부 시작시간과 마지막 공부 종료시간</p>
                  </div>
                  {trendLoading ? (
                    <div className="h-[130px] flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
                  ) : !hasRhythmData ? (
                    <div className="h-[130px] flex items-center justify-center text-xs font-bold text-slate-400">데이터를 수집 중입니다.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={130}>
                      <ComposedChart data={rhythmData} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 800, fill: '#475569' }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 24]} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={32} tickFormatter={(v) => `${v}h`} />
                        <Tooltip
                          formatter={(v: number, name: string) => [`${Math.floor(v)}:${Math.round((v % 1) * 60).toString().padStart(2, '0')}`, name === 'startHour' ? '시작시간' : '종료시간']}
                          contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '11px', fontWeight: 700 }}
                        />
                        <Line type="monotone" dataKey="startHour" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 3, fill: '#0ea5e9', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                        <Line type="monotone" dataKey="endHour" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                  <div className="mt-2 flex items-center gap-4 justify-end">
                    <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-sky-500" /><p className="text-[9px] font-bold text-slate-400">첫 시작시간</p></div>
                    <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-violet-500" /><p className="text-[9px] font-bold text-slate-400">마지막 종료시간</p></div>
                  </div>
                </div>

                {/* 5. 학습 중간 외출시간 성장률 */}
                <div className="rounded-xl border border-slate-100 bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">학습 중간 외출시간 추이</p>
                      <p className="text-[9px] font-bold text-rose-400 mt-0.5">외출시간이 늘어날수록 집중도가 떨어집니다 ↑ 주의</p>
                    </div>
                    {dayDataLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-300" />}
                  </div>
                  {awayTimeData.every((d) => d.awayMinutes === 0) ? (
                    <div className="h-[130px] flex flex-col items-center justify-center gap-1 text-xs font-bold text-slate-400">
                      <p>세션 기록이 없습니다.</p>
                      <p className="text-[9px] font-bold text-slate-300">6시간 이상 연속 학습 세션부터 외출 데이터가 수집됩니다.</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={130}>
                      <ComposedChart data={awayTimeData} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={28} tickFormatter={(v) => `${v}m`} />
                        <Tooltip
                          formatter={(v: number) => [`${v}분`, '외출시간']}
                          contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '11px', fontWeight: 700 }}
                        />
                        <Bar dataKey="awayMinutes" fill="#fca5a5" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="awayMinutes" stroke="#ef4444" strokeWidth={2} dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* ── 관리자 인사이트 ── */}
              {selectedFocusKpi && selectedFocusKpi.insights.length > 0 && (
                <div className="rounded-xl border border-[#14295F]/15 bg-[linear-gradient(145deg,#eef4ff_0%,#f8faff_100%)] p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Sparkles className="h-4 w-4 text-[#14295F]/50 flex-shrink-0" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#14295F]/60">관리자 인사이트</p>
                  </div>
                  <div className="space-y-2">
                    {selectedFocusKpi.insights.map((insight, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#14295F]/40 flex-shrink-0" />
                        <p className="text-xs font-bold text-[#14295F]/80 leading-relaxed">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ── FOOTER ── */}
          <DialogFooter className="border-t bg-white p-4 flex-shrink-0">
            <DialogClose asChild>
              <Button className="h-10 rounded-xl font-black">닫기</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  <div key={row.bucketKey} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
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
                          {report.viewedAt && (
                            <Badge className="h-5 border-none bg-emerald-100 px-2 text-[10px] font-black text-emerald-700">
                              {report.viewedByName ? `${report.viewedByName} 읽음` : '읽음'}
                            </Badge>
                          )}
                          {report.viewedAt && (
                            <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                              {`열람 시각 ${format(report.viewedAt.toDate(), 'yyyy.MM.dd HH:mm')}`}
                            </p>
                          )}
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
