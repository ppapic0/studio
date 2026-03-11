
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  Armchair, 
  Loader2, 
  MessageSquare, 
  ChevronRight, 
  Activity, 
  Monitor,
  AlertCircle,
  Clock,
  Zap,
  Users,
  Trophy,
  User,
  Sparkles,
  ArrowRight,
  Settings2,
  UserPlus,
  Search,
  Check,
  X,
  Map as MapIcon,
  ArrowRightLeft,
  Grid3X3,
  Save,
  History,
  Timer,
  LogIn,
  LogOut,
  Filter,
  LayoutGrid,
  BarChart3,
  TrendingUp,
  FileText,
  FileSearch,
  ChevronLeft,
  CheckCircle2,
  Eye,
  MapPin,
  ShieldAlert,
  RotateCcw
} from 'lucide-react';
import { useCollection, useFirestore, useDoc, useFunctions, useMemoFirebase, useUser } from '@/firebase';
import { useAppContext, TIERS } from '@/contexts/app-context';
import { 
  collection, 
  query, 
  orderBy, 
  where,
  Timestamp,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  setDoc,
  getDocs,
  limit,
  increment,
  getDoc
} from 'firebase/firestore';
import { StudentProfile, AttendanceCurrent, StudyLogDay, CounselingReservation, CenterMembership, StudySession, StudyPlanItem, DailyReport, DailyStudentStat, GrowthProgress, AttendanceRequest, PenaltyLog } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, subDays, eachDayOfInterval } from 'date-fns';
import { ko } from 'date-fns/locale';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { sendKakaoNotification } from '@/lib/kakao-service';
import { httpsCallable } from 'firebase/functions';

const CustomTooltip = ({ active, payload, label, unit = '시간' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-xl border-2 border-primary/10 p-5 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] ring-1 ring-black/5 animate-in fade-in zoom-in duration-300">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{label}</p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-black text-primary tracking-tighter drop-shadow-sm">{payload[0].value}</span>
          <span className="text-xs font-black text-primary/60">{unit}</span>
        </div>
      </div>
    );
  }
  return null;
};

const REQUEST_PENALTY_POINTS: Record<'late' | 'absence', number> = {
  late: 1,
  absence: 2,
};

function resolveRequestPenalty(req: Partial<AttendanceRequest>) {
  const explicitDelta = Number((req as any).penaltyPointsDelta);
  if (Number.isFinite(explicitDelta) && explicitDelta > 0) {
    return explicitDelta;
  }
  if (req.type === 'absence') return REQUEST_PENALTY_POINTS.absence;
  return REQUEST_PENALTY_POINTS.late;
}

export function TeacherDashboard({ isActive }: { isActive: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const functions = useFunctions();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';
  
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<number>(Date.now());
  const [selectedSeat, setSelectedSeat] = useState<AttendanceCurrent | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedStudentSessions, setSelectedStudentSessions] = useState<StudySession[]>([]);
  const [selectedStudentReports, setSelectedStudentReports] = useState<DailyReport[]>([]);
  const [selectedStudentHistory, setSelectedStudentHistory] = useState<StudyLogDay[]>([]);
  const [selectedStudentPenaltyPoints, setSelectedStudentPenaltyPoints] = useState(0);
  const [selectedStudentPenaltyLogs, setSelectedStudentPenaltyLogs] = useState<PenaltyLog[]>([]);
  const [selectedReportPreview, setSelectedReportPreview] = useState<DailyReport | null>(null);
  const [selectedRecentReport, setSelectedRecentReport] = useState<DailyReport | null>(null);
  const [manualPenaltyPoints, setManualPenaltyPoints] = useState('1');
  const [manualPenaltyReason, setManualPenaltyReason] = useState('');
  const [isPenaltySaving, setIsPenaltySaving] = useState(false);
  const [isPenaltyGuideOpen, setIsPenaltyGuideOpen] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [historicalCenterMinutes, setHistoricalCenterMinutes] = useState<Record<string, number>>({});
  const [trendLoading, setTrendLoading] = useState(false);
  const staleSeatCleanupInFlightRef = useRef(false);
  
  const [selectedClass, setSelectedClass] = useState<string>('all');

  const [gridRows, setGridRows] = useState(7);
  const [gridCols, setGridCols] = useState(10);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const centerId = activeMembership?.id;
  const canAdjustPenalty =
    activeMembership?.role === 'teacher' ||
    activeMembership?.role === 'centerAdmin' ||
    activeMembership?.role === 'owner';
  const canResetPenalty =
    activeMembership?.role === 'centerAdmin' ||
    activeMembership?.role === 'owner';
  const canTriggerAttendanceSms =
    activeMembership?.role === 'teacher' ||
    activeMembership?.role === 'centerAdmin' ||
    activeMembership?.role === 'owner';

  const triggerAttendanceSms = async (
    studentId: string,
    eventType: 'check_in' | 'check_out'
  ) => {
    if (!functions || !centerId || !canTriggerAttendanceSms) return;

    try {
      const notifyAttendanceSmsFn = httpsCallable(functions, 'notifyAttendanceSms');
      await notifyAttendanceSmsFn({ centerId, studentId, eventType });
    } catch (error) {
      console.warn('[teacher] notifyAttendanceSms failed', error);
    }
  };
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgoKey = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const centerRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId);
  }, [firestore, centerId]);
  const { data: centerData } = useDoc<any>(centerRef);

  useEffect(() => {
    if (centerData?.layoutSettings) {
      setGridRows(centerData.layoutSettings.rows || 7);
      setGridCols(centerData.layoutSettings.cols || 10);
    }
  }, [centerData]);

  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'students'), orderBy('name', 'asc'));
  }, [firestore, centerId]);
  const { data: students, isLoading: studentsLoading } = useCollection<StudentProfile>(studentsQuery, { enabled: isActive });

  const studentMembersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'student'));
  }, [firestore, centerId]);
  const { data: studentMembers } = useCollection<CenterMembership>(studentMembersQuery, { enabled: isActive });

  const availableClasses = useMemo(() => {
    if (!studentMembers) return [];
    const classes = new Set<string>();
    studentMembers.forEach(m => {
      if (m.className) classes.add(m.className);
    });
    return Array.from(classes).sort();
  }, [studentMembers]);

  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isActive) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId, isActive]);
  const { data: attendanceList, isLoading: attendanceLoading } = useCollection<AttendanceCurrent>(attendanceQuery, { enabled: isActive });

  useEffect(() => {
    if (!firestore || !centerId || !isActive) return;
    if (!attendanceList || !students || !studentMembers) return;
    if (staleSeatCleanupInFlightRef.current) return;

    const knownStudentIds = new Set<string>();
    students.forEach((student) => {
      if (typeof student.id === 'string' && student.id.trim()) {
        knownStudentIds.add(student.id.trim());
      }
    });
    studentMembers.forEach((member) => {
      if (typeof member.id === 'string' && member.id.trim()) {
        knownStudentIds.add(member.id.trim());
      }
    });

    const staleSeats = attendanceList.filter((seat) => {
      const seatStudentId = typeof seat.studentId === 'string' ? seat.studentId.trim() : '';
      if (!seatStudentId) return false;
      return !knownStudentIds.has(seatStudentId);
    });

    if (staleSeats.length === 0) return;

    staleSeatCleanupInFlightRef.current = true;
    (async () => {
      try {
        const batch = writeBatch(firestore);
        staleSeats.forEach((seat) => {
          batch.set(
            doc(firestore, 'centers', centerId, 'attendanceCurrent', seat.id),
            {
              studentId: null,
              status: 'absent',
              lastCheckInAt: null,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        });
        await batch.commit();
      } catch (cleanupError) {
        console.warn('[teacher-dashboard] stale seat cleanup failed', cleanupError);
      } finally {
        staleSeatCleanupInFlightRef.current = false;
      }
    })();
  }, [firestore, centerId, isActive, attendanceList, students, studentMembers]);

  const todayStatsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return collection(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students');
  }, [firestore, centerId, todayKey]);
  const { data: todayStats } = useCollection<DailyStudentStat>(todayStatsQuery, { enabled: isActive });

  useEffect(() => {
    let disposed = false;
    if (!firestore || !centerId || !isActive || !studentMembers) {
      setHistoricalCenterMinutes({});
      return;
    }

    const targetStudents = studentMembers.filter((m) =>
      m.status === 'active' && (selectedClass === 'all' || m.className === selectedClass)
    );
    if (targetStudents.length === 0) {
      setHistoricalCenterMinutes({});
      return;
    }

    const loadHistoricalTrend = async () => {
      setTrendLoading(true);
      try {
        const bucket: Record<string, number> = {};
        await Promise.all(
          targetStudents.map(async (student) => {
            const daysRef = collection(firestore, 'centers', centerId, 'studyLogs', student.id, 'days');
            const daysSnap = await getDocs(
              query(
                daysRef,
                where('dateKey', '>=', thirtyDaysAgoKey),
                where('dateKey', '<', todayKey)
              )
            );

            daysSnap.forEach((snap) => {
              const raw = snap.data() as Partial<StudyLogDay>;
              const dateKey = typeof raw.dateKey === 'string' ? raw.dateKey : snap.id;
              if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
              const mins = Number(raw.totalMinutes || 0);
              if (!Number.isFinite(mins) || mins < 0) return;
              bucket[dateKey] = (bucket[dateKey] || 0) + mins;
            });
          })
        );

        if (!disposed) {
          setHistoricalCenterMinutes(bucket);
        }
      } catch (error) {
        console.error('Historical trend load failed:', error);
        if (!disposed) {
          setHistoricalCenterMinutes({});
        }
      } finally {
        if (!disposed) {
          setTrendLoading(false);
        }
      }
    };

    loadHistoricalTrend();
    return () => {
      disposed = true;
    };
  }, [firestore, centerId, isActive, studentMembers, selectedClass, thirtyDaysAgoKey, todayKey]);
  const getStudentStudyTimes = (studentId: string, status: string, lastCheckInAt?: Timestamp) => {
    if (!mounted) return { session: '00:00', total: '0h 0m', isStudying: false, totalMins: 0, sessionSecs: 0 };
    
    const studentStat = todayStats?.find(s => s.studentId === studentId);
    const cumulativeMinutes = studentStat?.totalStudyMinutes || 0;
    
    let sessionSeconds = 0;
    if (status === 'studying' && lastCheckInAt) {
      const startTime = lastCheckInAt.toMillis();
      sessionSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
    }

    const sessionMinutes = Math.ceil(sessionSeconds / 60);
    const totalMinutes = cumulativeMinutes + Math.max(0, sessionMinutes);

    const formatSession = (secs: number) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const formatTotal = (mins: number) => {
      const hh = Math.floor(mins / 60);
      const mm = mins % 60;
      return `${hh}h ${mm}m`;
    };

    return {
      session: formatSession(sessionSeconds),
      total: formatTotal(totalMinutes),
      totalMins: totalMinutes,
      sessionSecs: sessionSeconds,
      isStudying: status === 'studying'
    };
  };

  const stats = useMemo(() => {
    if (!mounted || !attendanceList || !studentMembers) return { studying: 0, absent: 0, away: 0, total: 0, totalCenterMinutes: 0, avgMinutes: 0, top20Avg: 0 };

    let studying = 0;
    let away = 0;
    let totalMins = 0;
    let filteredLiveMinutes: number[] = [];

    const filteredMembers = studentMembers.filter(m => 
      (selectedClass === 'all' || m.className === selectedClass) && m.status === 'active'
    );
    const targetMemberIds = new Set(filteredMembers.map(m => m.id));

    filteredMembers.forEach(member => {
      const seat = attendanceList.find(a => a.studentId === member.id);
      const status = seat?.status || 'absent';
      const timeInfo = getStudentStudyTimes(member.id, status, seat?.lastCheckInAt);
      
      totalMins += timeInfo.totalMins;
      filteredLiveMinutes.push(timeInfo.totalMins);

      if (status === 'studying') studying++;
      else if (status === 'away' || status === 'break') away++;
    });

    const aisleIds = new Set(attendanceList.filter(s => s.type === 'aisle').map(s => s.id));
    let totalPhysicalSeats = 0;
    for(let i = 1; i <= gridRows * gridCols; i++) {
        const sid = `seat_${i.toString().padStart(3, '0')}`;
        if(!aisleIds.has(sid)) totalPhysicalSeats++;
    }

    let totalDisplayCount = selectedClass !== 'all' ? targetMemberIds.size : totalPhysicalSeats;
    let absent = Math.max(0, totalDisplayCount - studying - away);

    const avgMinutes = filteredLiveMinutes.length > 0 ? Math.round(totalMins / filteredLiveMinutes.length) : 0;
    const sortedMinutes = [...filteredLiveMinutes].sort((a, b) => b - a);
    const top20Count = Math.max(1, Math.ceil(sortedMinutes.length * 0.2));
    const top20Avg = sortedMinutes.length > 0 ? Math.round(sortedMinutes.slice(0, top20Count).reduce((acc, m) => acc + m, 0) / top20Count) : 0;

    return { studying, absent, away, total: totalDisplayCount, totalCenterMinutes: totalMins, avgMinutes, top20Avg };
  }, [attendanceList, todayStats, studentMembers, selectedClass, now, mounted, gridRows, gridCols]);

  const centerTrendData = useMemo(() => {
    if (!mounted) return [];

    const dateRange = eachDayOfInterval({
      start: subDays(new Date(), 29),
      end: new Date(),
    });

    return dateRange.map((day) => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const totalMinutes = dateKey === todayKey
        ? stats.totalCenterMinutes
        : historicalCenterMinutes[dateKey] || 0;

      return {
        name: dateKey.split('-').slice(1).join('/'),
        hours: Number((totalMinutes / 60).toFixed(1)),
        totalMinutes,
        dateKey,
      };
    });
  }, [historicalCenterMinutes, stats.totalCenterMinutes, todayKey, mounted]);
  const recentReportsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'dailyReports'),
      where('status', '==', 'sent')
    );
  }, [firestore, centerId]);
  const { data: rawRecentReports } = useCollection<DailyReport>(recentReportsQuery, { enabled: isActive });

  const recentReportsFeed = useMemo(() => {
    if (!rawRecentReports) return [];
    return [...rawRecentReports]
      .sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0))
      .slice(0, 5);
  }, [rawRecentReports]);

  const appointmentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    const todayDate = new Date();
    return query(
      collection(firestore, 'centers', centerId, 'counselingReservations'), 
      where('scheduledAt', '>=', Timestamp.fromDate(startOfDay(todayDate))), 
      where('scheduledAt', '<=', Timestamp.fromDate(endOfDay(todayDate)))
    );
  }, [firestore, centerId]);
  const { data: rawAppointments, isLoading: aptLoading } = useCollection<CounselingReservation>(appointmentsQuery, { enabled: isActive });

  const appointments = useMemo(() => rawAppointments ? [...rawAppointments].sort((a,b)=>(b.scheduledAt?.toMillis()||0)-(a.createdAt?.toMillis()||0)) : [], [rawAppointments]);

  const unassignedStudents = useMemo(() => {
    if (!students || !studentMembers) return [];
    return students.filter(s => {
      const membership = studentMembers.find(m => m.id === s.id);
      return membership?.status === 'active' && (!s.seatNo || s.seatNo === 0);
    }).filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [students, studentMembers, searchTerm]);

  const selectedStudentName = useMemo(() => {
    if (!selectedSeat?.studentId) return '학생';
    const matched = students?.find((student) => student.id === selectedSeat.studentId);
    return matched?.name || '학생';
  }, [students, selectedSeat?.studentId]);

  const selectedPenaltyRecovery = useMemo(() => {
    const basePoints = Math.max(0, Math.round(Number(selectedStudentPenaltyPoints || 0)));
    const latestPositiveLog = [...(selectedStudentPenaltyLogs || [])]
      .filter((log) => Number(log.pointsDelta || 0) > 0)
      .sort((a, b) => ((b.createdAt as any)?.toMillis?.() || 0) - ((a.createdAt as any)?.toMillis?.() || 0))[0];

    const latestPositiveMs = latestPositiveLog ? ((latestPositiveLog.createdAt as any)?.toMillis?.() || 0) : 0;
    const daysSinceLatest = latestPositiveMs > 0 ? Math.max(0, Math.floor((Date.now() - latestPositiveMs) / (24 * 60 * 60 * 1000))) : 0;
    const recoveredPoints = latestPositiveMs > 0 ? Math.min(basePoints, Math.floor(daysSinceLatest / 7)) : 0;
    const effectivePoints = Math.max(0, basePoints - recoveredPoints);

    return {
      basePoints,
      recoveredPoints,
      effectivePoints,
      latestPositiveLabel: latestPositiveMs > 0 ? format(new Date(latestPositiveMs), 'yyyy.MM.dd HH:mm') : '-',
    };
  }, [selectedStudentPenaltyPoints, selectedStudentPenaltyLogs]);

  const fetchStudentDetails = async (studentId: string) => {
    if (!firestore || !centerId) return;
    setSessionsLoading(true);
    try {
      const sessionRef = collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', todayKey, 'sessions');
      const sessionSnap = await getDocs(sessionRef);
      const sessions = sessionSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudySession));
      
      const reportRef = collection(firestore, 'centers', centerId, 'dailyReports');
      const reportSnap = await getDocs(query(reportRef, where('studentId', '==', studentId), where('status', '==', 'sent')));
      const reports = reportSnap.docs.map(d => ({ id: d.id, ...d.data() } as DailyReport));

      const historyRef = collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days');
      const historySnap = await getDocs(query(historyRef, limit(30)));
      const history = historySnap.docs.map(d => {
        const data = d.data();
        return { 
          ...data, 
          dateKey: data.dateKey || d.id,
          totalMinutes: Number(data.totalMinutes || 0)
        } as StudyLogDay;
      });

      const progressRef = doc(firestore, 'centers', centerId, 'growthProgress', studentId);
      const progressSnap = await getDoc(progressRef);
      const progressData = progressSnap.exists() ? (progressSnap.data() as GrowthProgress) : null;
      const penaltyPoints = Number(progressData?.penaltyPoints || 0);

      const penaltyLogsRef = collection(firestore, 'centers', centerId, 'penaltyLogs');
      const penaltyLogsSnap = await getDocs(query(penaltyLogsRef, where('studentId', '==', studentId), limit(30)));
      const penaltyLogs = penaltyLogsSnap.docs.map((snap) => ({
        id: snap.id,
        ...(snap.data() as Omit<PenaltyLog, 'id'>),
      } as PenaltyLog));
      const loggedAttendanceRequestIds = new Set(
        penaltyLogs
          .filter((log) => log.source === 'attendance_request' && typeof log.requestId === 'string')
          .map((log) => log.requestId as string)
      );

      const requestRef = collection(firestore, 'centers', centerId, 'attendanceRequests');
      const requestSnap = await getDocs(query(requestRef, where('studentId', '==', studentId), limit(30)));
      const requestLogs: PenaltyLog[] = requestSnap.docs
        .map((snap) => ({ id: snap.id, ...(snap.data() as Omit<AttendanceRequest, 'id'>) } as AttendanceRequest))
        .filter((req) => req.penaltyApplied && !loggedAttendanceRequestIds.has(req.id))
        .map((req) => ({
          id: `attendance_request_${req.id}`,
          centerId,
          studentId,
          studentName: req.studentName,
          pointsDelta: resolveRequestPenalty(req),
          reason: req.reason || '지각/결석 신청',
          source: 'attendance_request' as const,
          requestId: req.id,
          requestType: req.type,
          createdAt: req.createdAt || Timestamp.now(),
        } as PenaltyLog));

      const mergedPenaltyLogs = [...penaltyLogs, ...requestLogs]
        .sort((a, b) => ((b.createdAt as any)?.toMillis?.() || 0) - ((a.createdAt as any)?.toMillis?.() || 0))
        .slice(0, 30);

      setSelectedStudentSessions(sessions.sort((a, b) => b.startTime.toMillis() - a.startTime.toMillis()));
      setSelectedStudentReports(reports.sort((a, b) => b.dateKey.localeCompare(a.dateKey)).slice(0, 5));
      setSelectedStudentHistory(history.sort((a, b) => b.dateKey.localeCompare(a.dateKey)).slice(0, 14));
      setSelectedStudentPenaltyPoints(penaltyPoints);
      setSelectedStudentPenaltyLogs(mergedPenaltyLogs);
      setSelectedReportPreview(null);

    } catch (e) {
      console.error("Student Details Fetch Error:", e);
      toast({ variant: "destructive", title: "정보 로드 실패", description: "데이터를 불러오는 중 문제가 발생했습니다." });
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleSeatClick = (seat: AttendanceCurrent) => {
    setSelectedSeat(seat);
    if (isEditMode) {
      if (seat.studentId) {
        setIsManaging(true);
        fetchStudentDetails(seat.studentId);
      }
      else setIsAssigning(true);
    } else {
      if (seat.studentId && seat.type !== 'aisle') {
        setIsManaging(true);
        fetchStudentDetails(seat.studentId);
      }
    }
  };

  const appendPenaltyLogLocally = (log: PenaltyLog) => {
    setSelectedStudentPenaltyLogs((prev) =>
      [log, ...prev]
        .sort((a, b) => ((b.createdAt as any)?.toMillis?.() || 0) - ((a.createdAt as any)?.toMillis?.() || 0))
        .slice(0, 30)
    );
  };

  const handleAddPenalty = async () => {
    if (!firestore || !centerId || !selectedSeat?.studentId || !canAdjustPenalty || !user) return;

    const parsedPoints = Number.parseInt(manualPenaltyPoints, 10);
    if (!Number.isFinite(parsedPoints) || parsedPoints <= 0) {
      toast({
        variant: 'destructive',
        title: '벌점 점수를 확인해 주세요.',
        description: '1 이상 숫자만 입력할 수 있습니다.',
      });
      return;
    }

    const trimmedReason = manualPenaltyReason.trim();
    if (trimmedReason.length < 2) {
      toast({
        variant: 'destructive',
        title: '벌점 사유를 입력해 주세요.',
      });
      return;
    }

    setIsPenaltySaving(true);
    try {
      const studentId = selectedSeat.studentId;
      const progressRef = doc(firestore, 'centers', centerId, 'growthProgress', studentId);
      const penaltyLogRef = doc(collection(firestore, 'centers', centerId, 'penaltyLogs'));
      const batch = writeBatch(firestore);

      batch.set(progressRef, {
        penaltyPoints: increment(parsedPoints),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      batch.set(penaltyLogRef, {
        centerId,
        studentId,
        studentName: selectedStudentName,
        pointsDelta: parsedPoints,
        reason: trimmedReason,
        source: 'manual',
        createdByUserId: user.uid,
        createdByName: user.displayName || '운영자',
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      setSelectedStudentPenaltyPoints((prev) => prev + parsedPoints);
      appendPenaltyLogLocally({
        id: penaltyLogRef.id,
        centerId,
        studentId,
        studentName: selectedStudentName,
        pointsDelta: parsedPoints,
        reason: trimmedReason,
        source: 'manual',
        createdByUserId: user.uid,
        createdByName: user.displayName || '운영자',
        createdAt: Timestamp.now(),
      });
      setManualPenaltyReason('');
      setManualPenaltyPoints('1');

      toast({
        title: '벌점이 부여되었습니다.',
        description: `${selectedStudentName} 학생에게 ${parsedPoints}점을 부여했습니다.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '벌점 부여 실패',
        description: error?.message || '서버 갱신 중 오류가 발생했습니다.',
      });
    } finally {
      setIsPenaltySaving(false);
    }
  };

  const handleResetPenalty = async () => {
    if (!firestore || !centerId || !selectedSeat?.studentId || !canResetPenalty || !user) return;

    const currentPoints = Math.max(0, Number(selectedStudentPenaltyPoints || 0));
    if (currentPoints <= 0) {
      toast({
        title: '초기화할 벌점이 없습니다.',
      });
      return;
    }

    setIsPenaltySaving(true);
    try {
      const studentId = selectedSeat.studentId;
      const progressRef = doc(firestore, 'centers', centerId, 'growthProgress', studentId);
      const penaltyLogRef = doc(collection(firestore, 'centers', centerId, 'penaltyLogs'));
      const batch = writeBatch(firestore);

      batch.set(progressRef, {
        penaltyPoints: 0,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      batch.set(penaltyLogRef, {
        centerId,
        studentId,
        studentName: selectedStudentName,
        pointsDelta: -currentPoints,
        reason: '센터관리자 벌점 초기화',
        source: 'reset',
        createdByUserId: user.uid,
        createdByName: user.displayName || '센터관리자',
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      setSelectedStudentPenaltyPoints(0);
      appendPenaltyLogLocally({
        id: penaltyLogRef.id,
        centerId,
        studentId,
        studentName: selectedStudentName,
        pointsDelta: -currentPoints,
        reason: '센터관리자 벌점 초기화',
        source: 'reset',
        createdByUserId: user.uid,
        createdByName: user.displayName || '센터관리자',
        createdAt: Timestamp.now(),
      });

      toast({
        title: '벌점이 초기화되었습니다.',
        description: `${selectedStudentName} 학생의 벌점을 0점으로 변경했습니다.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '벌점 초기화 실패',
        description: error?.message || '서버 갱신 중 오류가 발생했습니다.',
      });
    } finally {
      setIsPenaltySaving(false);
    }
  };

  useEffect(() => {
    if (!isManaging) {
      setSelectedReportPreview(null);
      setManualPenaltyReason('');
      setManualPenaltyPoints('1');
    }
  }, [isManaging]);

  const handleStatusUpdate = async (nextStatus: AttendanceCurrent['status']) => {
    if (!firestore || !centerId || !selectedSeat) return;
    const studentId = selectedSeat.studentId;
    if (!studentId) return;

    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const seatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id);
      const prevStatus = selectedSeat.status;

      // 퇴실 처리 시 공부 시간 강제 저장 로직
      if (prevStatus === 'studying' && nextStatus !== 'studying' && selectedSeat.lastCheckInAt) {
        const nowTs = Date.now();
        const startTime = selectedSeat.lastCheckInAt.toMillis();
        const sessionSeconds = Math.max(0, Math.floor((nowTs - startTime) / 1000));
        const sessionMinutes = Math.max(1, Math.ceil(sessionSeconds / 60));

        if (sessionSeconds > 0) {
          const logRef = doc(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', todayKey);
          batch.set(logRef, { totalMinutes: increment(sessionMinutes), studentId, centerId, dateKey: todayKey, updatedAt: serverTimestamp() }, { merge: true });

          const sessionRef = doc(collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', todayKey, 'sessions'));
          batch.set(sessionRef, { startTime: selectedSeat.lastCheckInAt, endTime: Timestamp.fromMillis(nowTs), durationMinutes: sessionMinutes, createdAt: serverTimestamp() });

          const statRef = doc(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students', studentId);
          batch.set(statRef, { totalStudyMinutes: increment(sessionMinutes), studentId, centerId, dateKey: todayKey, updatedAt: serverTimestamp() }, { merge: true });

          const progressRef = doc(firestore, 'centers', centerId, 'growthProgress', studentId);
          const progressSnap = await getDoc(progressRef);
          const p = progressSnap.exists() ? (progressSnap.data() as GrowthProgress) : null;
          const stats = p?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
          const totalBoost = 1 + (stats.focus/100 * 0.05) + (stats.consistency/100 * 0.05) + (stats.achievement/100 * 0.05) + (stats.resilience/100 * 0.05);
          const penaltyPoints = p?.penaltyPoints || 0;
          const penaltyRate = penaltyPoints >= 30 ? 0.15 : penaltyPoints >= 20 ? 0.10 : penaltyPoints >= 10 ? 0.06 : penaltyPoints >= 5 ? 0.03 : 0;
          const finalMultiplier = totalBoost * (1 - penaltyRate);

          const studyLpEarned = Math.round(sessionMinutes * finalMultiplier);
          const progressUpdate: Record<string, any> = {
            seasonLp: increment(studyLpEarned),
            stats: {
              focus: increment((sessionMinutes / 60) * 0.1),
            },
            dailyLpStatus: {
              [todayKey]: {
                dailyLpAmount: increment(studyLpEarned),
              },
            },
            updatedAt: serverTimestamp(),
          };
          batch.set(progressRef, progressUpdate, { merge: true });
        }
      }

      const updateData: any = { 
        status: nextStatus, 
        updatedAt: serverTimestamp(),
        ...(nextStatus === 'studying' ? { lastCheckInAt: serverTimestamp() } : {})
      };

      batch.update(seatRef, updateData);
      await batch.commit();
      // 카카오 알림톡 발송 (선생님 수동 조작)
      const studentName = students?.find(s => s.id === studentId)?.name || '학생';
      const kakaoType: any = nextStatus === 'studying' ? 'entry' : nextStatus === 'away' ? 'away' : 'exit';
      sendKakaoNotification(firestore, centerId, {
        studentName,
        type: kakaoType
      });

      if (nextStatus === 'studying') {
        void triggerAttendanceSms(studentId, 'check_in');
      } else if (nextStatus === 'absent' && prevStatus !== 'absent') {
        void triggerAttendanceSms(studentId, 'check_out');
      }
      
      toast({ title: "학생 상태가 업데이트되었습니다." });
      setIsManaging(false);
    } catch (e: any) {
      console.error("Manual Status Update Error:", e);
      toast({ variant: "destructive", title: "변경 실패", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateZone = async (zone: string) => {
    if (!firestore || !centerId || !selectedSeat) return;
    setIsSaving(true);
    try {
      const seatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id);
      await updateDoc(seatRef, { seatZone: zone, updatedAt: serverTimestamp() });
      
      if (selectedSeat.studentId) {
        const studentRef = doc(firestore, 'centers', centerId, 'students', selectedSeat.studentId);
        await updateDoc(studentRef, { seatZone: zone, updatedAt: serverTimestamp() });
      }
      
      toast({ title: "구역 설정이 완료되었습니다." });
      setSelectedSeat({ ...selectedSeat, seatZone: zone });
    } catch (e) {
      toast({ variant: "destructive", title: "설정 실패" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGridSettings = async () => {
    if (!firestore || !centerId) return;
    setIsSaving(true);
    try {
      await setDoc(doc(firestore, 'centers', centerId), {
        layoutSettings: { rows: gridRows, cols: gridCols, updatedAt: serverTimestamp() }
      }, { merge: true });
      toast({ title: "그리드 크기가 저장되었습니다." });
    } catch (e) { toast({ variant: "destructive", title: "저장 실패" }); } finally { setIsSaving(false); }
  };

  const handleToggleCellType = async () => {
    if (!firestore || !centerId || !selectedSeat) return;
    const nextType = selectedSeat.type === 'aisle' ? 'seat' : 'aisle';
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const seatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id);
      if (nextType === 'aisle' && selectedSeat.studentId) {
        batch.update(doc(firestore, 'centers', centerId, 'students', selectedSeat.studentId), { seatNo: 0, updatedAt: serverTimestamp() });
        batch.set(seatRef, { type: 'aisle', studentId: null, status: 'absent', updatedAt: serverTimestamp() }, { merge: true });
      } else {
        batch.set(seatRef, { type: nextType, updatedAt: serverTimestamp() }, { merge: true });
      }
      await batch.commit();
      toast({ title: nextType === 'aisle' ? "통로로 변경됨" : "좌석으로 변경됨" });
      setIsManaging(false);
      setIsAssigning(false);
    } catch (e) { toast({ variant: "destructive", title: "변경 실패" }); } finally { setIsSaving(false); }
  };

  const assignStudentToSeat = async (student: StudentProfile) => {
    if (!firestore || !centerId || !selectedSeat) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'centers', centerId, 'students', student.id), { 
        seatNo: selectedSeat.seatNo, 
        seatZone: selectedSeat.seatZone || null,
        updatedAt: serverTimestamp() 
      });
      batch.set(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id), { studentId: student.id, status: 'absent', type: 'seat', updatedAt: serverTimestamp() }, { merge: true });
      await batch.commit();
      toast({ title: `${student.name} 학생 배정 완료` });
      setIsAssigning(false);
      setSearchTerm('');
    } catch (e) { toast({ variant: "destructive", title: "배정 실패" }); } finally { setIsSaving(false); }
  };

  const unassignStudentFromSeat = async () => {
    if (!firestore || !centerId || !selectedSeat || !selectedSeat.studentId) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      batch.update(doc(firestore, 'centers', centerId, 'students', selectedSeat.studentId), { seatNo: 0, updatedAt: serverTimestamp() });
      batch.set(doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id), { studentId: null, status: 'absent', updatedAt: serverTimestamp() }, { merge: true });
      await batch.commit();
      toast({ title: "배정 해제 완료" });
      setIsManaging(false);
    } catch (e) { toast({ variant: "destructive", title: "해제 실패" }); } finally { setIsSaving(false); }
  };

  if (!mounted) return (
    <div className="flex flex-col h-[70vh] w-full items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      <p className="font-black text-primary tracking-tighter uppercase opacity-40">Initializing Command Matrix...</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto pb-24 min-h-screen">
      <header className={cn("flex justify-between px-4 pt-6 gap-4", isMobile ? "flex-col" : "flex-row items-center")}>
        <div className="flex items-center gap-3">
          <Monitor className={cn("text-primary", isMobile ? "h-6 w-6" : "h-8 w-8")} />
          <div className="grid">
            <h1 className={cn("font-black tracking-tight", isMobile ? "text-2xl" : "text-3xl")}>실시간 관제 홈</h1>
            <p className={cn("font-bold text-muted-foreground uppercase tracking-[0.3em] mt-0.5 ml-1", isMobile ? "text-[8px]" : "text-[10px]")}>Command & Control Center</p>
          </div>
          <Badge className="bg-blue-600 text-white border-none font-black text-[10px] rounded-full px-2.5 h-5 tracking-tighter">LIVE</Badge>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border shadow-sm px-4">
            <Filter className="h-3.5 w-3.5 text-primary opacity-40" />
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="border-none shadow-none focus:ring-0 font-black text-xs h-8 w-[140px] bg-transparent">
                <SelectValue placeholder="반 선택" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-none shadow-2xl">
                <SelectItem value="all" className="font-black">센터 전체 보기</SelectItem>
                {availableClasses.map(c => (
                  <SelectItem key={c} value={c} className="font-black">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className={cn("flex items-center gap-2 bg-white/80 backdrop-blur-md p-1.5 rounded-[1.25rem] border shadow-sm", isMobile ? "hidden" : "p-2 rounded-[1.5rem]")}>
            <div className="flex items-center gap-2 px-4 border-r">
              <Activity className="h-4 w-4 text-emerald-500" />
              <div className="grid leading-none">
                <span className="text-[8px] font-black text-muted-foreground uppercase">{selectedClass === 'all' ? 'Center' : selectedClass} Today Total</span>
                <span className="text-sm font-black text-emerald-600">{Math.floor(stats.totalCenterMinutes / 60)}h {stats.totalCenterMinutes % 60}m</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 border-r">
              <Users className="h-4 w-4 text-blue-500" />
              <div className="grid leading-none">
                <span className="text-[8px] font-black text-muted-foreground uppercase">Avg Study</span>
                <span className="text-sm font-black text-blue-600">{Math.floor(stats.avgMinutes / 60)}h {stats.avgMinutes % 60}m</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4">
              <Trophy className="h-4 w-4 text-amber-500" />
              <div className="grid leading-none">
                <span className="text-[8px] font-black text-muted-foreground uppercase">Top 20% Avg</span>
                <span className="text-sm font-black text-amber-600">{Math.floor(stats.top20Avg / 60)}h {stats.top20Avg % 60}m</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="px-4">
        <Card className="rounded-[2.5rem] border-none shadow-sm bg-white p-6 sm:p-8 overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-1000"><TrendingUp className="h-32 w-32" /></div>
          <CardHeader className="p-0 mb-6">
            <div className="flex items-center justify-between">
              <div className="grid gap-1">
                <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" /> 최근 30일 센터 학습 추이
                </CardTitle>
                <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Historical Study Trend (Actual Study Minutes Analysis)</CardDescription>
              </div>
              <div className="flex items-center gap-2">{trendLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary/50" />}<Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black text-[9px] px-2.5">{trendLoading ? "UPDATING" : "PAST 30 DAYS"}</Badge></div>
            </div>
          </CardHeader>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={centerTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTrend" x1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} tick={{fill: '#999'}} />
                <YAxis fontSize={9} fontWeight="900" axisLine={false} tickLine={false} tick={{fill: '#999'}} />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 rounded-xl shadow-2xl border-none ring-1 ring-black/5">
                          <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">{label}</p>
                          <p className="text-base font-black text-emerald-600">{payload[0].value}h ({Number(payload[0].payload.totalMinutes).toLocaleString()}m)</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="hours" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" animationDuration={2000} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      <section className={cn("grid gap-4 px-4", isMobile ? "grid-cols-2" : "md:grid-cols-4")}>
        {[
          { label: '학습 중', val: stats.studying, color: 'text-blue-600', icon: Activity },
          { label: '미입실', val: stats.absent, color: 'text-rose-500', icon: AlertCircle },
          { label: '외출/휴식', val: stats.away, color: 'text-amber-500', icon: Clock },
          { label: selectedClass === 'all' ? '전체 좌석' : `${selectedClass} 정원`, val: stats.total, color: 'text-primary', icon: Armchair, hasEdit: true }
        ].map((item, i) => (
          <Card key={i} className="rounded-[2rem] sm:rounded-[2.5rem] border-none shadow-sm bg-white p-5 sm:p-8 transition-all hover:shadow-md relative overflow-hidden group">
            <div className="flex justify-between items-start mb-2">
              <span className={cn("font-black text-muted-foreground uppercase tracking-widest", isMobile ? "text-[9px]" : "text-[11px]")}>{item.label}</span>
              <item.icon className={cn(isMobile ? "h-4 w-4" : "h-5 w-5", item.color)} />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={cn("font-black tracking-tighter", isMobile ? "text-3xl" : "text-5xl", item.color)}>{item.val}</div>
              {item.hasEdit && (
                <Button 
                  variant={isEditMode ? "default" : "outline"} 
                  size="sm" 
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={cn(
                    "rounded-xl h-8 px-2.5 sm:h-9 sm:px-3 font-black text-[9px] sm:text-[10px] gap-1.5 transition-all shadow-sm",
                    isEditMode ? "bg-primary text-white" : "border-2 hover:bg-primary/5"
                  )}
                >
                  <Settings2 className="h-3.5 w-3.5" /> {!isMobile && (isEditMode ? '수정 완료' : '배치 수정')}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </section>

      <Card className={cn(
        "rounded-[3rem] border-none shadow-xl bg-white mx-4 overflow-hidden transition-all duration-500",
        isEditMode ? "ring-4 ring-primary/20" : ""
      )}>
        <CardHeader className={cn("bg-muted/5 border-b px-6 py-4 sm:px-10 sm:py-6")}>
          <div className="flex justify-between items-center">
            <CardTitle className={cn("font-black tracking-tight flex items-center gap-2", isMobile ? "text-lg" : "text-xl")}>
              <Armchair className={cn("opacity-40", isMobile ? "h-4 w-4" : "h-5 w-5")} /> 
              {isEditMode ? '배치 수정' : '좌석 상황판'}
              {selectedClass !== 'all' && <Badge variant="secondary" className="bg-primary/5 text-primary border-none ml-2">{selectedClass}</Badge>}
            </CardTitle>
            <Badge variant="outline" className="border-primary/40 font-black text-[9px] px-3 h-6 uppercase">{gridCols}x{gridRows}</Badge>
          </div>
        </CardHeader>
        <CardContent className={cn("flex justify-center", isMobile ? "p-4" : "p-6 sm:p-10")}>
          <ScrollArea className="w-full max-w-full">
            <div className={cn("rounded-[2.5rem] border-2 border-muted/30 bg-[#fafafa] w-fit mx-auto", isMobile ? "p-4" : "p-6 sm:p-10 shadow-inner")}>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(64px, 1fr))` }}>
                {Array.from({ length: gridCols }).map((_, colIndex) => (
                  <div key={colIndex} className="flex flex-col gap-2">
                    {Array.from({ length: gridRows }).map((_, rowIndex) => {
                      const seatNo = colIndex * gridRows + rowIndex + 1;
                      const seatId = `seat_${seatNo.toString().padStart(3, '0')}`;
                      const seat = attendanceList?.find(a => a.id === seatId) || { id: seatId, seatNo, status: 'absent', type: 'seat' } as AttendanceCurrent;
                      const student = students?.find(s => s.id === seat?.studentId);
                      const studentMember = studentMembers?.find(m => m.id === seat?.studentId);
                      const occupantId = typeof seat?.studentId === 'string' ? seat.studentId : '';
                      const occupantName = student?.name || studentMember?.displayName || (occupantId ? 'Assigned' : '');
                      const isFilteredOut = selectedClass !== 'all' && studentMember?.className !== selectedClass;
                      
                      const timeInfo = occupantId ? getStudentStudyTimes(occupantId, seat.status, seat.lastCheckInAt) : null;
                      const isAisle = seat?.type === 'aisle';
                      const isStudying = timeInfo?.isStudying;
                      const isAway = !isEditMode && (seat?.status === 'away' || seat?.status === 'break');

                      return (
                        <div key={seatNo} onClick={() => handleSeatClick(seat)} className={cn(
                          "aspect-square min-w-[64px] rounded-2xl flex flex-col items-center justify-center transition-all duration-500 relative overflow-hidden p-1 cursor-pointer shadow-sm border-2 outline-none",
                          isFilteredOut ? "opacity-20 grayscale border-transparent bg-muted/10" : 
                          isAisle ? "bg-transparent border-transparent text-transparent hover:bg-muted/10" : 
                          isStudying ? "bg-blue-600 border-blue-700 text-white shadow-xl scale-[1.03] z-10" : 
                          isAway ? "bg-amber-50 border-amber-600 text-white" : 
                          occupantId ? "bg-white border-primary/30 text-primary" : "bg-white border-primary/40 text-primary/5 hover:border-primary/60",
                          isEditMode && isAisle && "border-dashed border-muted-foreground/20 bg-muted/5 text-muted-foreground/20"
                        )}>
                          {!isAisle && <span className={cn("text-[7px] font-black absolute top-1 left-1.5", isStudying || isAway ? "opacity-60" : "opacity-40")}>{seatNo}</span>}
                          {seat?.seatZone && !isAisle && (
                            <Badge variant="outline" className={cn("absolute top-1 right-1 h-3.5 px-1 border-none font-black text-[6px]", isStudying || isAway ? "bg-white/20 text-white" : "bg-primary/5 text-primary/40")}>{seat.seatZone.charAt(0)}</Badge>
                          )}
                          {isAisle ? (isEditMode && <MapIcon className="h-3 w-3 opacity-40" />) : occupantId ? (
                            <div className="flex flex-col items-center gap-0.5 w-full px-0.5">
                              <span className="text-[10px] font-black truncate w-full text-center tracking-tighter leading-none mb-0.5">{occupantName}</span>
                              <div className="flex flex-col items-center leading-[1.1]">
                                <span className={cn("text-[8px] font-black tracking-tighter", isStudying || isAway ? "text-white" : "text-primary")}>{`L: ${timeInfo?.session}`}</span>
                                <span className={cn("text-[8px] font-black tracking-tighter", isStudying || isAway ? "text-white/90" : "text-primary/80")}>{`T: ${timeInfo?.total}`}</span>
                              </div>
                              {isStudying && <Zap className="h-2 w-2 fill-current animate-pulse text-white/50 mt-0.5" />}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center"><span className="text-[7px] font-black tracking-tighter opacity-100 uppercase">Empty</span>{isEditMode && <UserPlus className="h-2.5 w-2.5 mt-0.5 text-primary/40" />}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      <div className={cn("grid gap-6 px-4", isMobile ? "grid-cols-1" : "lg:grid-cols-12")}>
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-black tracking-tighter">오늘 상담 현황</h2>
              <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black h-6">{appointments.length}건</Badge>
            </div>
            <Button asChild variant="ghost" className="font-black text-xs text-muted-foreground hover:text-primary gap-2"><Link href="/dashboard/appointments">전체 관리 <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
          <div className="grid gap-3">
            {aptLoading ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div> : appointments.length === 0 ? (
              <div className="py-16 text-center bg-white/50 rounded-[2.5rem] border-2 border-dashed border-muted-foreground/10"><p className="font-black text-muted-foreground/30 text-sm italic">예정된 상담이 없습니다.</p></div>
            ) : appointments.map((apt) => (
              <Card key={apt.id} className="rounded-[2rem] border-none shadow-sm bg-white p-5 flex items-center justify-between group hover:shadow-md transition-all active:scale-[0.98]">
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 rounded-2xl bg-primary/5 border border-primary/10 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-primary/60 leading-none">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'HH:mm') : ''}</span>
                  </div>
                  <div className="grid leading-tight min-w-0">
                    <span className="font-black text-sm truncate">{apt.studentName} 학생</span>
                    <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[200px]">{apt.studentNote || '상담 주제 미입력'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("font-black text-[9px] border-none", apt.status === 'requested' ? "bg-amber-50 text-amber-600" : "bg-emerald-500 text-white")}>{apt.status === 'requested' ? '승인대기' : '예약확정'}</Badge>
                  <ChevronRight className="h-4 w-4 opacity-20" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <FileSearch className="h-6 w-6 text-emerald-600" />
              <h2 className="text-2xl font-black tracking-tighter">최근 발송 리포트</h2>
            </div>
            <Button asChild variant="ghost" className="font-black text-xs text-muted-foreground hover:text-emerald-600 gap-2"><Link href="/dashboard/reports">리포트 센터 <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
          <div className="grid gap-3">
            {!recentReportsFeed || recentReportsFeed.length === 0 ? (
              <div className="py-16 text-center bg-white/50 rounded-[2.5rem] border-2 border-dashed border-muted-foreground/10"><p className="font-black text-muted-foreground/30 text-sm italic">최근 발송된 리포트가 없습니다.</p></div>
            ) : recentReportsFeed.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelectedRecentReport(report)}
                className="w-full text-left"
              >
                <Card className="rounded-[2rem] border-none shadow-sm bg-white p-5 flex items-center justify-between group hover:shadow-md transition-all active:scale-[0.98] border border-transparent hover:border-emerald-200">
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 rounded-2xl bg-emerald-50 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-emerald-600 leading-none">{report.dateKey.split('-')[2]}</span>
                    <span className="text-[7px] font-bold text-emerald-400 uppercase mt-0.5">{format(new Date(report.dateKey.replace(/-/g, '/')), 'MMM')}</span>
                  </div>
                  <div className="grid leading-tight min-w-0">
                    <span className="font-black text-sm truncate">{report.studentName} 학생</span>
                    <p className="text-[10px] font-bold text-muted-foreground truncate max-w-[180px]">{report.content.substring(0, 40)}...</p>
                  </div>
                </div>
                <div className={cn("h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm", report.viewedAt ? "text-emerald-600" : "text-emerald-300")}>
                  {report.viewedAt ? <CheckCircle2 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </div>
                </Card>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={!!selectedRecentReport} onOpenChange={(open) => !open && setSelectedRecentReport(null)}>
        <DialogContent className={cn("rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col", isMobile ? "fixed inset-0 w-full h-full max-w-none rounded-none" : "sm:max-w-2xl max-h-[90vh]")}>
          {selectedRecentReport && (
            <>
              <div className="bg-emerald-600 text-white p-8 relative shrink-0">
                <DialogHeader className="relative z-10">
                  <DialogTitle className="text-2xl font-black tracking-tighter">최근 발송 리포트 상세</DialogTitle>
                  <DialogDescription className="text-white/80 font-bold">
                    {selectedRecentReport.dateKey} · {selectedRecentReport.studentName || '학생'}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className="border-none bg-emerald-50 text-emerald-700 font-black">{selectedRecentReport.dateKey}</Badge>
                  <Badge className={cn("border-none font-black", selectedRecentReport.viewedAt ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                    {selectedRecentReport.viewedAt ? '열람 완료' : '미열람'}
                  </Badge>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/20 p-5">
                  <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-800">
                    {selectedRecentReport.content?.trim() || '리포트 내용이 없습니다.'}
                  </p>
                </div>
              </div>
              <DialogFooter className="p-6 bg-white border-t">
                <Button variant="ghost" onClick={() => setSelectedRecentReport(null)} className="w-full font-black">
                  닫기
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isManaging} onOpenChange={setIsManaging}>
        <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col", isMobile ? "fixed inset-0 w-full h-full max-w-none rounded-none" : "sm:max-w-2xl max-h-[90vh]")}>
          {selectedSeat && (
            <>
              {(() => {
                const studentId = selectedSeat.studentId;
                const timeInfo = studentId ? getStudentStudyTimes(studentId, selectedSeat.status, selectedSeat.lastCheckInAt) : null;

                return (
                  <>
                    <div className={cn("p-10 text-white relative shrink-0", selectedSeat.status === 'studying' ? "bg-blue-600" : "bg-primary")}>
                      <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12"><Sparkles className="h-32 w-32" /></div>
                      <DialogHeader className="relative z-10">
                        <DialogTitle className="text-3xl sm:text-4xl font-black tracking-tighter">{students?.find(s => s.id === selectedSeat.studentId)?.name || '학생'}</DialogTitle>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge className="bg-white/20 text-white border-none font-black px-2.5 py-0.5 text-[10px]">SEAT {selectedSeat.seatNo}</Badge>
                          <Badge className="bg-white/20 text-white border-none font-black px-2.5 py-0.5 text-[10px] uppercase">{selectedSeat.status}</Badge>
                          {selectedSeat.seatZone && <Badge className="bg-white text-primary border-none font-black px-2.5 py-0.5 text-[10px] uppercase">{selectedSeat.seatZone}</Badge>}
                        </div>
                      </DialogHeader>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#fafafa]">
                      <Tabs defaultValue="status" className="w-full">
                        <TabsList className="w-full rounded-none h-14 bg-muted/20 border-b p-0">
                          <TabsTrigger value="status" className="flex-1 h-full rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none font-black text-xs uppercase tracking-widest border-b-2 border-transparent data-[state=active]:border-primary transition-all">실시간 상태</TabsTrigger>
                          <TabsTrigger value="history" className="flex-1 h-full rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none font-black text-xs uppercase tracking-widest border-b-2 border-transparent data-[state=active]:border-emerald-500 transition-all">학습 히스토리</TabsTrigger>
                          <TabsTrigger value="penalty" className="flex-1 h-full rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none font-black text-xs uppercase tracking-widest border-b-2 border-transparent data-[state=active]:border-rose-500 transition-all">벌점 관리</TabsTrigger>
                          <TabsTrigger value="reports" className="flex-1 h-full rounded-none data-[state=active]:bg-white data-[state=active]:shadow-none font-black text-xs uppercase tracking-widest border-b-2 border-transparent data-[state=active]:border-amber-500 transition-all">리포트 내역</TabsTrigger>
                        </TabsList>

                        <div className={cn("p-6 sm:p-8 space-y-8")}>
                          <TabsContent value="status" className="mt-0 space-y-8">
                            {selectedSeat.studentId && (
                              <div className="flex gap-4 p-5 bg-white rounded-3xl border-2 border-primary/5 shadow-sm">
                                <div className="flex-1 text-center">
                                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Live Session</p>
                                  <p className="text-xl sm:text-2xl font-black text-blue-600 tabular-nums">{timeInfo?.session}</p>
                                </div>
                                <div className="w-px h-10 bg-border/50 self-center" />
                                <div className="flex-1 text-center">
                                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Today Total</p>
                                  <p className="text-xl sm:text-2xl font-black text-primary tabular-nums">{timeInfo?.total}</p>
                                </div>
                              </div>
                            )}

                            {isEditMode ? (
                              <div className="grid gap-4">
                                <div className="space-y-3 p-6 rounded-[2rem] bg-white border-2 border-primary/5 shadow-sm">
                                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-2"><MapPin className="h-3 w-3" /> 좌석 구역 설정</Label>
                                  <Select value={selectedSeat.seatZone || 'Flex'} onValueChange={handleUpdateZone}>
                                    <SelectTrigger className="h-12 rounded-xl border-2 font-bold shadow-sm">
                                      <SelectValue placeholder="구역 선택" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-none shadow-2xl">
                                      <SelectItem value="A존 (Focus)" className="font-bold">A존 (Focus)</SelectItem>
                                      <SelectItem value="B존 (Standard)" className="font-bold">B존 (Standard)</SelectItem>
                                      <SelectItem value="고정석 (Fixed)" className="font-bold">고정석 (Fixed)</SelectItem>
                                      <SelectItem value="자유석 (Flex)" className="font-bold">자유석 (Flex)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid gap-3">
                                  <Button variant="destructive" onClick={unassignStudentFromSeat} disabled={isSaving} className="w-full h-16 rounded-2xl font-black text-lg shadow-xl shadow-rose-200">좌석 배정 해제</Button>
                                  <Button variant="outline" onClick={handleToggleCellType} disabled={isSaving} className="w-full h-12 rounded-xl font-black gap-2 border-2"><ArrowRightLeft className="h-4 w-4" /> 통로로 전환하기</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-4">
                                <Button onClick={() => handleStatusUpdate('studying')} disabled={isSaving} className="h-20 sm:h-24 rounded-[2rem] font-black bg-blue-600 hover:bg-blue-700 text-white gap-2 flex flex-col items-center justify-center shadow-xl active:scale-95 transition-all"><Zap className="h-5 w-5 fill-current" /><span className="text-base sm:text-lg leading-none">입실 확인</span></Button>
                                <Button variant="outline" onClick={() => handleStatusUpdate('absent')} disabled={isSaving} className="h-20 sm:h-24 rounded-[2rem] font-black border-2 border-rose-100 text-rose-600 hover:bg-rose-50 gap-2 flex flex-col items-center justify-center active:scale-95 transition-all"><AlertCircle className="h-5 w-5" /><span className="text-base sm:text-lg leading-none">퇴실 처리</span></Button>
                              </div>
                            )}

                            <div className="space-y-4">
                              <div className="flex items-center justify-between px-1">
                                <h4 className="text-[10px] font-black uppercase text-primary/60 tracking-widest flex items-center gap-2"><History className="h-3 w-3" /> 오늘의 몰입 세션</h4>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase">{todayKey}</span>
                              </div>
                              <div className="grid gap-2">
                                {sessionsLoading ? (
                                  <div className="py-10 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-primary opacity-20" /></div>
                                ) : (
                                  <>
                                    {selectedSeat.status === 'studying' && selectedSeat.lastCheckInAt && (
                                      <div className="p-4 rounded-2xl bg-blue-600 text-white border border-blue-700 shadow-lg flex items-center justify-between animate-pulse">
                                        <div className="flex items-center gap-3">
                                          <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center"><Zap className="h-4 w-4 fill-current text-white" /></div>
                                          <div className="grid leading-tight">
                                            <span className="font-black text-xs">{format(selectedSeat.lastCheckInAt.toDate(), 'HH:mm:ss')} ~ 진행 중</span>
                                            <span className="text-[8px] font-bold text-white/60 uppercase">Active Session</span>
                                          </div>
                                        </div>
                                        <Badge className="bg-white/20 text-white border-none font-black text-[10px] px-2.5 h-6">
                                          {timeInfo?.session}
                                        </Badge>
                                      </div>
                                    )}
                                    
                                    {selectedStudentSessions.length === 0 && selectedSeat.status !== 'studying' ? (
                                      <div className="py-10 text-center rounded-2xl border-2 border-dashed border-muted-foreground/10 italic text-[10px] text-muted-foreground">기록된 세션이 없습니다.</div>
                                    ) : (
                                      selectedStudentSessions.map((session) => (
                                        <div key={session.id} className="p-4 rounded-2xl bg-white border border-border/50 shadow-sm flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-xl bg-primary/5 flex items-center justify-center"><Timer className="h-4 w-4 text-primary/40" /></div>
                                            <div className="grid leading-tight"><span className="font-black text-xs">{format(session.startTime.toDate(), 'HH:mm')} ~ {format(session.endTime.toDate(), 'HH:mm')}</span><span className="text-[8px] font-bold text-muted-foreground uppercase">Captured</span></div>
                                          </div>
                                          <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[10px] px-2.5 h-6">{session.durationMinutes}분</Badge>
                                        </div>
                                      ))
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </TabsContent>

                          <TabsContent value="history" className="mt-0 space-y-6">
                            <div className="flex items-center gap-2 px-1">
                              <TrendingUp className="h-4 w-4 text-emerald-600" />
                              <h4 className="text-[10px] font-black uppercase text-emerald-600 tracking-widest">최근 학습 시간 변화</h4>
                            </div>
                            <div className="grid gap-2">
                              {sessionsLoading ? (
                                <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
                              ) : selectedStudentHistory.length === 0 ? (
                                <div className="py-20 text-center opacity-20 italic font-black text-sm border-2 border-dashed rounded-3xl">학습 기록이 없습니다.</div>
                              ) : (
                                selectedStudentHistory.map((hLog) => (
                                  <div key={hLog.dateKey} className="p-4 rounded-2xl bg-white border shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-all">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-xs font-black text-primary">{format(new Date(hLog.dateKey.replace(/-/g, '/')), 'MM/dd (EEE)', {locale: ko})}</span>
                                      <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Daily Log</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden shadow-inner">
                                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (hLog.totalMinutes / 480) * 100)}%` }} />
                                      </div>
                                      <div className="text-right min-w-[60px]">
                                        <span className="text-sm font-black tracking-tighter">{Math.floor(hLog.totalMinutes / 60)}h {hLog.totalMinutes % 60}m</span>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </TabsContent>

                          <TabsContent value="penalty" className="mt-0 space-y-6">
                            <div className="flex items-center justify-between gap-2 px-1">
                              <div className="flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4 text-rose-600" />
                                <h4 className="text-[10px] font-black uppercase text-rose-600 tracking-widest">벌점 현황</h4>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 rounded-lg px-2 text-[10px] font-black text-rose-600 hover:bg-rose-50"
                                onClick={() => setIsPenaltyGuideOpen(true)}
                              >
                                규칙 보기
                              </Button>
                            </div>

                            <div className="rounded-3xl border border-rose-100 bg-white p-5 shadow-sm space-y-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">현재 누적 벌점</p>
                                  <p className="text-3xl font-black tracking-tighter text-rose-600 tabular-nums">{selectedPenaltyRecovery.effectivePoints}점</p>
                                  {selectedPenaltyRecovery.recoveredPoints > 0 && (
                                    <p className="text-[10px] font-bold text-rose-500/80">
                                      원점수 {selectedPenaltyRecovery.basePoints}점 · 회복 {selectedPenaltyRecovery.recoveredPoints}점
                                    </p>
                                  )}
                                </div>
                                <Badge className="border-none bg-rose-50 text-rose-700 font-black">
                                  학생: {selectedStudentName}
                                </Badge>
                              </div>

                              {canAdjustPenalty && (
                                <div className="grid gap-3 rounded-2xl border border-rose-100 bg-rose-50/40 p-4">
                                  <div className="grid gap-1">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-rose-600">벌점 부여 사유</Label>
                                    <Textarea
                                      value={manualPenaltyReason}
                                      onChange={(event) => setManualPenaltyReason(event.target.value)}
                                      placeholder="벌점 부여 사유를 입력해 주세요."
                                      className="min-h-[88px] rounded-xl border-2 font-bold resize-none"
                                    />
                                  </div>
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
                                    <Input
                                      type="number"
                                      min={1}
                                      step={1}
                                      value={manualPenaltyPoints}
                                      onChange={(event) => setManualPenaltyPoints(event.target.value)}
                                      className="h-11 rounded-xl border-2 font-black text-center"
                                    />
                                    <Button
                                      onClick={handleAddPenalty}
                                      disabled={isPenaltySaving}
                                      className="h-11 rounded-xl font-black bg-rose-600 hover:bg-rose-700"
                                    >
                                      {isPenaltySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : '벌점 부여'}
                                    </Button>
                                  </div>
                                  {canResetPenalty && (
                                    <Button
                                      variant="outline"
                                      onClick={handleResetPenalty}
                                      disabled={isPenaltySaving}
                                      className="h-11 rounded-xl font-black border-2 border-rose-200 text-rose-700 hover:bg-rose-50 gap-2"
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                      벌점 초기화
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-2 px-1">
                                <History className="h-4 w-4 text-rose-500" />
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-600">벌점 기록</h4>
                              </div>
                              {sessionsLoading ? (
                                <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
                              ) : selectedStudentPenaltyLogs.length === 0 ? (
                                <div className="py-20 text-center opacity-30 italic font-black text-sm border-2 border-dashed rounded-3xl">벌점 기록이 없습니다.</div>
                              ) : (
                                <div className="grid gap-2">
                                  {selectedStudentPenaltyLogs.map((log) => {
                                    const rawPoints = Number(log.pointsDelta || 0);
                                    const createdAtDate = (log.createdAt as any)?.toDate?.();
                                    const createdAtLabel = createdAtDate ? format(createdAtDate, 'MM/dd HH:mm') : '-';
                                    const sourceLabel =
                                      log.source === 'reset'
                                        ? '초기화'
                                        : log.source === 'manual'
                                          ? '수동 부여'
                                          : '지각/결석 신청';
                                    return (
                                      <div key={log.id} className="p-4 rounded-2xl bg-white border border-rose-100 shadow-sm flex items-start justify-between gap-3">
                                        <div className="grid gap-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <Badge className="border-none bg-rose-50 text-rose-700 font-black text-[10px] h-5 px-2">{sourceLabel}</Badge>
                                            <span className="text-[10px] font-bold text-muted-foreground">{createdAtLabel}</span>
                                          </div>
                                          <p className="text-sm font-bold text-foreground/80 break-keep">{log.reason || '사유 없음'}</p>
                                        </div>
                                        <Badge className={cn(
                                          "border-none font-black text-xs h-6 px-2.5",
                                          rawPoints >= 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                                        )}>
                                          {rawPoints >= 0 ? `+${rawPoints}` : rawPoints}점
                                        </Badge>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </TabsContent>

                          <TabsContent value="reports" className="mt-0 space-y-6">
                            <div className="flex items-center gap-2 px-1">
                              <FileText className="h-4 w-4 text-amber-600" />
                              <h4 className="text-[10px] font-black uppercase text-amber-600 tracking-widest">최근 발송된 리포트 (5건)</h4>
                            </div>
                            <div className="grid gap-3">
                              {sessionsLoading ? (
                                <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
                              ) : selectedStudentReports.length === 0 ? (
                                <div className="py-20 text-center opacity-20 italic font-black text-sm border-2 border-dashed rounded-3xl">발송된 리포트가 없습니다.</div>
                              ) : (
                                selectedStudentReports.map((report) => (
                                  <button
                                    key={report.id}
                                    type="button"
                                    onClick={() => setSelectedReportPreview(report)}
                                    className="w-full text-left p-5 rounded-2xl bg-white border border-amber-100 shadow-sm space-y-2 relative group hover:shadow-md transition-all"
                                  >
                                    <div className="flex justify-between items-center">
                                      <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">{report.dateKey}</span>
                                      {report.viewedAt && <Badge className="bg-emerald-50 text-emerald-700 border-none font-black text-[10px] px-1.5 h-5">열람함</Badge>}
                                    </div>
                                    <p className="text-xs font-bold text-foreground/70 line-clamp-2 leading-relaxed">{report.content.substring(0, 100)}...</p>
                                  </button>
                                ))
                              )}
                            </div>
                          </TabsContent>
                        </div>
                      </Tabs>

                      <Dialog open={isPenaltyGuideOpen} onOpenChange={setIsPenaltyGuideOpen}>
                        <DialogContent className={cn("rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col", isMobile ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-[420px]" : "sm:max-w-lg")}>
                          <div className="bg-gradient-to-r from-rose-600 to-rose-500 p-6 text-white">
                            <DialogHeader>
                              <DialogTitle className="text-xl font-black tracking-tight">벌점 규정 안내</DialogTitle>
                              <DialogDescription className="text-white/80 font-bold">
                                부여 기준, 누적 단계, 자동 회복 규칙
                              </DialogDescription>
                            </DialogHeader>
                          </div>
                          <div className="space-y-3 bg-white p-5">
                            <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4 text-sm font-bold text-slate-700 space-y-1">
                              <p>지각 출석: +1점</p>
                              <p>결석: +2점</p>
                              <p>센터 수동 부여: 입력 점수만큼 반영</p>
                            </div>
                            <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 text-sm font-bold text-slate-700 space-y-1">
                              <p>7점 이상: 선생님과 상담</p>
                              <p>12점 이상: 학부모 상담</p>
                              <p>20점 이상: 퇴원</p>
                            </div>
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 text-sm font-bold text-slate-700 space-y-1">
                              <p>신규 벌점 없이 7일 경과 시 1점 자동 회복</p>
                              <p>원점수 {selectedPenaltyRecovery.basePoints}점 · 회복 {selectedPenaltyRecovery.recoveredPoints}점 · 적용 {selectedPenaltyRecovery.effectivePoints}점</p>
                              <p>최근 벌점 반영일: {selectedPenaltyRecovery.latestPositiveLabel}</p>
                            </div>
                          </div>
                          <DialogFooter className="border-t bg-white p-4">
                            <Button className="w-full h-11 rounded-xl font-black" onClick={() => setIsPenaltyGuideOpen(false)}>
                              확인
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={!!selectedReportPreview} onOpenChange={(open) => !open && setSelectedReportPreview(null)}>
                        <DialogContent className={cn("rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col", isMobile ? "fixed inset-0 w-full h-full max-w-none rounded-none" : "sm:max-w-2xl max-h-[90vh]")}>
                          {selectedReportPreview && (
                            <>
                              <div className="bg-amber-500 text-white p-8 relative shrink-0">
                                <DialogHeader className="relative z-10">
                                  <DialogTitle className="text-2xl font-black tracking-tighter">발송 리포트 상세</DialogTitle>
                                  <DialogDescription className="text-white/80 font-bold">
                                    {selectedReportPreview.dateKey} · {selectedStudentName} 학생
                                  </DialogDescription>
                                </DialogHeader>
                              </div>
                              <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white space-y-3">
                                <div className="flex items-center justify-between">
                                  <Badge className="border-none bg-amber-50 text-amber-700 font-black">{selectedReportPreview.dateKey}</Badge>
                                  {selectedReportPreview.viewedAt && <Badge className="border-none bg-emerald-100 text-emerald-700 font-black">열람 완료</Badge>}
                                </div>
                                <div className="rounded-2xl border border-amber-100 bg-amber-50/30 p-5">
                                  <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-800">
                                    {selectedReportPreview.content?.trim() || '리포트 내용이 없습니다.'}
                                  </p>
                                </div>
                              </div>
                              <DialogFooter className="p-6 bg-white border-t">
                                <Button variant="ghost" onClick={() => setSelectedReportPreview(null)} className="w-full font-black">
                                  닫기
                                </Button>
                              </DialogFooter>
                            </>
                          )}
                        </DialogContent>
                      </Dialog>

                      <div className="p-6 sm:p-8 pt-0 border-t border-dashed mt-4">
                        <Button variant="secondary" className="w-full h-14 sm:h-16 rounded-2xl font-black gap-4 text-primary bg-primary/5 hover:bg-primary/10 transition-all border border-primary/5" asChild>
                          <Link href={`/dashboard/teacher/students/${selectedSeat.studentId}`}><User className="h-5 w-5 opacity-40" />학생 정밀 리포트 & 과거 상세 분석<ChevronRight className="ml-auto h-5 w-5 opacity-20" /></Link>
                        </Button>
                      </div>
                    </div>
                  </>
                );
              })()}
              <DialogFooter className={cn("bg-white border-t shrink-0 flex justify-center", isMobile ? "p-4" : "p-6")}>
                <Button variant="ghost" onClick={() => setIsManaging(false)} className="w-full font-bold text-muted-foreground">닫기</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAssigning} onOpenChange={setIsAssigning}>
        <DialogContent className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col", isMobile ? "fixed inset-0 w-full h-full max-none rounded-none" : "sm:max-w-md")}>
          <div className="bg-primary p-8 text-white relative shrink-0">
            <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><UserPlus className="h-24 w-24" /></div>
            <DialogHeader className="relative z-10"><DialogTitle className="text-2xl sm:text-3xl font-black tracking-tighter flex items-center gap-3">{selectedSeat?.type === 'aisle' ? <MapIcon className="h-7 w-7" /> : <UserPlus className="h-7 w-7" />}배정 설정</DialogTitle><p className="text-white/60 font-bold mt-1 text-xs">GRID ID: {selectedSeat?.seatNo}</p></DialogHeader>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white space-y-6">
            {isEditMode && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-muted/30 border-2 border-dashed border-primary/20"><Button onClick={handleToggleCellType} className={cn("w-full h-12 rounded-xl font-black gap-2 transition-all", selectedSeat?.type === 'aisle' ? "bg-primary text-white" : "bg-white text-primary border-2")}><ArrowRightLeft className="h-4 w-4" />{selectedSeat?.type === 'aisle' ? '좌석으로 사용' : '통로로 전환'}</Button></div>
                
                {selectedSeat?.type !== 'aisle' && (
                  <div className="space-y-3 p-6 rounded-[2rem] bg-white border-2 border-primary/5 shadow-sm">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1 flex items-center gap-2"><MapPin className="h-3 w-3" /> 좌석 구역 설정</Label>
                    <Select value={selectedSeat?.seatZone || '자유석 (Flex)'} onValueChange={handleUpdateZone}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold shadow-sm">
                        <SelectValue placeholder="구역 선택" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="A존 (Focus)" className="font-bold">A존 (Focus)</SelectItem>
                        <SelectItem value="B존 (Standard)" className="font-bold">B존 (Standard)</SelectItem>
                        <SelectItem value="고정석 (Fixed)" className="font-bold">고정석 (Fixed)</SelectItem>
                        <SelectItem value="자유석 (Flex)" className="font-bold">자유석 (Flex)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
            
            {selectedSeat?.type !== 'aisle' && (
              <div className="space-y-4">
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" /><Input placeholder="이름 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="rounded-xl border-2 pl-10 h-11 text-sm font-bold" /></div>
                <ScrollArea className="h-[300px] pr-4">
                  <div className="space-y-2">
                    {unassignedStudents.length === 0 ? <p className="text-center py-10 text-[10px] font-bold text-muted-foreground/40 italic">미배정 학생이 없습니다.</p> : unassignedStudents.map((student) => (
                      <div key={student.id} onClick={() => assignStudentToSeat(student)} className="p-4 rounded-2xl border-2 border-transparent hover:border-primary/10 hover:bg-primary/5 cursor-pointer flex items-center justify-between transition-all">
                        <div className="flex items-center gap-3 min-w-0"><div className="h-9 w-9 rounded-xl bg-primary/5 flex items-center justify-center font-black text-primary border border-primary/10 shrink-0">{student.name.charAt(0)}</div><div className="grid gap-0.5 min-w-0"><span className="font-black text-sm truncate">{student.name}</span><span className="text-[10px] font-bold text-muted-foreground truncate">{student.schoolName}</span></div></div>
                        <ChevronRight className="h-4 w-4 opacity-40 shrink-0" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
          <DialogFooter className={cn("bg-muted/20 border-t shrink-0 flex justify-center", isMobile ? "p-4" : "p-6")}><Button variant="ghost" onClick={() => setIsAssigning(false)} className="w-full font-bold text-muted-foreground">취소</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
