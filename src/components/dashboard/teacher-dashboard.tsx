
'use client';

import { useState, useMemo, useEffect, useRef, type ComponentType, type ReactNode } from 'react';
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
import { useCollection, useFirestore, useDoc, useMemoFirebase, useUser } from '@/firebase';
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
  getDoc,
  deleteField,
} from 'firebase/firestore';
import { StudentProfile, AttendanceCurrent, StudyLogDay, CounselingReservation, CenterMembership, StudySession, StudyPlanItem, DailyReport, DailyStudentStat, GrowthProgress, AttendanceRequest, PenaltyLog, LayoutRoomConfig } from '@/lib/types';
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
import { motion, useReducedMotion } from 'framer-motion';
import { sendKakaoNotification } from '@/lib/kakao-service';
import { CenterAdminAttendanceBoard } from '@/components/dashboard/center-admin-attendance-board';
import { useCenterAdminAttendanceBoard } from '@/hooks/use-center-admin-attendance-board';
import { useCenterAdminHeatmap } from '@/hooks/use-center-admin-heatmap';
import type { CenterAdminAttendanceSeatSignal } from '@/lib/center-admin-attendance-board';
import {
  getCenterAdminDomainSummary,
  getCenterAdminSeatOverlayPresentation,
  type CenterAdminSeatDomainKey,
  type CenterAdminSeatOverlayMode,
  type CenterAdminStudentSeatSignal,
} from '@/lib/center-admin-seat-heatmap';
import {
  ROUTINE_MISSING_PENALTY_POINTS,
  syncAutoAttendanceRecord,
  toDateSafe as toDateSafeAttendance,
} from '@/lib/attendance-auto';
import { appendAttendanceEventToBatch, mergeAttendanceDailyStatToBatch } from '@/lib/attendance-events';
import {
  PRIMARY_ROOM_ID,
  buildSeatId,
  formatSeatLabel,
  getGlobalSeatNo,
  getRoomLabel,
  hasAssignedSeat,
  normalizeLayoutRooms,
  resolveSeatIdentity,
} from '@/lib/seat-layout';

const CustomTooltip = ({ active, payload, label, unit = '시간' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-xl border-2 border-primary/10 p-5 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] ring-1 ring-black/5 animate-in fade-in zoom-in duration-300">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{label}</p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="dashboard-number text-3xl text-primary drop-shadow-sm">{payload[0].value}</span>
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

const ATTENDANCE_STATUS_LABEL: Record<string, string> = {
  studying: '입실',
  away: '외출',
  break: '휴식',
  absent: '미입실',
  requested: '대기',
};

function formatAttendanceStatus(status?: string): string {
  if (!status) return '상태 없음';
  return ATTENDANCE_STATUS_LABEL[status] || status;
}

function formatDurationMinutes(totalMinutes: number): string {
  const safeMinutes = Math.max(0, Number(totalMinutes || 0));
  return `${Math.floor(safeMinutes / 60)}시간 ${safeMinutes % 60}분`;
}

function resolveRequestPenalty(req: Partial<AttendanceRequest>) {
  const explicitDelta = Number((req as any).penaltyPointsDelta);
  if (Number.isFinite(explicitDelta) && explicitDelta > 0) {
    return explicitDelta;
  }
  if (req.type === 'absence') return REQUEST_PENALTY_POINTS.absence;
  return REQUEST_PENALTY_POINTS.late;
}

type ResolvedAttendanceSeat = AttendanceCurrent & {
  roomId: string;
  roomSeatNo: number;
};

const SEAT_OVERLAY_OPTIONS: Array<{ value: CenterAdminSeatOverlayMode; label: string }> = [
  { value: 'composite', label: '종합' },
  { value: 'risk', label: '리스크' },
  { value: 'penalty', label: '벌점' },
  { value: 'minutes', label: '학습' },
  { value: 'parent', label: '학부모' },
  { value: 'efficiency', label: '효율' },
  { value: 'status', label: '상태' },
];

const SEAT_OVERLAY_DESCRIPTIONS: Record<CenterAdminSeatOverlayMode, string> = {
  composite: '학습, 출결, 상담, 학부모 반응을 한 번에 섞어 운영 위험 신호를 먼저 보여줍니다.',
  risk: '즉시 개입이 필요한 학생을 우선순위 중심으로 드러내는 보기입니다.',
  penalty: '누적 벌점과 루틴 누락 흐름을 중심으로 생활 관리 상태를 확인합니다.',
  minutes: '오늘 실제 공부시간 흐름만 따로 보면서 좌석 체류 대비 학습량을 읽습니다.',
  parent: '학부모 소통 반응과 미열람 여부를 빠르게 확인하는 운영 보기입니다.',
  billing: '수납 관련 신호는 관리자 전용이지만, 기존 오버레이 타입 호환을 위해 설명 매핑은 유지합니다.',
  efficiency: '앉아 있는 시간 대비 집중 효율이 낮은 학생을 찾는 데 초점을 둡니다.',
  status: '입실, 외출, 복귀, 퇴실 같은 현재 상태만 깔끔하게 보여주는 기본 보기입니다.',
};

type TeacherSectionHeaderProps = {
  badge: string;
  title: string;
  description?: string;
  icon: ComponentType<{ className?: string }>;
  right?: ReactNode;
  tone?: 'navy' | 'emerald' | 'amber';
  onDark?: boolean;
};

function TeacherSectionHeader({
  badge,
  title,
  description,
  icon: Icon,
  right,
  tone = 'navy',
  onDark = false,
}: TeacherSectionHeaderProps) {
  const toneStyles = {
    badge:
      tone === 'emerald'
        ? onDark
          ? 'bg-emerald-400/12 text-emerald-100'
          : 'bg-emerald-100 text-emerald-700'
        : tone === 'amber'
          ? onDark
            ? 'bg-[#FFB56A]/14 text-[#FFE6C9]'
            : 'bg-[#FFF2E8] text-[#C95A08]'
          : onDark
            ? 'bg-white/10 text-white'
            : 'bg-[#EEF4FF] text-[#2554D7]',
    icon:
      tone === 'emerald'
        ? onDark
          ? 'bg-white/10 text-emerald-100'
          : 'bg-emerald-100 text-emerald-600'
        : tone === 'amber'
          ? onDark
            ? 'bg-white/10 text-[#FFE6C9]'
            : 'bg-[#FFF2E8] text-[#C95A08]'
          : onDark
            ? 'bg-white/10 text-white'
            : 'bg-[#EEF4FF] text-[#2554D7]',
    title: onDark ? 'text-white' : 'text-[#14295F]',
    description: onDark ? 'text-white/72' : 'text-[#5c6e97]',
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <span className={cn('inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.25rem] shadow-sm', toneStyles.icon)}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <Badge className={cn('h-6 rounded-full border-none px-2.5 text-[10px] font-black tracking-[0.16em] uppercase', toneStyles.badge)}>
              {badge}
            </Badge>
            <h2 className={cn('mt-3 text-xl font-black tracking-tight sm:text-[1.45rem]', toneStyles.title)}>
              {title}
            </h2>
          </div>
        </div>
        {description ? (
          <p className={cn('mt-3 max-w-[42rem] text-xs font-bold leading-5 sm:text-sm', toneStyles.description)}>
            {description}
          </p>
        ) : null}
      </div>
      {right ? <div className="flex shrink-0 flex-wrap gap-2">{right}</div> : null}
    </div>
  );
}

export function TeacherDashboard({ isActive }: { isActive: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const isMobile = viewMode === 'mobile';
  const prefersReducedMotion = useReducedMotion();
  
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
  const [isHeroPriorityDialogOpen, setIsHeroPriorityDialogOpen] = useState(false);
  const [isHeroRoomsDialogOpen, setIsHeroRoomsDialogOpen] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [historicalCenterMinutes, setHistoricalCenterMinutes] = useState<Record<string, number>>({});
  const [trendLoading, setTrendLoading] = useState(false);
  const staleSeatCleanupInFlightRef = useRef(false);
  const liveBoardSectionRef = useRef<HTMLDivElement | null>(null);
  const seatInsightSectionRef = useRef<HTMLDivElement | null>(null);
  const appointmentsSectionRef = useRef<HTMLDivElement | null>(null);
  const reportsSectionRef = useRef<HTMLDivElement | null>(null);
  
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedRoomView, setSelectedRoomView] = useState<'all' | string>('all');
  const [roomDrafts, setRoomDrafts] = useState<Record<string, { rows: number; cols: number }>>({});
  const [seatOverlayMode, setSeatOverlayMode] = useState<CenterAdminSeatOverlayMode>('composite');
  const [selectedSeatInsightKey, setSelectedSeatInsightKey] = useState<CenterAdminSeatDomainKey | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const centerId = activeMembership?.id;
  const {
    seatSignalsBySeatId,
    studentSignalsByStudentId,
    seatOverlayLegend,
    seatOverlaySummary,
  } = useCenterAdminHeatmap({
    centerId,
    isActive,
    includeFinancialSignals: false,
    selectedClass,
  });
  const canAdjustPenalty =
    activeMembership?.role === 'teacher' ||
    activeMembership?.role === 'centerAdmin' ||
    activeMembership?.role === 'owner';
  const canResetPenalty =
    activeMembership?.role === 'centerAdmin' ||
    activeMembership?.role === 'owner';
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgoKey = format(subDays(new Date(), 30), 'yyyy-MM-dd');

  const centerRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId);
  }, [firestore, centerId]);
  const { data: centerData } = useDoc<any>(centerRef);

  const persistedRooms = useMemo(
    () => normalizeLayoutRooms(centerData?.layoutSettings),
    [centerData?.layoutSettings]
  );

  useEffect(() => {
    setRoomDrafts((prev) => {
      const next: Record<string, { rows: number; cols: number }> = {};
      persistedRooms.forEach((room) => {
        next[room.id] = {
          rows: prev[room.id]?.rows ?? room.rows,
          cols: prev[room.id]?.cols ?? room.cols,
        };
      });
      return next;
    });
  }, [persistedRooms]);

  useEffect(() => {
    if (selectedRoomView === 'all') return;
    const hasSelectedRoom = persistedRooms.some((room) => room.id === selectedRoomView);
    if (!hasSelectedRoom) {
      setSelectedRoomView('all');
    }
  }, [persistedRooms, selectedRoomView]);

  useEffect(() => {
    if (selectedRoomView === 'all' && isEditMode) {
      setIsEditMode(false);
    }
  }, [selectedRoomView, isEditMode]);

  const roomConfigs = useMemo(
    () =>
      persistedRooms.map((room) => ({
        ...room,
        rows: roomDrafts[room.id]?.rows ?? room.rows,
        cols: roomDrafts[room.id]?.cols ?? room.cols,
      })),
    [persistedRooms, roomDrafts]
  );

  const persistedRoomMap = useMemo(
    () => new Map(persistedRooms.map((room) => [room.id, room])),
    [persistedRooms]
  );

  const roomConfigMap = useMemo(
    () => new Map(roomConfigs.map((room) => [room.id, room])),
    [roomConfigs]
  );

  const selectedRoomConfig =
    selectedRoomView === 'all'
      ? null
      : roomConfigMap.get(selectedRoomView) || roomConfigs[0] || null;

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

  const resolvedAttendanceList = useMemo<ResolvedAttendanceSeat[]>(() => {
    if (!attendanceList) return [];
    return attendanceList.map((seat) => {
      const identity = resolveSeatIdentity(seat);
      return {
        ...seat,
        roomId: identity.roomId,
        roomSeatNo: identity.roomSeatNo,
        seatNo: identity.seatNo,
        type: seat.type || 'seat',
      };
    });
  }, [attendanceList]);

  const studentsById = useMemo(
    () => new Map((students || []).map((student) => [student.id, student])),
    [students]
  );

  const studentMembersById = useMemo(
    () => new Map((studentMembers || []).map((member) => [member.id, member])),
    [studentMembers]
  );

  const seatById = useMemo(
    () => new Map(resolvedAttendanceList.map((seat) => [seat.id, seat])),
    [resolvedAttendanceList]
  );

  const seatByStudentId = useMemo(() => {
    const mapped = new Map<string, ResolvedAttendanceSeat>();
    resolvedAttendanceList.forEach((seat) => {
      if (seat.studentId) {
        mapped.set(seat.studentId, seat);
      }
    });
    return mapped;
  }, [resolvedAttendanceList]);

  useEffect(() => {
    if (!firestore || !centerId || !isActive) return;
    if (!resolvedAttendanceList.length || !students || !studentMembers) return;
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

    const staleSeats = resolvedAttendanceList.filter((seat) => {
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
  }, [firestore, centerId, isActive, resolvedAttendanceList, students, studentMembers]);

  const todayStatsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !todayKey) return null;
    return collection(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students');
  }, [firestore, centerId, todayKey]);
  const { data: todayStats } = useCollection<DailyStudentStat>(todayStatsQuery, { enabled: isActive });

  const {
    seatSignalsBySeatId: attendanceSeatSignalsBySeatId,
    seatSignalsByStudentId: attendanceSeatSignalsByStudentId,
    summary: attendanceBoardSummary,
    isLoading: attendanceBoardLoading,
  } = useCenterAdminAttendanceBoard({
    centerId,
    isActive,
    selectedClass,
    students,
    studentMembers,
    attendanceList: resolvedAttendanceList,
    todayStats,
    nowMs: now,
  });

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

  const filteredMembers = useMemo(
    () =>
      (studentMembers || []).filter(
        (member) =>
          member.status === 'active' && (selectedClass === 'all' || member.className === selectedClass)
      ),
    [studentMembers, selectedClass]
  );

  const targetMemberIds = useMemo(
    () => new Set(filteredMembers.map((member) => member.id)),
    [filteredMembers]
  );

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

  const roomSummaries = useMemo(() => {
    return roomConfigs.map((room) => {
      let physicalSeats = 0;
      let studying = 0;
      let away = 0;
      let assigned = 0;

      for (let roomSeatNo = 1; roomSeatNo <= room.rows * room.cols; roomSeatNo += 1) {
        const seat = getSeatForRoom(room, roomSeatNo);
        if (seat.type === 'aisle') continue;
        physicalSeats += 1;

        const member = seat.studentId ? studentMembersById.get(seat.studentId) : null;
        const isIncluded =
          selectedClass === 'all'
            ? true
            : Boolean(member && member.className === selectedClass && member.status === 'active');

        if (!isIncluded) continue;
        if (seat.studentId) assigned += 1;
        if (seat.status === 'studying') studying += 1;
        if (seat.status === 'away' || seat.status === 'break') away += 1;
      }

      return {
        ...room,
        physicalSeats,
        studying,
        away,
        assigned,
        availableSeats: Math.max(0, physicalSeats - assigned),
        hasUnsavedChanges:
          room.rows !== (persistedRoomMap.get(room.id)?.rows ?? room.rows) ||
          room.cols !== (persistedRoomMap.get(room.id)?.cols ?? room.cols),
      };
    });
  }, [roomConfigs, persistedRoomMap, selectedClass, studentMembersById, seatById]);

  const selectedRoomSummary =
    selectedRoomView === 'all'
      ? null
      : roomSummaries.find((room) => room.id === selectedRoomView) || null;

  const roomScopedKpi = selectedRoomSummary
    ? {
        studying: selectedRoomSummary.studying,
        away: selectedRoomSummary.away,
        absent: Math.max(
          0,
          selectedRoomSummary.physicalSeats - selectedRoomSummary.studying - selectedRoomSummary.away
        ),
        total: selectedRoomSummary.physicalSeats,
      }
    : null;

  const stats = useMemo(() => {
    if (!mounted || !studentMembers) {
      return { studying: 0, absent: 0, away: 0, total: 0, totalCenterMinutes: 0, avgMinutes: 0, top20Avg: 0 };
    }

    let studying = 0;
    let away = 0;
    let totalMins = 0;
    const filteredLiveMinutes: number[] = [];

    filteredMembers.forEach((member) => {
      const seat = seatByStudentId.get(member.id);
      const status = seat?.status || 'absent';
      const timeInfo = getStudentStudyTimes(member.id, status, seat?.lastCheckInAt);

      totalMins += timeInfo.totalMins;
      filteredLiveMinutes.push(timeInfo.totalMins);

      if (status === 'studying') studying += 1;
      else if (status === 'away' || status === 'break') away += 1;
    });

    const totalPhysicalSeats = roomSummaries.reduce((sum, room) => sum + room.physicalSeats, 0);
    const totalDisplayCount = selectedClass !== 'all' ? targetMemberIds.size : totalPhysicalSeats;
    const absent = Math.max(0, totalDisplayCount - studying - away);

    const avgMinutes = filteredLiveMinutes.length > 0 ? Math.round(totalMins / filteredLiveMinutes.length) : 0;
    const sortedMinutes = [...filteredLiveMinutes].sort((a, b) => b - a);
    const top20Count = Math.max(1, Math.ceil(sortedMinutes.length * 0.2));
    const top20Avg =
      sortedMinutes.length > 0
        ? Math.round(sortedMinutes.slice(0, top20Count).reduce((acc, mins) => acc + mins, 0) / top20Count)
        : 0;

    return { studying, absent, away, total: totalDisplayCount, totalCenterMinutes: totalMins, avgMinutes, top20Avg };
  }, [filteredMembers, mounted, now, roomSummaries, seatByStudentId, studentMembers, selectedClass, targetMemberIds]);

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
  const unreadReportCount = useMemo(
    () => (rawRecentReports || []).filter((report) => !report.viewedAt).length,
    [rawRecentReports]
  );

  const scrollToSection = (sectionRef: { current: HTMLDivElement | null }) => {
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const teacherActionQueue = useMemo(() => {
    const pendingAppointments = appointments.filter((apt) => apt.status === 'requested');
    const nextPendingAppointment = [...pendingAppointments].sort(
      (left, right) => (left.scheduledAt?.toMillis() || 0) - (right.scheduledAt?.toMillis() || 0)
    )[0];
    const upcomingConfirmedAppointments = appointments.filter((apt) => {
      if (apt.status !== 'confirmed' || !apt.scheduledAt) return false;
      return apt.scheduledAt.toMillis() >= now;
    });
    const nextConfirmedAppointment = [...upcomingConfirmedAppointments].sort(
      (left, right) => (left.scheduledAt?.toMillis() || 0) - (right.scheduledAt?.toMillis() || 0)
    )[0];

    const items = [
      pendingAppointments.length > 0
        ? {
            key: 'pending-counseling',
            title: `상담 승인 대기 ${pendingAppointments.length}건`,
            detail: nextPendingAppointment
              ? `${nextPendingAppointment.studentName} 학생 상담 요청부터 확인하세요.`
              : '오늘 요청된 상담을 먼저 승인하거나 조정하세요.',
            actionLabel: '상담 현황',
            icon: MessageSquare,
            toneClass: 'bg-[#FFF2E8] text-[#C95A08]',
            onClick: () => scrollToSection(appointmentsSectionRef),
          }
        : upcomingConfirmedAppointments.length > 0
          ? {
              key: 'confirmed-counseling',
              title: `곧 시작 상담 ${upcomingConfirmedAppointments.length}건`,
              detail: nextConfirmedAppointment?.scheduledAt
                ? `${format(nextConfirmedAppointment.scheduledAt.toDate(), 'HH:mm')} · ${nextConfirmedAppointment.studentName} 학생 상담이 예정되어 있습니다.`
                : '확정된 상담 일정을 먼저 준비하세요.',
              actionLabel: '상담 준비',
              icon: Clock,
              toneClass: 'bg-[#EEF4FF] text-[#2554D7]',
              onClick: () => scrollToSection(appointmentsSectionRef),
            }
          : null,
      attendanceBoardSummary.lateOrAbsentCount > 0
        ? {
            key: 'attendance',
            title: `미입실·지각 ${attendanceBoardSummary.lateOrAbsentCount}명`,
            detail: '실시간 교실에서 출결 신호 학생을 먼저 확인하고 바로 연락 여부를 판단하세요.',
            actionLabel: '실시간 교실',
            icon: AlertCircle,
            toneClass: 'bg-rose-100 text-rose-700',
            onClick: () => scrollToSection(liveBoardSectionRef),
          }
        : null,
      attendanceBoardSummary.longAwayCount > 0
        ? {
            key: 'long-away',
            title: `장기 외출 ${attendanceBoardSummary.longAwayCount}명`,
            detail: '오래 자리를 비운 학생의 복귀 여부를 실시간 교실에서 먼저 점검하세요.',
            actionLabel: '좌석 확인',
            icon: LogOut,
            toneClass: 'bg-amber-100 text-amber-700',
            onClick: () => scrollToSection(liveBoardSectionRef),
          }
        : null,
      seatOverlaySummary.riskCount > 0
        ? {
            key: 'risk',
            title: `리스크 학생 ${seatOverlaySummary.riskCount}명`,
            detail: '학생 히트맵에서 위험 학생을 먼저 눌러 오늘 개입이 필요한 이유를 확인하세요.',
            actionLabel: '학생 히트맵',
            icon: ShieldAlert,
            toneClass: 'bg-[#EEF4FF] text-[#2554D7]',
            onClick: () => scrollToSection(seatInsightSectionRef),
          }
        : null,
      unreadReportCount > 0
        ? {
            key: 'unread-report',
            title: `미열람 리포트 ${unreadReportCount}건`,
            detail: '학부모가 아직 읽지 않은 리포트를 보고 후속 안내가 필요한지 먼저 확인하세요.',
            actionLabel: '리포트 보기',
            icon: Eye,
            toneClass: 'bg-[#FFF2E8] text-[#C95A08]',
            onClick: () => scrollToSection(reportsSectionRef),
          }
        : null,
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));

    return items.slice(0, 3);
  }, [
    appointments,
    attendanceBoardSummary.lateOrAbsentCount,
    attendanceBoardSummary.longAwayCount,
    now,
    seatOverlaySummary.riskCount,
    unreadReportCount,
  ]);

  const topTeacherPriority = teacherActionQueue[0] || null;
  const secondaryTeacherPriorities = teacherActionQueue.slice(1);
  const TopTeacherPriorityIcon = topTeacherPriority?.icon;

  const getDeckMotionProps = (delay = 0, offset = 18) =>
    prefersReducedMotion
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: offset },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.48, delay, ease: 'easeOut' as const },
        };

  const heroSummaryCards = [
    {
      key: 'total',
      label: `${selectedClass === 'all' ? '센터 전체' : selectedClass} 오늘 누적`,
      value: formatDurationMinutes(stats.totalCenterMinutes),
      footnote: '실제 공부시간 기준',
      icon: Activity,
      iconClass: 'bg-white/10 text-white',
      valueClass: 'text-white',
    },
    {
      key: 'avg',
      label: '평균 학습',
      value: formatDurationMinutes(stats.avgMinutes),
      footnote: '현재 필터 기준 평균',
      icon: Users,
      iconClass: 'bg-white/10 text-white',
      valueClass: 'text-white',
    },
    {
      key: 'top20',
      label: '상위 20% 평균',
      value: formatDurationMinutes(stats.top20Avg),
      footnote: '상위권 기준점',
      icon: Trophy,
      iconClass: 'bg-white/10 text-white',
      valueClass: 'text-white',
    },
  ];

  const operationalKpis = [
    {
      key: 'studying',
      label: '학습 중',
      value: roomScopedKpi?.studying ?? stats.studying,
      caption: '현재 공부 상태',
      icon: Activity,
      shellClass: 'border-[#D8E6FF] bg-[linear-gradient(180deg,#F8FBFF_0%,#EEF4FF_100%)]',
      iconClass: 'bg-[#EAF2FF] text-[#2554D7]',
      valueClass: 'text-[#2554D7]',
    },
    {
      key: 'absent',
      label: '미입실',
      value: roomScopedKpi?.absent ?? stats.absent,
      caption: '출결 확인 우선',
      icon: AlertCircle,
      shellClass: 'border-rose-100 bg-[linear-gradient(180deg,#FFF8F9_0%,#FFF1F4_100%)]',
      iconClass: 'bg-rose-100 text-rose-600',
      valueClass: 'text-rose-600',
    },
    {
      key: 'away',
      label: '외출/휴식',
      value: roomScopedKpi?.away ?? stats.away,
      caption: '자리 이탈 상태',
      icon: Clock,
      shellClass: 'border-amber-100 bg-[linear-gradient(180deg,#FFF9F1_0%,#FFF4E6_100%)]',
      iconClass: 'bg-amber-100 text-amber-600',
      valueClass: 'text-amber-600',
    },
    {
      key: 'total',
      label:
        selectedRoomView === 'all'
          ? selectedClass === 'all'
            ? '전체 좌석'
            : `${selectedClass} 정원`
          : `${getRoomLabel(selectedRoomView, roomConfigs)} 좌석`,
      value: roomScopedKpi?.total ?? stats.total,
      caption: selectedRoomView === 'all' ? '운영 가능 좌석' : '선택 호실 기준',
      icon: Armchair,
      shellClass: 'border-[#D8E6FF] bg-[linear-gradient(180deg,#F8FAFF_0%,#EEF4FF_100%)]',
      iconClass: 'bg-[#EAF2FF] text-[#14295F]',
      valueClass: 'text-[#14295F]',
      hasEdit: true,
    },
  ];

  const unassignedStudents = useMemo(() => {
    if (!students || !studentMembers) return [];
    const keyword = searchTerm.toLowerCase();
    return students
      .filter((student) => {
        const membership = studentMembersById.get(student.id);
        return membership?.status === 'active' && !hasAssignedSeat(student);
      })
      .filter((student) => student.name.toLowerCase().includes(keyword));
  }, [students, studentMembers, studentMembersById, searchTerm]);

  const roomResizeConflicts = useMemo(() => {
    const conflictMap = new Map<string, ResolvedAttendanceSeat[]>();

    roomConfigs.forEach((room) => {
      const maxCells = room.rows * room.cols;
      const conflicts = resolvedAttendanceList
        .filter((seat) => seat.roomId === room.id)
        .filter((seat) => seat.roomSeatNo > maxCells)
        .filter((seat) => Boolean(seat.studentId) || Boolean(seat.seatZone) || seat.type === 'aisle')
        .sort((a, b) => a.roomSeatNo - b.roomSeatNo);
      conflictMap.set(room.id, conflicts);
    });

    return conflictMap;
  }, [resolvedAttendanceList, roomConfigs]);

  const selectedStudentName = useMemo(() => {
    if (!selectedSeat?.studentId) return '학생';
    const matched = studentsById.get(selectedSeat.studentId);
    return matched?.name || '학생';
  }, [studentsById, selectedSeat?.studentId]);

  const selectedStudentProfile = useMemo(() => {
    if (!selectedSeat?.studentId) return null;
    return studentsById.get(selectedSeat.studentId) || null;
  }, [studentsById, selectedSeat?.studentId]);

  const selectedSeatLabel = useMemo(
    () => formatSeatLabel(selectedSeat, roomConfigs),
    [selectedSeat, roomConfigs]
  );
  const selectedSeatModeLabel = useMemo(
    () => (selectedSeat?.type === 'aisle' ? '통로 모드' : '좌석 모드'),
    [selectedSeat?.type]
  );
  const selectedSeatZoneLabel = useMemo(
    () => (selectedSeat?.type === 'aisle' ? '통로' : selectedSeat?.seatZone || '미정'),
    [selectedSeat?.seatZone, selectedSeat?.type]
  );
  const selectedSeatAssignmentLabel = useMemo(() => {
    if (selectedSeat?.type === 'aisle') return '학생 배정 비활성';
    if (selectedSeat?.studentId) return '현재 배정된 좌석';
    return '즉시 배정 가능';
  }, [selectedSeat?.studentId, selectedSeat?.type]);
  const selectedSeatAvailabilityCopy = useMemo(() => {
    if (selectedSeat?.type === 'aisle') {
      return '현재는 이동 동선 확보용 통로로 설정되어 있습니다.';
    }
    if (selectedSeat?.studentId) {
      return '배정 정보가 연결된 좌석입니다.';
    }
    return '학생을 바로 연결할 수 있는 빈 좌석입니다.';
  }, [selectedSeat?.studentId, selectedSeat?.type]);
  const unassignedStudentCountLabel = useMemo(
    () => `${unassignedStudents.length}명 대기`,
    [unassignedStudents]
  );

  const activeSeatOverlayMode: CenterAdminSeatOverlayMode = isEditMode ? 'status' : seatOverlayMode;
  const activeSeatOverlayOption =
    SEAT_OVERLAY_OPTIONS.find((item) => item.value === activeSeatOverlayMode) || SEAT_OVERLAY_OPTIONS[0];
  const activeSeatOverlayLegends = seatOverlayLegend[activeSeatOverlayMode] || [];
  const selectedRoomLabel = selectedRoomView === 'all' ? '전체 호실' : getRoomLabel(selectedRoomView, roomConfigs);
  const heatmapSummaryItems = [
    { label: '안정', value: seatOverlaySummary.healthyCount, tone: 'bg-emerald-100 text-emerald-700' },
    { label: '주의', value: seatOverlaySummary.warningCount, tone: 'bg-amber-100 text-amber-700' },
    { label: '위험', value: seatOverlaySummary.riskCount, tone: 'bg-rose-100 text-rose-700' },
    { label: '미열람', value: seatOverlaySummary.unreadCount, tone: 'bg-sky-100 text-sky-700' },
    { label: '상담', value: seatOverlaySummary.counselingCount, tone: 'bg-violet-100 text-violet-700' },
    { label: '장기외출', value: seatOverlaySummary.awayCount, tone: 'bg-[#FFF2E8] text-[#C95A08]' },
  ];

  const selectedSeatSignal = useMemo<CenterAdminStudentSeatSignal | null>(() => {
    if (!selectedSeat) return null;
    return (
      seatSignalsBySeatId.get(selectedSeat.id) ||
      (selectedSeat.studentId ? studentSignalsByStudentId.get(selectedSeat.studentId) || null : null)
    );
  }, [selectedSeat, seatSignalsBySeatId, studentSignalsByStudentId]);

  const selectedSeatDomainSummary = useMemo(
    () => getCenterAdminDomainSummary(selectedSeatSignal, { includeFinancialSignals: false }),
    [selectedSeatSignal]
  );

  const selectedSeatDomainInsight = useMemo(
    () =>
      selectedSeatDomainSummary.find((domain) => domain.key === selectedSeatInsightKey) ||
      selectedSeatDomainSummary[0] ||
      null,
    [selectedSeatDomainSummary, selectedSeatInsightKey]
  );

  useEffect(() => {
    if (!selectedSeatDomainSummary.length) {
      setSelectedSeatInsightKey(null);
      return;
    }

    setSelectedSeatInsightKey((current) => {
      if (current && selectedSeatDomainSummary.some((domain) => domain.key === current)) {
        return current;
      }

      return [...selectedSeatDomainSummary].sort((a, b) => a.score - b.score)[0]?.key || selectedSeatDomainSummary[0].key;
    });
  }, [selectedSeatDomainSummary]);

  const selectedAttendanceSignal = useMemo<CenterAdminAttendanceSeatSignal | null>(() => {
    if (!selectedSeat) return null;
    return (
      attendanceSeatSignalsBySeatId.get(selectedSeat.id) ||
      (selectedSeat.studentId ? attendanceSeatSignalsByStudentId.get(selectedSeat.studentId) || null : null)
    );
  }, [attendanceSeatSignalsBySeatId, attendanceSeatSignalsByStudentId, selectedSeat]);

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

  const selectedStudentHistoryMetrics = useMemo(() => {
    if (!selectedStudentHistory.length) {
      return {
        averageMinutes: 0,
        peakMinutes: 0,
        latestMinutes: 0,
        latestDateKey: '',
      };
    }

    const minutes = selectedStudentHistory.map((item) => Math.max(0, Number(item.totalMinutes || 0)));
    const totalMinutes = minutes.reduce((sum, value) => sum + value, 0);

    return {
      averageMinutes: Math.round(totalMinutes / minutes.length),
      peakMinutes: Math.max(...minutes),
      latestMinutes: minutes[0] || 0,
      latestDateKey: selectedStudentHistory[0]?.dateKey || '',
    };
  }, [selectedStudentHistory]);

  const latestSelectedPenaltyLog = useMemo(
    () => selectedStudentPenaltyLogs[0] || null,
    [selectedStudentPenaltyLogs]
  );

  const latestSelectedReport = useMemo(
    () => selectedStudentReports[0] || null,
    [selectedStudentReports]
  );

  const handleToggleEditMode = () => {
    if (!isEditMode && selectedRoomView === 'all' && roomConfigs[0]) {
      setSelectedRoomView(roomConfigs[0].id);
      toast({
        title: `${roomConfigs[0].name} 도면 편집으로 전환되었습니다.`,
        description: '호실별 가로/세로와 좌석 배치를 바로 수정할 수 있습니다.',
      });
    }
    setIsEditMode((prev) => !prev);
  };

  const handleRoomDraftChange = (roomId: string, key: 'rows' | 'cols', value: string) => {
    const fallbackRoom = persistedRoomMap.get(roomId);
    const fallbackValue = key === 'rows' ? fallbackRoom?.rows ?? 7 : fallbackRoom?.cols ?? 10;
    const parsed = Number.parseInt(value, 10);
    const safeValue = Number.isFinite(parsed) ? Math.min(24, Math.max(1, parsed)) : fallbackValue;

    setRoomDrafts((prev) => ({
      ...prev,
      [roomId]: {
        rows: key === 'rows' ? safeValue : prev[roomId]?.rows ?? fallbackRoom?.rows ?? 7,
        cols: key === 'cols' ? safeValue : prev[roomId]?.cols ?? fallbackRoom?.cols ?? 10,
      },
    }));
  };

  const handleCancelRoomDraft = (roomId: string) => {
    const persistedRoom = persistedRoomMap.get(roomId);
    if (!persistedRoom) return;
    setRoomDrafts((prev) => ({
      ...prev,
      [roomId]: {
        rows: persistedRoom.rows,
        cols: persistedRoom.cols,
      },
    }));
  };

  const handleSaveRoomSettings = async (roomId: string) => {
    if (!firestore || !centerId) return;

    const roomDraft = roomDrafts[roomId];
    const persistedRoom = persistedRoomMap.get(roomId);
    if (!roomDraft || !persistedRoom) return;

    const conflicts = roomResizeConflicts.get(roomId) || [];
    if (conflicts.length > 0) {
      const preview = conflicts
        .slice(0, 3)
        .map((seat) => formatSeatLabel(seat, roomConfigs))
        .join(', ');
      toast({
        variant: 'destructive',
        title: '축소 저장을 진행할 수 없습니다.',
        description:
          conflicts.length > 3
            ? `${preview} 외 ${conflicts.length - 3}개 셀에 배정 또는 통로 설정이 남아 있습니다. 먼저 정리해 주세요.`
            : `${preview} 셀에 배정 또는 통로 설정이 남아 있습니다. 먼저 정리해 주세요.`,
      });
      return;
    }

    setIsSaving(true);
    try {
      const nextRooms = persistedRooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              rows: roomDraft.rows,
              cols: roomDraft.cols,
            }
          : room
      );

      await setDoc(
        doc(firestore, 'centers', centerId),
        {
          layoutSettings: {
            rows: nextRooms[0]?.rows ?? roomDraft.rows,
            cols: nextRooms[0]?.cols ?? roomDraft.cols,
            rooms: nextRooms,
            updatedAt: serverTimestamp(),
          },
        },
        { merge: true }
      );

      toast({
        title: `${getRoomLabel(roomId, roomConfigs)} 도면이 저장되었습니다.`,
        description: `${roomDraft.cols} x ${roomDraft.rows} 구조로 반영했습니다.`,
      });
    } catch (error) {
      toast({ variant: 'destructive', title: '도면 저장 실패' });
    } finally {
      setIsSaving(false);
    }
  };

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

      const requestRef = collection(firestore, 'centers', centerId, 'attendance요청');
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
      const nowDate = new Date();
      const todayDateKey = format(nowDate, 'yyyy-MM-dd');

      // 퇴실 처리 시 공부 시간 강제 저장 로직
      if (prevStatus === 'studying' && nextStatus !== 'studying' && selectedSeat.lastCheckInAt) {
        const nowTs = Date.now();
        const startTime = selectedSeat.lastCheckInAt.toMillis();
        const sessionDateKey = format(selectedSeat.lastCheckInAt.toDate(), 'yyyy-MM-dd');
        const sessionSeconds = Math.max(0, Math.floor((nowTs - startTime) / 1000));
        const sessionMinutes = Math.max(1, Math.ceil(sessionSeconds / 60));

        if (sessionSeconds > 0) {
          const logRef = doc(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', sessionDateKey);
          batch.set(logRef, { totalMinutes: increment(sessionMinutes), studentId, centerId, dateKey: sessionDateKey, updatedAt: serverTimestamp() }, { merge: true });

          const sessionRef = doc(collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', sessionDateKey, 'sessions'));
          batch.set(sessionRef, { startTime: selectedSeat.lastCheckInAt, endTime: Timestamp.fromMillis(nowTs), durationMinutes: sessionMinutes, createdAt: serverTimestamp() });

          const statRef = doc(firestore, 'centers', centerId, 'dailyStudentStats', sessionDateKey, 'students', studentId);
          batch.set(statRef, { totalStudyMinutes: increment(sessionMinutes), studentId, centerId, dateKey: sessionDateKey, updatedAt: serverTimestamp() }, { merge: true });

          const progressRef = doc(firestore, 'centers', centerId, 'growthProgress', studentId);
          const progressSnap = await getDoc(progressRef);
          const p = progressSnap.exists() ? (progressSnap.data() as GrowthProgress) : null;
          const stats = p?.stats || { focus: 0, consistency: 0, achievement: 0, resilience: 0 };
          const periodKey = sessionDateKey.slice(0, 7);
          const progressUpdate: Record<string, any> = {
            stats: {
              focus: increment((sessionMinutes / 60) * 0.1),
            },
            updatedAt: serverTimestamp(),
          };
          batch.set(progressRef, progressUpdate, { merge: true });

          const rankRef = doc(firestore, 'centers', centerId, 'leaderboards', `${periodKey}_study-time`, 'entries', studentId);
          batch.set(rankRef, {
            studentId,
            displayNameSnapshot: selectedStudentProfile?.name || selectedStudentName,
            classNameSnapshot: selectedStudentProfile?.className || null,
            value: increment(sessionMinutes),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      }

      const updateData: any = {
        seatNo: selectedSeat.seatNo,
        roomId: selectedSeat.roomId,
        roomSeatNo: selectedSeat.roomSeatNo,
        type: selectedSeat.type || 'seat',
        status: nextStatus,
        updatedAt: serverTimestamp(),
        ...(nextStatus === 'studying' ? { lastCheckInAt: serverTimestamp() } : {})
      };

      batch.update(seatRef, updateData);

      appendAttendanceEventToBatch(batch, firestore, centerId, {
        studentId,
        dateKey: todayDateKey,
        eventType: 'status_override',
        occurredAt: nowDate,
        source: 'teacher_dashboard',
        seatId: selectedSeat.id,
        statusBefore: prevStatus,
        statusAfter: nextStatus,
      });

      if (prevStatus === 'absent' && nextStatus === 'studying') {
        appendAttendanceEventToBatch(batch, firestore, centerId, {
          studentId,
          dateKey: todayDateKey,
          eventType: 'check_in',
          occurredAt: nowDate,
          source: 'teacher_dashboard',
          seatId: selectedSeat.id,
          statusBefore: prevStatus,
          statusAfter: nextStatus,
        });
        mergeAttendanceDailyStatToBatch(batch, firestore, centerId, studentId, todayDateKey, {
          attendanceStatus: nextStatus,
          checkInAt: nowDate,
          source: 'teacher_dashboard',
        });
      } else if ((prevStatus === 'away' || prevStatus === 'break') && nextStatus === 'studying') {
        appendAttendanceEventToBatch(batch, firestore, centerId, {
          studentId,
          dateKey: todayDateKey,
          eventType: 'away_end',
          occurredAt: nowDate,
          source: 'teacher_dashboard',
          seatId: selectedSeat.id,
          statusBefore: prevStatus,
          statusAfter: nextStatus,
        });
        mergeAttendanceDailyStatToBatch(batch, firestore, centerId, studentId, todayDateKey, {
          attendanceStatus: nextStatus,
          source: 'teacher_dashboard',
        });
      } else if ((nextStatus === 'away' || nextStatus === 'break') && prevStatus === 'studying') {
        appendAttendanceEventToBatch(batch, firestore, centerId, {
          studentId,
          dateKey: todayDateKey,
          eventType: 'away_start',
          occurredAt: nowDate,
          source: 'teacher_dashboard',
          seatId: selectedSeat.id,
          statusBefore: prevStatus,
          statusAfter: nextStatus,
        });
        mergeAttendanceDailyStatToBatch(batch, firestore, centerId, studentId, todayDateKey, {
          attendanceStatus: nextStatus,
          source: 'teacher_dashboard',
        });
      } else if (nextStatus === 'absent' && prevStatus !== 'absent') {
        appendAttendanceEventToBatch(batch, firestore, centerId, {
          studentId,
          dateKey: todayDateKey,
          eventType: 'check_out',
          occurredAt: nowDate,
          source: 'teacher_dashboard',
          seatId: selectedSeat.id,
          statusBefore: prevStatus,
          statusAfter: nextStatus,
        });
        mergeAttendanceDailyStatToBatch(batch, firestore, centerId, studentId, todayDateKey, {
          attendanceStatus: nextStatus,
          checkOutAt: nowDate,
          hasCheckOutRecord: true,
          source: 'teacher_dashboard',
        });
      } else {
        mergeAttendanceDailyStatToBatch(batch, firestore, centerId, studentId, todayDateKey, {
          attendanceStatus: nextStatus,
          source: 'teacher_dashboard',
        });
      }

      await batch.commit();
      // 카카오 알림톡 발송 (선생님 수동 조작)
      const studentName = studentsById.get(studentId)?.name || '학생';
      const autoCheckInAt =
        nextStatus === 'studying'
          ? new Date()
          : (toDateSafeAttendance(selectedSeat.lastCheckInAt) || null);
      void syncAutoAttendanceRecord({
        firestore,
        centerId,
        studentId,
        studentName,
        targetDate: new Date(),
        checkInAt: autoCheckInAt,
        confirmedByUserId: user?.uid,
      }).catch((syncError: any) => {
        console.warn('[teacher-dashboard] auto attendance sync skipped', syncError?.message || syncError);
      });

      const kakaoType: any = nextStatus === 'studying' ? 'entry' : nextStatus === 'away' ? 'away' : 'exit';
      void sendKakaoNotification(firestore, centerId, {
        studentId,
        studentName,
        type: kakaoType
      }).catch((notifyError: any) => {
        console.warn('[teacher-dashboard] attendance notification skipped', notifyError?.message || notifyError);
      });
      
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
    const normalizedZone = zone === '미정' ? null : zone;
    setIsSaving(true);
    try {
      const seatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id);
      await setDoc(seatRef, {
        seatNo: selectedSeat.seatNo,
        roomId: selectedSeat.roomId,
        roomSeatNo: selectedSeat.roomSeatNo,
        seatZone: normalizedZone ?? deleteField(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      if (selectedSeat.studentId) {
        const studentRef = doc(firestore, 'centers', centerId, 'students', selectedSeat.studentId);
        await updateDoc(studentRef, {
          seatId: selectedSeat.id,
          seatNo: selectedSeat.seatNo,
          roomId: selectedSeat.roomId,
          roomSeatNo: selectedSeat.roomSeatNo,
          seatZone: normalizedZone ?? deleteField(),
          updatedAt: serverTimestamp(),
        });
      }
      
      toast({ title: "구역 설정이 완료되었습니다." });
      setSelectedSeat({ ...selectedSeat, seatZone: normalizedZone ?? undefined });
    } catch (e) {
      toast({ variant: "destructive", title: "설정 실패" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleCellType = async () => {
    if (!firestore || !centerId || !selectedSeat) return;
    const nextType = selectedSeat.type === 'aisle' ? 'seat' : 'aisle';
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const seatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id);
      if (nextType === 'aisle' && selectedSeat.studentId) {
        batch.update(doc(firestore, 'centers', centerId, 'students', selectedSeat.studentId), {
          seatNo: 0,
          seatId: deleteField(),
          roomId: deleteField(),
          roomSeatNo: deleteField(),
          seatZone: deleteField(),
          updatedAt: serverTimestamp(),
        });
        batch.set(
          seatRef,
          {
            type: 'aisle',
            studentId: null,
            seatNo: selectedSeat.seatNo,
            roomId: selectedSeat.roomId,
            roomSeatNo: selectedSeat.roomSeatNo,
            seatZone: deleteField(),
            status: 'absent',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else if (nextType === 'aisle') {
        batch.set(
          seatRef,
          {
            type: 'aisle',
            studentId: null,
            seatNo: selectedSeat.seatNo,
            roomId: selectedSeat.roomId,
            roomSeatNo: selectedSeat.roomSeatNo,
            seatZone: deleteField(),
            status: 'absent',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        batch.set(
          seatRef,
          {
            type: nextType,
            seatNo: selectedSeat.seatNo,
            roomId: selectedSeat.roomId,
            roomSeatNo: selectedSeat.roomSeatNo,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
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
        seatId: selectedSeat.id,
        seatNo: selectedSeat.seatNo,
        roomId: selectedSeat.roomId,
        roomSeatNo: selectedSeat.roomSeatNo,
        seatZone: selectedSeat.seatZone || null,
        updatedAt: serverTimestamp()
      });
      batch.set(
        doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id),
        {
          studentId: student.id,
          status: 'absent',
          type: 'seat',
          seatNo: selectedSeat.seatNo,
          roomId: selectedSeat.roomId,
          roomSeatNo: selectedSeat.roomSeatNo,
          seatZone: selectedSeat.seatZone || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
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
      batch.update(doc(firestore, 'centers', centerId, 'students', selectedSeat.studentId), {
        seatNo: 0,
        seatId: deleteField(),
        roomId: deleteField(),
        roomSeatNo: deleteField(),
        seatZone: deleteField(),
        updatedAt: serverTimestamp(),
      });
      batch.set(
        doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id),
        {
          studentId: null,
          seatNo: selectedSeat.seatNo,
          roomId: selectedSeat.roomId,
          roomSeatNo: selectedSeat.roomSeatNo,
          status: 'absent',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await batch.commit();
      toast({ title: "배정 해제 완료" });
      setIsManaging(false);
    } catch (e) { toast({ variant: "destructive", title: "해제 실패" }); } finally { setIsSaving(false); }
  };

  const activeRoomConflicts = selectedRoomConfig
    ? roomResizeConflicts.get(selectedRoomConfig.id) || []
    : [];

  const renderRoomGridCanvas = (room: LayoutRoomConfig, compact = false) => (
    <ScrollArea className="w-full max-w-full">
      <div
        className={cn(
          'mx-auto w-fit rounded-[2.5rem] border-2 border-muted/30 bg-[#fafafa]',
          compact ? 'p-3 sm:p-4' : isMobile ? 'p-4' : 'p-6 sm:p-10 shadow-inner'
        )}
      >
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${room.cols}, minmax(${compact ? 52 : 64}px, 1fr))` }}
        >
          {Array.from({ length: room.cols }).map((_, colIndex) => (
            <div key={`${room.id}_${colIndex}`} className="flex flex-col gap-2">
              {Array.from({ length: room.rows }).map((_, rowIndex) => {
                const roomSeatNo = colIndex * room.rows + rowIndex + 1;
                const seat = getSeatForRoom(room, roomSeatNo);
                const student = seat.studentId ? studentsById.get(seat.studentId) : undefined;
                const studentMember = seat.studentId ? studentMembersById.get(seat.studentId) : undefined;
                const occupantId = typeof seat.studentId === 'string' ? seat.studentId : '';
                const occupantName = student?.name || studentMember?.displayName || (occupantId ? '배정됨' : '');
                const isFilteredOut = selectedClass !== 'all' && studentMember?.className !== selectedClass;
                const seatSignal =
                  (occupantId ? seatSignalsBySeatId.get(seat.id) : null) ||
                  (occupantId ? studentSignalsByStudentId.get(occupantId) || null : null);
                const overlayPresentation = getCenterAdminSeatOverlayPresentation({
                  signal: seatSignal,
                  mode: activeSeatOverlayMode,
                  status: seat.status,
                  isEditMode,
                });
                const isAisle = seat.type === 'aisle';
                const nameTextClass =
                  occupantId && overlayPresentation.isDark ? 'text-white drop-shadow-[0_1px_6px_rgba(15,23,42,0.28)]' : 'text-slate-950';

                return (
                  <div
                    key={`${room.id}_${roomSeatNo}`}
                    onClick={() => handleSeatClick(seat)}
                    className={cn(
                      'relative aspect-square cursor-pointer overflow-hidden border-2 outline-none shadow-sm transition-all duration-500',
                      compact ? 'min-w-[52px] rounded-[1.1rem] p-1' : 'min-w-[64px] rounded-2xl p-1',
                      'flex flex-col items-center justify-center',
                      isFilteredOut ? 'border-transparent bg-muted/10 opacity-20 grayscale' :
                      isAisle ? 'border-transparent bg-transparent text-transparent hover:bg-muted/10' :
                      occupantId ? overlayPresentation.surfaceClass :
                      'border-primary/40 bg-white text-primary/5 hover:border-primary/60',
                      isEditMode && isAisle && 'border-dashed border-muted-foreground/20 bg-muted/5 text-muted-foreground/20'
                    )}
                  >
                    {!isAisle && (
                      <span
                        className={cn(
                          'absolute left-1.5 top-1 font-black',
                          compact ? 'text-[6px]' : 'text-[7px]',
                          occupantId && overlayPresentation.isDark ? 'opacity-70' : 'opacity-40'
                        )}
                      >
                        {roomSeatNo}
                      </span>
                    )}
                    {seat.seatZone && !isAisle && isEditMode && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'absolute right-1 top-1 border-none px-1 font-black',
                          compact ? 'h-3 text-[5px]' : 'h-3.5 text-[6px]',
                          occupantId ? overlayPresentation.flagClass : 'bg-primary/5 text-primary/40'
                        )}
                      >
                        {seat.seatZone.charAt(0)}
                      </Badge>
                    )}
                    {isAisle ? (
                      isEditMode && <MapIcon className={cn(compact ? 'h-2.5 w-2.5' : 'h-3 w-3', 'opacity-40')} />
                    ) : occupantId ? (
                      <div
                        className={cn(
                          'flex h-full w-full flex-col items-center justify-center text-center',
                          compact ? 'px-1 pt-2' : 'px-1.5'
                        )}
                      >
                        <span
                          className={cn(
                            'w-full font-black tracking-tight whitespace-normal break-keep text-center',
                            nameTextClass,
                            compact
                              ? 'text-[10px] leading-[1.12] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden'
                              : 'text-[12px] leading-[1.18] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden'
                          )}
                        >
                          {occupantName}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className={cn('font-black uppercase tracking-tighter opacity-100', compact ? 'text-[6px]' : 'text-[7px]')}>
                          빈좌석
                        </span>
                        {isEditMode && <UserPlus className={cn(compact ? 'h-2 w-2' : 'h-2.5 w-2.5', 'mt-0.5 text-primary/40')} />}
                      </div>
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
  );

  if (!mounted) return (
    <div className="flex flex-col h-[70vh] w-full items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      <p className="font-black text-primary tracking-tighter uppercase opacity-40">대시보드 불러오는 중...</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto pb-24 min-h-screen">
      <motion.section className="px-4 pt-6" {...getDeckMotionProps(0.02, 22)}>
        <Card className="marketing-card-dark relative overflow-hidden rounded-[2.8rem] border-none">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(129,173,255,0.3),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,160,67,0.14),transparent_30%)]" />
          <div className="pointer-events-none absolute -right-12 top-0 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <CardContent className={cn("relative", isMobile ? "p-4" : "p-6 sm:p-7")}>
            <div className={cn("grid gap-5", isMobile ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1.2fr)_420px] xl:items-stretch")}>
              <div className="flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="h-6 rounded-full border border-white/10 bg-white/10 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-none">
                      Teacher Control Deck
                    </Badge>
                    <Badge className="h-6 rounded-full border-none bg-[#FF8A1F] px-3 text-[10px] font-black text-white shadow-[0_10px_24px_-16px_rgba(255,138,31,0.85)]">
                      실시간
                    </Badge>
                    <Badge className="h-6 rounded-full border border-white/10 bg-white/[0.06] px-3 text-[10px] font-black text-white/90 shadow-none">
                      {selectedClass === 'all' ? '센터 전체 운영' : `${selectedClass} 운영`}
                    </Badge>
                  </div>

                  <div className="flex items-start gap-4">
                    <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.5rem] border border-white/10 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                      <Monitor className="h-7 w-7 text-white" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.34em] text-white">통합 관제 센터</p>
                      <h1 className={cn("mt-2 font-aggro-display text-white", isMobile ? "text-[2.15rem]" : "text-[3.2rem] leading-[0.98]")}>
                        실시간 관제 홈
                      </h1>
                    </div>
                  </div>
                </div>

                <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-3")}>
                  <button
                    type="button"
                    onClick={() => setIsHeroPriorityDialogOpen(true)}
                    className="rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-4 text-left backdrop-blur-sm transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.1]"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white">오늘 우선순위</p>
                    <p className="mt-2 text-lg font-black tracking-tight text-white">
                      {teacherActionQueue.length > 0 ? `${teacherActionQueue.length}건 바로 확인` : '즉시 처리 항목 없음'}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsHeroRoomsDialogOpen(true)}
                    className="rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-4 text-left backdrop-blur-sm transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.1]"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white">실시간 교실</p>
                    <p className="mt-2 text-lg font-black tracking-tight text-white">
                      {selectedRoomView === 'all' ? '전체 호실 보기' : getRoomLabel(selectedRoomView, roomConfigs)}
                    </p>
                  </button>
                  <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white">학생 리스크</p>
                    <p className="mt-2 text-lg font-black tracking-tight text-white">
                      위험 {seatOverlaySummary.riskCount}명 · 미열람 {seatOverlaySummary.unreadCount}건
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.08] p-4 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-white">
                    <Filter className="h-3.5 w-3.5" />
                    반 선택
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-[1.3rem] border border-white/10 bg-white/92 p-1.5 pl-4 text-[#14295F] shadow-[0_18px_34px_-24px_rgba(0,0,0,0.45)]">
                    <Filter className="h-3.5 w-3.5 shrink-0 text-[#14295F]/45" />
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                      <SelectTrigger className="h-9 w-full border-none bg-transparent px-0 text-left text-xs font-black shadow-none focus:ring-0">
                        <SelectValue placeholder="반 선택" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="all" className="font-black">센터 전체 보기</SelectItem>
                        {availableClasses.map((c) => (
                          <SelectItem key={c} value={c} className="font-black">{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  {heroSummaryCards.map((item) => (
                    <div
                      key={item.key}
                      className={cn(
                        "rounded-[1.7rem] border border-white/10 bg-white/[0.08] p-4 backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
                        item.key === 'top20' && isMobile ? 'col-span-2' : ''
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white">{item.label}</p>
                          <p className={cn("dashboard-number mt-2 whitespace-nowrap text-[1.4rem] leading-none sm:text-[1.75rem]", item.valueClass)}>
                            {item.value}
                          </p>
                          <p className="mt-2 text-[11px] font-bold text-white">{item.footnote}</p>
                        </div>
                        <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem]", item.iconClass)}>
                          <item.icon className="h-[18px] w-[18px]" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      <motion.section className="px-4" {...getDeckMotionProps(0.1, 18)}>
        <Card className="marketing-card relative overflow-visible rounded-[2.75rem] border-none">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-[2.75rem] bg-[linear-gradient(180deg,rgba(244,248,255,0.85)_0%,rgba(255,255,255,0)_100%)]" />
          <CardContent className={cn("relative space-y-5", isMobile ? "p-4 pb-5" : "p-5 pb-6 sm:p-6 sm:pb-7")}>
            <div className={cn("flex gap-3", isMobile ? "flex-col" : "items-start justify-between")}>
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="h-6 rounded-full border-none bg-[#14295F] px-2.5 text-[10px] font-black tracking-[0.16em] uppercase text-white">
                    오늘의 우선순위
                  </Badge>
                  <Badge className="h-6 rounded-full border-none bg-[#FFF2E8] px-2.5 text-[10px] font-black text-[#C95A08]">
                    TOP 3
                  </Badge>
                </div>
                <p className={cn("mt-4 text-[#14295F]", isMobile ? "font-aggro-display text-[1.7rem]" : "font-aggro-display text-[2.2rem]")}>
                  오늘 먼저 처리할 일
                </p>
                <p className="mt-2 max-w-[42rem] text-xs font-bold leading-6 text-slate-500 sm:text-sm">
                  상담, 출결, 학생 리스크, 리포트 후속 가운데 오늘성 높은 작업만 위로 고정했습니다.
                  클릭하면 해당 섹션으로 바로 이동합니다.
                </p>
              </div>
              <Badge className="h-8 rounded-full border-none bg-white px-3.5 text-[10px] font-black text-[#14295F] shadow-[0_16px_28px_-24px_rgba(20,41,95,0.32)]">
                {selectedClass === 'all' ? '센터 전체' : selectedClass}
              </Badge>
            </div>

            {!topTeacherPriority ? (
              <div className="rounded-[1.9rem] border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm font-black text-slate-500">
                현재 바로 처리해야 할 우선순위 항목이 없습니다.
              </div>
            ) : (
              <div className={cn("-mx-1 grid gap-3 px-1 pb-1", isMobile ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1.28fr)_360px]")}>
                <motion.div {...getDeckMotionProps(0.14, 14)}>
                  <div className="app-depth-card-warm rounded-[2rem] border px-5 py-5 sm:px-6 sm:py-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="h-7 rounded-full border-none bg-[#FF7A16] px-3 text-[10px] font-black text-white">
                            1순위
                          </Badge>
                          <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-full shadow-sm", topTeacherPriority.toneClass)}>
                            {TopTeacherPriorityIcon ? <TopTeacherPriorityIcon className="h-[18px] w-[18px]" /> : null}
                          </span>
                          <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[#C95A08]/70">
                            immediate action
                          </span>
                        </div>
                        <p className={cn("mt-4 text-[#14295F]", isMobile ? "text-[1.45rem] leading-[1.1]" : "text-[1.85rem] leading-[1.08]", "font-aggro-display")}>
                          {topTeacherPriority.title}
                        </p>
                        <p className="mt-3 max-w-[38rem] text-sm font-bold leading-7 text-slate-600">
                          {topTeacherPriority.detail}
                        </p>
                      </div>
                      <Button
                        type="button"
                        className="h-11 shrink-0 rounded-[1.1rem] bg-[#14295F] px-4 text-xs font-black text-white shadow-[0_18px_34px_-24px_rgba(20,41,95,0.45)] hover:bg-[#10224C]"
                        onClick={topTeacherPriority.onClick}
                      >
                        {topTeacherPriority.actionLabel}
                      </Button>
                    </div>
                  </div>
                </motion.div>

                <div className="grid gap-3">
                  {secondaryTeacherPriorities.map((item, index) => (
                    <motion.div key={item.key} {...getDeckMotionProps(0.18 + index * 0.05, 12)}>
                      <button
                        type="button"
                        onClick={item.onClick}
                        className={cn(
                          "group w-full rounded-[1.75rem] px-4 py-4 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5",
                          index === 0 ? "app-depth-card" : "marketing-card-soft"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge className={cn(
                                "h-5 rounded-full border-none px-2 text-[10px] font-black",
                                index === 0 ? "bg-[#EEF4FF] text-[#2554D7]" : "bg-[#FFF2E8] text-[#C95A08]"
                              )}>
                                {index + 2}순위
                              </Badge>
                              <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-full shadow-sm", item.toneClass)}>
                                <item.icon className="h-4 w-4" />
                              </span>
                            </div>
                            <p className="mt-3 text-base font-black text-[#14295F]">{item.title}</p>
                            <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">{item.detail}</p>
                          </div>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.section>

      <motion.section className="px-4" {...getDeckMotionProps(0.16, 16)}>
        <div className={cn("mb-3 flex gap-3 px-1", isMobile ? "flex-col" : "items-end justify-between")}>
          <div>
            <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#2554D7]">
              운영 스냅샷
            </Badge>
            <p className="mt-3 text-xl font-black tracking-tight text-[#14295F] sm:text-[1.45rem]">지금 바로 읽히는 핵심 지표</p>
            <p className="mt-1 text-xs font-bold text-slate-500 sm:text-sm">학습, 미입실, 외출, 좌석을 같은 시야 안에서 빠르게 판단할 수 있게 다시 정렬했습니다.</p>
          </div>
          <Badge className="h-8 rounded-full border-none bg-white px-3.5 text-[10px] font-black text-[#14295F] shadow-[0_18px_28px_-24px_rgba(20,41,95,0.28)]">
            {selectedRoomView === 'all' ? '홈 상단 스냅샷' : `${getRoomLabel(selectedRoomView, roomConfigs)} 스냅샷`}
          </Badge>
        </div>

        <div className={cn("grid gap-4", isMobile ? "grid-cols-2" : "md:grid-cols-4")}>
          {operationalKpis.map((item, index) => (
            <motion.div key={item.key} {...getDeckMotionProps(0.2 + index * 0.05, 12)}>
              <Card className={cn("rounded-[2rem] border p-5 sm:p-6", item.shellClass)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={cn("font-black uppercase tracking-[0.18em] text-slate-500", isMobile ? "text-[9px]" : "text-[10px]")}>
                      {item.label}
                    </p>
                    <p className={cn("dashboard-number mt-3 whitespace-nowrap leading-none", isMobile ? "text-[2.1rem]" : "text-[3.2rem]", item.valueClass)}>
                      {item.value}
                    </p>
                    <p className="mt-2 text-[11px] font-bold text-slate-500">{item.caption}</p>
                  </div>
                  <span className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.1rem]", item.iconClass)}>
                    <item.icon className="h-5 w-5" />
                  </span>
                </div>
                {item.hasEdit ? (
                  <div className="mt-4">
                    <Button
                      variant={isEditMode ? "default" : "outline"}
                      size="sm"
                      onClick={handleToggleEditMode}
                      className={cn(
                        "h-9 rounded-xl px-3 font-black text-[10px] gap-1.5 shadow-sm",
                        isEditMode ? "bg-primary text-white" : "border-2 hover:bg-primary/5"
                      )}
                    >
                      <Settings2 className="h-3.5 w-3.5" /> {isMobile ? '배치' : isEditMode ? '수정 완료' : '배치 수정'}
                    </Button>
                  </div>
                ) : null}
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section className="px-4" {...getDeckMotionProps(0.34, 14)}>
        <Card className="marketing-card-dark overflow-hidden rounded-[2.55rem] border-none">
          <CardContent className={cn("space-y-6", isMobile ? "p-4" : "p-6 sm:p-7")}>
            <TeacherSectionHeader
              badge="최근 30일 추이"
              title="센터 전체 학습 온도 보기"
              icon={TrendingUp}
              tone="emerald"
              onDark
              right={
                <div className="flex items-center gap-2">
                  {trendLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/70" />}
                  <Badge className="h-8 rounded-full border border-white/10 bg-white/[0.08] px-3.5 text-[10px] font-black text-white">
                    {trendLoading ? "업데이트 중" : "최근 30일"}
                  </Badge>
                </div>
              }
            />

            <div className="h-[220px] w-full rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] px-1 pb-2 pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={centerTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTrend" x1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6EE7B7" stopOpacity={0.32}/>
                      <stop offset="95%" stopColor="#6EE7B7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.12)" />
                  <XAxis dataKey="name" fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.62)' }} />
                  <YAxis fontSize={9} fontWeight="900" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.62)' }} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-xl border border-white/10 bg-[#08142F]/96 p-3 shadow-2xl">
                            <p className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/55">{label}</p>
                            <p className="dashboard-number text-base text-emerald-200">
                              {payload[0].value}시간 ({Number(payload[0].payload.totalMinutes).toLocaleString()}분)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="hours" stroke="#6EE7B7" strokeWidth={3} fillOpacity={1} fill="url(#colorTrend)" animationDuration={prefersReducedMotion ? 0 : 1600} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.section>

      <CenterAdminAttendanceBoard
        roomConfigs={roomConfigs}
        selectedRoomView={selectedRoomView}
        selectedClass={selectedClass}
        isMobile={isMobile}
        variant="teacherEditorial"
        isLoading={attendanceBoardLoading}
        summary={attendanceBoardSummary}
        seatSignalsBySeatId={attendanceSeatSignalsBySeatId}
        studentsById={studentsById}
        studentMembersById={studentMembersById}
        getSeatForRoom={getSeatForRoom}
        onSeatClick={handleSeatClick}
      />

      <motion.section ref={liveBoardSectionRef} className="px-4" {...getDeckMotionProps(0.4, 12)}>
        <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.92fr)]")}>
          <div className={cn("space-y-5", isMobile ? "order-2" : "order-1")}>
            <Card className="marketing-card overflow-hidden rounded-[2.75rem] border-none">
              <CardContent className={cn("space-y-5", isMobile ? "p-4" : "p-5 sm:p-6")}>
                <TeacherSectionHeader
                  badge="실시간 교실"
                  title="좌석 흐름과 배치 수정을 한 캔버스에서"
                  description="호실별 전체 흐름과 세부 좌석판을 같은 영역에서 보면서, 바로 편집 모드와 학생 상세 보기로 이어집니다."
                  icon={LayoutGrid}
                  tone="amber"
                  right={
                    <>
                      <Badge className="h-8 rounded-full border-none bg-white px-3.5 text-[10px] font-black text-[#14295F] shadow-[0_18px_28px_-24px_rgba(20,41,95,0.28)]">
                        현재 보기: {selectedRoomLabel}
                      </Badge>
                      {isEditMode && (
                        <Badge className="h-8 rounded-full border-none bg-[#FFF2E8] px-3.5 text-[10px] font-black text-[#C95A08]">
                          배치 수정 모드
                        </Badge>
                      )}
                    </>
                  }
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={selectedRoomView === 'all' ? 'default' : 'outline'}
                    onClick={() => setSelectedRoomView('all')}
                    className={cn(
                      "rounded-2xl px-4 font-black",
                      isMobile ? "h-10 flex-1 min-w-[88px]" : "h-11",
                      selectedRoomView === 'all' ? "bg-[#14295F] text-white" : "border-2 bg-white/80 text-[#14295F]"
                    )}
                  >
                    전체
                  </Button>
                  {roomConfigs.map((room) => (
                    <Button
                      key={room.id}
                      type="button"
                      variant={selectedRoomView === room.id ? 'default' : 'outline'}
                      onClick={() => setSelectedRoomView(room.id)}
                      className={cn(
                        "rounded-2xl px-4 font-black gap-2",
                        isMobile ? "h-10 flex-1 min-w-[96px]" : "h-11",
                        selectedRoomView === room.id ? "bg-[#14295F] text-white" : "border-2 bg-white/80 text-[#14295F]"
                      )}
                    >
                      {room.name}
                      <Badge
                        variant="secondary"
                        className={cn(
                          "h-5 border-none px-1.5 text-[9px] font-black",
                          selectedRoomView === room.id ? "bg-white/15 text-white" : "bg-primary/5 text-primary"
                        )}
                      >
                        {room.cols}x{room.rows}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {selectedRoomView === 'all' ? (
              <Card className="marketing-card-soft overflow-hidden rounded-[2.7rem] border-none">
                <CardContent className={cn("space-y-5", isMobile ? "p-4" : "p-6 sm:p-7")}>
                  <div className={cn("flex gap-4", isMobile ? "flex-col" : "items-start justify-between")}>
                    <div className="min-w-0">
                      <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#2554D7]">
                        전체 실시간 교실
                      </Badge>
                      <h3 className="mt-3 text-[1.8rem] font-black tracking-tight text-[#14295F]">
                        두 호실 흐름을 한 화면에서 비교
                      </h3>
                      <p className="mt-2 max-w-[40rem] text-xs font-bold leading-5 text-[#5c6e97] sm:text-sm">
                        호실별 학생 밀도와 좌석 사용 상황을 빠르게 비교하고, 필요한 호실만 바로 상세 보기로 전환할 수 있게 정리했습니다.
                      </p>
                    </div>
                    <Badge className="h-8 rounded-full border-none bg-white px-3.5 text-[10px] font-black uppercase text-[#14295F] shadow-[0_18px_28px_-24px_rgba(20,41,95,0.28)]">
                      2실 운영 보기
                    </Badge>
                  </div>

                  <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "xl:grid-cols-2")}>
                    {roomSummaries.map((room) => (
                      <Card
                        key={room.id}
                        className="overflow-hidden rounded-[2.35rem] border border-[#D7E4FF] bg-white/90 shadow-[0_28px_60px_-40px_rgba(20,41,95,0.28)]"
                      >
                        <CardContent className="space-y-5 p-4 sm:p-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="grid gap-1">
                              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5c6e97]">실시간 호실</p>
                              <h3 className="text-[1.7rem] font-black tracking-tight text-[#14295F]">{room.name}</h3>
                              <p className="text-xs font-bold text-[#5c6e97]">
                                좌석 클릭으로 학생 상세를 열고, 필요하면 바로 호실 상세 보기로 넘어갈 수 있습니다.
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="border-none bg-[#EEF4FF] font-black text-[#2554D7]">
                                {room.cols} x {room.rows}
                              </Badge>
                              {room.hasUnsavedChanges && (
                                <Badge className="border-none bg-[#FFF2E8] text-[#C95A08] font-black text-[10px]">
                                  미리보기 변경됨
                                </Badge>
                              )}
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setSelectedRoomView(room.id)}
                                className="h-10 rounded-xl border-2 bg-white font-black text-[#14295F]"
                              >
                                상세 편집
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-[1.4rem] border border-[#D7E4FF] bg-[#F8FBFF] p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-[#5c6e97]">학습 중</p>
                              <p className="dashboard-number mt-1 text-2xl text-[#2554D7]">{room.studying}</p>
                            </div>
                            <div className="rounded-[1.4rem] border border-emerald-100 bg-emerald-50/70 p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-[#5c6e97]">배정 좌석</p>
                              <p className="dashboard-number mt-1 text-2xl text-emerald-600">{room.assigned}</p>
                            </div>
                            <div className="rounded-[1.4rem] border border-[#D7E4FF] bg-[#F8FBFF] p-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-[#5c6e97]">가용 좌석</p>
                              <p className="dashboard-number mt-1 text-2xl text-[#14295F]">{room.availableSeats}</p>
                            </div>
                          </div>

                          {renderRoomGridCanvas(room, true)}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : selectedRoomConfig ? (
              <Card
                className={cn(
                  "marketing-card-soft overflow-hidden rounded-[2.8rem] border-none transition-all duration-500",
                  isEditMode ? "ring-4 ring-[#FF7A16]/20" : ""
                )}
              >
                <CardContent className={cn("space-y-5", isMobile ? "p-4" : "p-6 sm:p-7")}>
                  <TeacherSectionHeader
                    badge={selectedRoomConfig.name}
                    title={`${selectedRoomConfig.name} ${isEditMode ? '배치 수정 캔버스' : '실시간 좌석 상황판'}`}
                    description={
                      isEditMode
                        ? '가로·세로 수치를 조정하면서 충돌 셀을 바로 확인하고 저장까지 이어지는 편집 모드입니다.'
                        : '선택한 호실의 좌석 흐름과 운영 상태를 집중해서 읽는 상세 보기입니다.'
                    }
                    icon={Armchair}
                    tone={isEditMode ? 'amber' : 'navy'}
                    right={
                      <>
                        {selectedClass !== 'all' && (
                          <Badge className="h-8 rounded-full border-none bg-[#EEF4FF] px-3.5 text-[10px] font-black text-[#2554D7]">
                            {selectedClass}
                          </Badge>
                        )}
                        <Badge className="h-8 rounded-full border-none bg-white px-3.5 text-[10px] font-black text-[#14295F] shadow-[0_18px_28px_-24px_rgba(20,41,95,0.28)]">
                          {selectedRoomConfig.cols}x{selectedRoomConfig.rows}
                        </Badge>
                      </>
                    }
                  />

                  {isEditMode ? (
                    <div className="rounded-[2rem] border border-[#FFD7B0] bg-white/90 p-4 shadow-sm">
                      <div className={cn("flex flex-wrap items-center gap-3", isMobile ? "" : "justify-between")}>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2 rounded-2xl border border-[#FFE3C4] bg-[#FFF8F1] px-3 py-2 shadow-sm">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-[#C95A08]">가로</Label>
                            <Input
                              type="number"
                              min={1}
                              max={24}
                              value={roomDrafts[selectedRoomConfig.id]?.cols ?? selectedRoomConfig.cols}
                              onChange={(event) => handleRoomDraftChange(selectedRoomConfig.id, 'cols', event.target.value)}
                              className="h-9 w-20 rounded-xl border-2 border-[#FFD7B0] text-center font-black"
                            />
                          </div>
                          <div className="flex items-center gap-2 rounded-2xl border border-[#FFE3C4] bg-[#FFF8F1] px-3 py-2 shadow-sm">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-[#C95A08]">세로</Label>
                            <Input
                              type="number"
                              min={1}
                              max={24}
                              value={roomDrafts[selectedRoomConfig.id]?.rows ?? selectedRoomConfig.rows}
                              onChange={(event) => handleRoomDraftChange(selectedRoomConfig.id, 'rows', event.target.value)}
                              className="h-9 w-20 rounded-xl border-2 border-[#FFD7B0] text-center font-black"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="h-8 rounded-full border-none bg-[#FFF2E8] px-3.5 text-[10px] font-black text-[#C95A08]">
                            {selectedRoomSummary?.hasUnsavedChanges ? '미저장 변경 있음' : '현재 배치 기준'}
                          </Badge>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleCancelRoomDraft(selectedRoomConfig.id)}
                            className="h-11 rounded-xl border-2 bg-white font-black text-[#14295F]"
                          >
                            취소
                          </Button>
                          <Button
                            type="button"
                            onClick={() => handleSaveRoomSettings(selectedRoomConfig.id)}
                            disabled={isSaving || !selectedRoomSummary?.hasUnsavedChanges}
                            className="h-11 rounded-xl bg-[#FF7A16] font-black text-white gap-2 hover:bg-[#EB6E12]"
                          >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            저장
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[2rem] border border-[#D7E4FF] bg-white/85 p-4 shadow-sm">
                      <div className={cn("flex flex-wrap items-center gap-3", isMobile ? "" : "justify-between")}>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-full bg-[#EEF4FF] px-3 py-1 text-[10px] font-black text-[#2554D7]">
                            학습 중 {selectedRoomSummary?.studying ?? 0}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-700">
                            배정 좌석 {selectedRoomSummary?.assigned ?? 0}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-[#F1F6FF] px-3 py-1 text-[10px] font-black text-[#14295F]">
                            가용 좌석 {selectedRoomSummary?.availableSeats ?? 0}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleToggleEditMode}
                          className="h-11 rounded-xl border-2 bg-white font-black text-[#14295F]"
                        >
                          <Settings2 className="mr-1.5 h-4 w-4" />
                          배치 수정
                        </Button>
                      </div>
                    </div>
                  )}

                  {isEditMode && activeRoomConflicts.length > 0 && (
                    <div className="rounded-[2rem] border border-rose-200 bg-rose-50/85 p-4 shadow-sm">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-rose-600" />
                        <p className="text-sm font-black text-rose-700">축소 저장 전 정리가 필요한 셀이 있습니다.</p>
                      </div>
                      <p className="mt-2 text-xs font-bold leading-relaxed text-rose-700/90">
                        {activeRoomConflicts
                          .slice(0, 5)
                          .map((seat) => formatSeatLabel(seat, roomConfigs))
                          .join(', ')}
                        {activeRoomConflicts.length > 5 ? ` 외 ${activeRoomConflicts.length - 5}개` : ''}
                      </p>
                    </div>
                  )}

                  {renderRoomGridCanvas(selectedRoomConfig)}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div ref={seatInsightSectionRef} className={cn("space-y-5", isMobile ? "order-1" : "order-2")}>
            <Card className="marketing-card-soft overflow-hidden rounded-[2.65rem] border-none">
              <CardContent className={cn("space-y-5", isMobile ? "p-4" : "p-5 sm:p-6")}>
                <TeacherSectionHeader
                  badge="도면 학생 히트맵"
                  title="운영 위험 신호를 도면에서 읽는 제어 패널"
                  description="오버레이 모드를 바꾸며 좌석 단위 위험, 학부모 반응, 벌점, 학습 효율을 같은 기준으로 비교할 수 있게 정리했습니다."
                  icon={ShieldAlert}
                  tone="navy"
                  right={
                    <>
                      <Badge className="h-8 rounded-full border-none bg-white px-3.5 text-[10px] font-black text-[#14295F] shadow-[0_18px_28px_-24px_rgba(20,41,95,0.28)]">
                        현재 보기: {activeSeatOverlayOption.label}
                      </Badge>
                      {isEditMode && (
                        <Badge className="h-8 rounded-full border-none bg-amber-100 px-3.5 text-[10px] font-black text-amber-700">
                          편집 중에는 상태 보기 고정
                        </Badge>
                      )}
                    </>
                  }
                />

                <div className="rounded-[2rem] border border-[#D7E4FF] bg-white/85 p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5c6e97]">현재 오버레이</p>
                  <p className="mt-2 text-sm font-black text-[#14295F]">{activeSeatOverlayOption.label}</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[#5c6e97]">
                    {SEAT_OVERLAY_DESCRIPTIONS[activeSeatOverlayMode]}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {heatmapSummaryItems.map((item) => (
                    <span
                      key={item.label}
                      className={cn("inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black", item.tone)}
                    >
                      {item.label} {item.value}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  {SEAT_OVERLAY_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={activeSeatOverlayMode === option.value ? 'default' : 'outline'}
                      disabled={isEditMode && option.value !== 'status'}
                      onClick={() => setSeatOverlayMode(option.value)}
                      className={cn(
                        "rounded-2xl px-4 font-black",
                        isMobile ? "h-10 flex-1 min-w-[92px]" : "h-11",
                        activeSeatOverlayMode === option.value ? "bg-[#14295F] text-white" : "border-2 bg-white/80 text-[#14295F]"
                      )}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                <div className="rounded-[2rem] border border-[#D7E4FF] bg-[#F7FAFF] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5c6e97]">범례</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeSeatOverlayLegends.map((legend) => (
                      <span
                        key={`${activeSeatOverlayMode}_${legend.key}`}
                        className={cn("inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black", legend.tone)}
                      >
                        {legend.label}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.section>

      <motion.section className="px-4" {...getDeckMotionProps(0.48, 12)}>
        <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "lg:grid-cols-12")}>
          <div ref={appointmentsSectionRef} className="lg:col-span-7">
            <Card className="app-depth-card overflow-hidden rounded-[2.6rem] border-none">
              <CardContent className={cn("space-y-5", isMobile ? "p-4" : "p-5 sm:p-6")}>
                <TeacherSectionHeader
                  badge="오늘 상담 현황"
                  title="오늘 바로 챙겨야 할 상담 흐름"
                  description="예약 확정과 승인 대기 상담을 같은 흐름에서 보고, 필요한 일정 관리로 바로 이어질 수 있게 정리했습니다."
                  icon={MessageSquare}
                  tone="navy"
                  right={
                    <>
                      <Badge className="h-8 rounded-full border-none bg-white px-3.5 text-[10px] font-black text-[#14295F] shadow-[0_18px_28px_-24px_rgba(20,41,95,0.28)]">
                        {appointments.length}건
                      </Badge>
                      <Button asChild variant="outline" className="h-10 rounded-xl border-2 bg-white font-black text-[#14295F]">
                        <Link href="/dashboard/appointments">전체 관리 <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                      </Button>
                    </>
                  }
                />
                <div className="grid gap-3">
                  {aptLoading ? <div className="py-10 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#2554D4]/30" /></div> : appointments.length === 0 ? (
                    <div className="rounded-[2.3rem] border-2 border-dashed border-[#D7E4FF] bg-white/70 py-16 text-center"><p className="text-sm font-black text-[#5c6e97]">예정된 상담이 없습니다.</p></div>
                  ) : appointments.map((apt) => (
                    <Card key={apt.id} className="rounded-[2rem] border border-[#D7E4FF] bg-white/92 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl border border-[#D7E4FF] bg-[#F1F6FF]">
                            <span className="text-[10px] font-black leading-none text-[#14295F]">{apt.scheduledAt ? format(apt.scheduledAt.toDate(), 'HH:mm') : ''}</span>
                          </div>
                          <div className="grid min-w-0 leading-tight">
                            <span className="truncate text-sm font-black text-[#14295F]">{apt.studentName} 학생</span>
                            <span className="max-w-[220px] truncate text-[10px] font-bold text-[#5c6e97]">{apt.studentNote || '상담 주제 미입력'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={cn("border-none text-[9px] font-black", apt.status === 'requested' ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>{apt.status === 'requested' ? '승인대기' : '예약확정'}</Badge>
                          <ChevronRight className="h-4 w-4 text-[#9AA9C7]" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div ref={reportsSectionRef} className="lg:col-span-5">
            <Card className="marketing-card-soft overflow-hidden rounded-[2.6rem] border-none">
              <CardContent className={cn("space-y-5", isMobile ? "p-4" : "p-5 sm:p-6")}>
                <TeacherSectionHeader
                  badge="최근 발송 리포트"
                  title="학부모에게 나간 최근 메시지 확인"
                  description="최근 발송된 리포트를 빠르게 열어 보고, 열람 여부와 문장 톤을 즉시 점검할 수 있게 정리했습니다."
                  icon={FileSearch}
                  tone="emerald"
                  right={
                    <Button asChild variant="outline" className="h-10 rounded-xl border-2 bg-white font-black text-emerald-700">
                      <Link href="/dashboard/reports">리포트 센터 <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                    </Button>
                  }
                />
                <div className="grid gap-3">
                  {!recentReportsFeed || recentReportsFeed.length === 0 ? (
                    <div className="rounded-[2.3rem] border-2 border-dashed border-emerald-100 bg-white/70 py-16 text-center"><p className="text-sm font-black text-[#5c6e97]">최근 발송된 리포트가 없습니다.</p></div>
                  ) : recentReportsFeed.map((report) => (
                    <button
                      key={report.id}
                      type="button"
                      onClick={() => setSelectedRecentReport(report)}
                      className="w-full text-left"
                    >
                      <Card className="group rounded-[2rem] border border-transparent bg-white/92 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md active:scale-[0.98]">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-emerald-50">
                              <span className="text-[10px] font-black leading-none text-emerald-600">{report.dateKey.split('-')[2]}</span>
                              <span className="mt-0.5 whitespace-nowrap text-[7px] font-bold text-emerald-400">{format(new Date(report.dateKey.replace(/-/g, '/')), 'M월', { locale: ko })}</span>
                            </div>
                            <div className="grid min-w-0 leading-tight">
                              <span className="truncate text-sm font-black">{report.studentName} 학생</span>
                              <p className="max-w-[180px] truncate text-[10px] font-bold text-[#5c6e97]">{report.content.substring(0, 40)}...</p>
                            </div>
                          </div>
                          <div className={cn("flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-300 shadow-sm transition-all group-hover:bg-emerald-500 group-hover:text-white", report.viewedAt ? "text-emerald-600" : "text-emerald-300")}>
                            {report.viewedAt ? <CheckCircle2 className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </div>
                        </div>
                      </Card>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.section>

      <Dialog open={isHeroPriorityDialogOpen} onOpenChange={setIsHeroPriorityDialogOpen}>
        <DialogContent className={cn("overflow-hidden border-none p-0 shadow-2xl", isMobile ? "fixed inset-0 h-full w-full max-w-none rounded-none" : "sm:max-w-2xl rounded-[2.4rem]")}>
          <div className="bg-[linear-gradient(135deg,#14295F_0%,#1E4DB7_58%,#FF8B2B_100%)] p-6 text-white sm:p-7">
            <DialogHeader className="space-y-4 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-white/14 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white">
                  오늘 우선순위
                </Badge>
                <Badge className="border border-white/14 bg-white/10 px-3 py-1 text-[10px] font-black text-white">
                  {teacherActionQueue.length}건
                </Badge>
              </div>
              <div className="space-y-1">
                <DialogTitle className="font-aggro-display text-2xl tracking-tight sm:text-[2rem]">
                  바로 확인할 항목
                </DialogTitle>
                <DialogDescription className="text-sm font-semibold leading-6 text-white/82">
                  상담, 출결, 학생 리스크, 리포트 후속 가운데 지금 먼저 볼 항목만 추렸습니다.
                </DialogDescription>
              </div>
            </DialogHeader>
          </div>

          <div className="max-h-[68vh] overflow-y-auto bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)] p-5 sm:p-6">
            {teacherActionQueue.length === 0 ? (
              <div className="rounded-[1.8rem] border border-dashed border-[#DCE7FF] bg-white px-6 py-12 text-center">
                <p className="text-base font-black text-[#14295F]">지금 바로 처리할 우선 항목이 없습니다.</p>
                <p className="mt-2 text-sm font-medium text-[#5c6e97]">현재 대시보드 흐름은 안정적입니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teacherActionQueue.map((item, index) => {
                  const QueueIcon = item.icon;
                  return (
                    <div key={item.key} className="rounded-[1.7rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_34px_-30px_rgba(20,41,95,0.18)]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={cn("h-6 rounded-full border-none px-2.5 text-[10px] font-black", item.toneClass)}>
                              {index === 0 ? '최우선' : `${index + 1}순위`}
                            </Badge>
                            <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black text-[#14295F]">
                              {item.actionLabel}
                            </Badge>
                          </div>
                          <p className="mt-3 text-base font-black text-[#14295F]">{item.title}</p>
                          <p className="mt-2 text-[12px] font-bold leading-6 text-[#5c6e97]">{item.detail}</p>
                        </div>
                        <span className={cn("inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.1rem]", item.toneClass)}>
                          <QueueIcon className="h-[18px] w-[18px]" />
                        </span>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button
                          type="button"
                          className="h-10 rounded-xl bg-[#FF7A16] px-4 text-sm font-black text-white hover:bg-[#E56D10]"
                          onClick={() => {
                            setIsHeroPriorityDialogOpen(false);
                            item.onClick();
                          }}
                        >
                          {item.actionLabel}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-[#D7E4FF] bg-white px-5 py-4 sm:px-6">
            <Button variant="ghost" onClick={() => setIsHeroPriorityDialogOpen(false)} className="w-full font-black text-[#14295F] hover:bg-[#F1F6FF]">
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isHeroRoomsDialogOpen} onOpenChange={setIsHeroRoomsDialogOpen}>
        <DialogContent className={cn("overflow-hidden border-none p-0 shadow-2xl", isMobile ? "fixed inset-0 h-full w-full max-w-none rounded-none" : "sm:max-w-3xl rounded-[2.4rem]")}>
          <div className="bg-[linear-gradient(135deg,#14295F_0%,#1E4DB7_58%,#FF8B2B_100%)] p-6 text-white sm:p-7">
            <DialogHeader className="space-y-4 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-white/14 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white">
                  실시간 교실
                </Badge>
                <Badge className="border border-white/14 bg-white/10 px-3 py-1 text-[10px] font-black text-white">
                  {roomSummaries.length}개 호실
                </Badge>
                <Badge className="border border-white/14 bg-white/10 px-3 py-1 text-[10px] font-black text-white">
                  현재 보기 {selectedRoomLabel}
                </Badge>
              </div>
              <div className="space-y-1">
                <DialogTitle className="font-aggro-display text-2xl tracking-tight sm:text-[2rem]">
                  호실별 실시간 현황
                </DialogTitle>
                <DialogDescription className="text-sm font-semibold leading-6 text-white/82">
                  원하는 호실을 바로 선택하고 실시간 교실 화면으로 이어질 수 있습니다.
                </DialogDescription>
              </div>
              <div className={cn("grid gap-3", isMobile ? "grid-cols-2" : "grid-cols-4")}>
                <div className="rounded-[1.45rem] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white">공부 중</p>
                  <p className="dashboard-number mt-2 text-[1.6rem] text-white">{stats.studying}</p>
                </div>
                <div className="rounded-[1.45rem] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white">외출/휴식</p>
                  <p className="dashboard-number mt-2 text-[1.6rem] text-white">{stats.away}</p>
                </div>
                <div className="rounded-[1.45rem] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white">전체 좌석</p>
                  <p className="dashboard-number mt-2 text-[1.6rem] text-white">{stats.total}</p>
                </div>
                <div className="rounded-[1.45rem] border border-[#FFB677]/28 bg-[#FF7A16]/18 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white">필터</p>
                  <p className="mt-2 text-sm font-black text-white">{selectedClass === 'all' ? '센터 전체' : selectedClass}</p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="max-h-[68vh] overflow-y-auto bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)] p-5 sm:p-6">
            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedRoomView('all');
                  setIsHeroRoomsDialogOpen(false);
                  scrollToSection(liveBoardSectionRef);
                }}
                className={cn(
                  "rounded-[1.7rem] border p-4 text-left shadow-[0_18px_34px_-30px_rgba(20,41,95,0.18)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5",
                  selectedRoomView === 'all'
                    ? 'border-[#FFD7BA] bg-[#FFF8F2]'
                    : 'border-[#DCE7FF] bg-white hover:border-[#FF7A16]/24'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black text-[#14295F]">
                        전체 호실
                      </Badge>
                      {selectedRoomView === 'all' ? (
                        <Badge className="h-6 rounded-full border-none bg-[#FF7A16] px-2.5 text-[10px] font-black text-white">
                          현재 선택
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-3 text-base font-black text-[#14295F]">전체 실시간 교실 보기</p>
                    <p className="mt-1 text-[12px] font-bold leading-6 text-[#5c6e97]">
                      모든 호실을 한 번에 보고 좌석 상태를 바로 확인합니다.
                    </p>
                  </div>
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.1rem] bg-[#EEF4FF] text-[#14295F]">
                    <LayoutGrid className="h-[18px] w-[18px]" />
                  </span>
                </div>
              </button>

              {roomSummaries.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => {
                    setSelectedRoomView(room.id);
                    setIsHeroRoomsDialogOpen(false);
                    scrollToSection(liveBoardSectionRef);
                  }}
                  className={cn(
                    "rounded-[1.7rem] border p-4 text-left shadow-[0_18px_34px_-30px_rgba(20,41,95,0.18)] transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5",
                    selectedRoomView === room.id
                      ? 'border-[#FFD7BA] bg-[#FFF8F2]'
                      : 'border-[#DCE7FF] bg-white hover:border-[#FF7A16]/24'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-black text-[#14295F]">{room.name}</p>
                        {selectedRoomView === room.id ? (
                          <Badge className="h-6 rounded-full border-none bg-[#FF7A16] px-2.5 text-[10px] font-black text-white">
                            현재 선택
                          </Badge>
                        ) : null}
                        {room.hasUnsavedChanges ? (
                          <Badge className="h-6 rounded-full border-none bg-amber-100 px-2.5 text-[10px] font-black text-amber-700">
                            수정 중
                          </Badge>
                        ) : null}
                      </div>
                      <div className={cn("mt-4 grid gap-2", isMobile ? "grid-cols-2" : "grid-cols-4")}>
                        <div className="rounded-[1.1rem] border border-[#DCE7FF] bg-[#F7FAFF] px-3 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">공부 중</p>
                          <p className="dashboard-number mt-2 text-[1.35rem] text-[#14295F]">{room.studying}</p>
                        </div>
                        <div className="rounded-[1.1rem] border border-[#DCE7FF] bg-[#FFF8F2] px-3 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#C95A08]">외출/휴식</p>
                          <p className="dashboard-number mt-2 text-[1.35rem] text-[#C95A08]">{room.away}</p>
                        </div>
                        <div className="rounded-[1.1rem] border border-[#DCE7FF] bg-[#F7FAFF] px-3 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">배정 좌석</p>
                          <p className="dashboard-number mt-2 text-[1.35rem] text-[#14295F]">{room.assigned}</p>
                        </div>
                        <div className="rounded-[1.1rem] border border-[#DCE7FF] bg-white px-3 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">여유 좌석</p>
                          <p className="dashboard-number mt-2 text-[1.35rem] text-[#14295F]">{room.availableSeats}</p>
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.1rem] bg-[#EEF4FF] text-[#14295F]">
                      <Armchair className="h-[18px] w-[18px]" />
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="border-t border-[#D7E4FF] bg-white px-5 py-4 sm:px-6">
            <Button variant="ghost" onClick={() => setIsHeroRoomsDialogOpen(false)} className="w-full font-black text-[#14295F] hover:bg-[#F1F6FF]">
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRecentReport} onOpenChange={(open) => !open && setSelectedRecentReport(null)}>
        <DialogContent className={cn("rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col", isMobile ? "fixed inset-0 w-full h-full max-w-none rounded-none" : "sm:max-w-2xl max-h-[90vh]")}>
          {selectedRecentReport && (
            <>
              <div className="bg-[linear-gradient(135deg,#14295F_0%,#1E4DB7_58%,#FF8B2B_100%)] p-8 text-white relative shrink-0">
                <DialogHeader className="relative z-10">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white">
                      최근 발송 리포트
                    </Badge>
                    <Badge className="border border-white/14 bg-white/8 px-3 py-1 text-[10px] font-black text-white/80">
                      학부모 발송 문장 검토
                    </Badge>
                  </div>
                  <DialogTitle className="text-2xl font-black tracking-tighter">발송 리포트 상세</DialogTitle>
                  <DialogDescription className="text-white/80 font-bold">
                    {selectedRecentReport.dateKey} · {selectedRecentReport.studentName || '학생'}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className="border-none bg-[#EEF4FF] text-[#14295F] font-black">{selectedRecentReport.dateKey}</Badge>
                  <Badge className={cn("border-none font-black", selectedRecentReport.viewedAt ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                    {selectedRecentReport.viewedAt ? '열람 완료' : '미열람'}
                  </Badge>
                </div>
                <div className="rounded-2xl border border-[#D7E4FF] bg-[#F8FBFF] p-5">
                  <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-[#14295F]">
                    {selectedRecentReport.content?.trim() || '리포트 내용이 없습니다.'}
                  </p>
                </div>
              </div>
              <DialogFooter className="p-6 bg-white border-t border-[#D7E4FF]">
                <Button variant="ghost" onClick={() => setSelectedRecentReport(null)} className="w-full font-black text-[#14295F] hover:bg-[#F1F6FF]">
                  닫기
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isManaging} onOpenChange={setIsManaging}>
        <DialogContent
          className={cn(
            "flex min-h-0 flex-col overflow-hidden border-none p-0 shadow-2xl",
            isMobile
              ? "fixed inset-0 h-full w-full max-w-none rounded-none"
              : "h-[min(960px,calc(100dvh-1rem))] w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1rem)] max-w-[1180px] rounded-[2.5rem]"
          )}
        >
          {selectedSeat && (
            <>
              {(() => {
                const studentId = selectedSeat.studentId;
                const timeInfo = studentId ? getStudentStudyTimes(studentId, selectedSeat.status, selectedSeat.lastCheckInAt) : null;
                const selectedSeatPresentation = getCenterAdminSeatOverlayPresentation({
                  signal: selectedSeatSignal,
                  mode: 'composite',
                  status: selectedSeat.status,
                });

                return (
                  <>
                    <div
                      className={cn(
                        "relative shrink-0 overflow-hidden text-white",
                        selectedSeat.status === 'studying'
                          ? "bg-[linear-gradient(135deg,#1D4ED8_0%,#14295F_100%)]"
                          : selectedSeat.status === 'away' || selectedSeat.status === 'break'
                            ? "bg-[linear-gradient(135deg,#FF8A1F_0%,#14295F_100%)]"
                            : "bg-[linear-gradient(135deg,#14295F_0%,#1E3A8A_100%)]"
                      )}
                    >
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,166,77,0.18),transparent_26%)]" />
                      <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
                      <div className={cn("relative space-y-5", isMobile ? "p-5" : "p-6 sm:p-7 lg:p-8")}>
                        <DialogHeader className="space-y-5">
                          <div className={cn("flex gap-5", isMobile ? "flex-col" : "items-start justify-between")}>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="h-6 rounded-full border border-white/10 bg-white/10 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                                  학생 운영 브리프
                                </Badge>
                                <Badge className="h-6 rounded-full border-none bg-white/16 px-3 text-[10px] font-black text-white">
                                  {selectedSeatLabel}
                                </Badge>
                                <Badge className="h-6 rounded-full border-none bg-white/16 px-3 text-[10px] font-black text-white">
                                  {formatAttendanceStatus(selectedSeat.status)}
                                </Badge>
                                {selectedSeat.seatZone && (
                                  <Badge className="h-6 rounded-full border-none bg-white px-3 text-[10px] font-black uppercase text-[#14295F]">
                                    {selectedSeat.seatZone}
                                  </Badge>
                                )}
                              </div>
                              <DialogTitle className="mt-4 text-2xl font-black tracking-tighter sm:text-3xl lg:text-[2.15rem]">
                                {studentsById.get(selectedSeat.studentId || '')?.name || '학생'}
                              </DialogTitle>
                              <DialogDescription className="mt-3 max-w-[42rem] text-sm font-bold leading-6 text-white/82">
                                {selectedSeatSignal?.topReason || selectedAttendanceSignal?.note || '오늘 가장 먼저 확인할 상태와 대응 포인트를 한 화면에서 정리했습니다.'}
                              </DialogDescription>
                            </div>

                            <div className={cn("grid gap-3", isMobile ? "grid-cols-2" : "min-w-[270px] grid-cols-2")}>
                              <div className="rounded-[1.6rem] border border-white/10 bg-white/10 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">실시간 세션</p>
                                <p className="mt-2 text-xl font-black tabular-nums text-white">{timeInfo?.session || '-'}</p>
                              </div>
                              <div className="rounded-[1.6rem] border border-white/10 bg-white/10 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">오늘 누적</p>
                                <p className="mt-2 text-xl font-black tabular-nums text-white">{timeInfo?.total || '-'}</p>
                              </div>
                            </div>
                          </div>
                        </DialogHeader>
                        {selectedSeat.studentId && (
                          <div className="grid gap-3">
                            <div className={cn("grid gap-3", isMobile ? "grid-cols-2" : "lg:grid-cols-4")}>
                              <div className="rounded-[1.55rem] border border-white/10 bg-white/10 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">오늘 판정</p>
                                <p className="mt-2 text-sm font-black text-white">{selectedAttendanceSignal?.boardLabel || '확인중'}</p>
                              </div>
                              <div className="rounded-[1.55rem] border border-white/10 bg-white/10 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">최근 7일</p>
                                <p className="mt-2 text-sm font-black text-white">{selectedAttendanceSignal?.attendanceRiskLabel || '데이터 없음'}</p>
                              </div>
                              <div className="rounded-[1.55rem] border border-white/10 bg-white/10 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">최근 리포트</p>
                                <p className="mt-2 text-sm font-black text-white">{latestSelectedReport?.dateKey || '발송 없음'}</p>
                              </div>
                              <div className="rounded-[1.55rem] border border-white/10 bg-white/10 px-4 py-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/60">현재 벌점</p>
                                <p className="mt-2 text-sm font-black text-white">{selectedPenaltyRecovery.effectivePoints}점</p>
                              </div>
                            </div>

                            <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]")}>
                              <motion.div {...getDeckMotionProps(0.03, 10)} className="rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                                <div className="flex flex-wrap items-center gap-2">
                                  {selectedSeatSignal ? (
                                    <>
                                      <Badge className={cn("border-none font-black", selectedSeatPresentation.chipClass)}>
                                        {selectedSeatSignal.primaryChip}
                                      </Badge>
                                      {selectedSeatSignal.secondaryFlags.map((flag) => (
                                        <Badge key={`${selectedSeat.id}_${flag}`} className={cn("border-none font-black", selectedSeatPresentation.flagClass)}>
                                          {flag}
                                        </Badge>
                                      ))}
                                    </>
                                  ) : (
                                    <Badge className="border-none bg-white/16 font-black text-white">운영 신호 확인중</Badge>
                                  )}
                                </div>
                                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.22em] text-white/55">오늘 개입 요약</p>
                                <p className="mt-2 text-lg font-black leading-snug text-white">
                                  {selectedSeatSignal?.topReason || selectedAttendanceSignal?.note || '지금 바로 개입이 필요한 포인트가 없습니다.'}
                                </p>
                                <p className="mt-3 text-xs font-bold leading-6 text-white/78">
                                  {selectedAttendanceSignal?.note || '출결 신호와 운영 히트맵을 함께 읽어 오늘 필요한 대응을 먼저 보여줍니다.'}
                                </p>
                              </motion.div>

                              <motion.div {...getDeckMotionProps(0.06, 10)} className="rounded-[2rem] border border-white/10 bg-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/55">선택된 AI 해석</p>
                                {selectedSeatDomainInsight ? (
                                  <>
                                    <div className="mt-3 flex items-center justify-between gap-3">
                                      <p className="text-base font-black text-white">
                                        {selectedSeatDomainInsight.label} {selectedSeatDomainInsight.score}점
                                      </p>
                                      <Badge className={cn("border-none font-black", selectedSeatDomainInsight.badgeClass)}>
                                        {selectedSeatDomainInsight.score}
                                      </Badge>
                                    </div>
                                    <p className="mt-3 text-sm font-bold leading-relaxed text-white/88">
                                      {selectedSeatDomainInsight.analysis}
                                    </p>
                                    <p className="mt-3 text-xs font-bold leading-relaxed text-white/72">
                                      대응: {selectedSeatDomainInsight.action}
                                    </p>
                                  </>
                                ) : (
                                  <p className="mt-3 text-sm font-bold leading-relaxed text-white/78">
                                    도메인 점수를 선택하면 왜 이 점수가 나왔는지와 바로 할 대응을 짧게 보여줍니다.
                                  </p>
                                )}
                              </motion.div>
                            </div>

                            {selectedSeatSignal && (
                              <div className="rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[11px] font-bold text-white/74">
                                    점수를 누르면 개입 이유와 다음 대응이 바로 바뀝니다.
                                  </p>
                                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">
                                    도메인 선택
                                  </p>
                                </div>
                                <div className={cn("mt-3 grid gap-2", isMobile ? "grid-cols-2" : "sm:grid-cols-5")}>
                                  {selectedSeatDomainSummary.map((domain) => {
                                    const isActive = domain.key === selectedSeatInsightKey;
                                    return (
                                      <button
                                        key={domain.key}
                                        type="button"
                                        onClick={() => setSelectedSeatInsightKey(domain.key)}
                                        className={cn(
                                          "rounded-[1.35rem] border px-3 py-3 text-center transition-all",
                                          isActive
                                            ? "border-white bg-white/22 shadow-lg shadow-black/10"
                                            : "border-white/10 bg-white/8 hover:bg-white/14"
                                        )}
                                      >
                                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">{domain.label}</p>
                                        <Badge className={cn("mt-2 border-none font-black", domain.badgeClass)}>
                                          {domain.score}
                                        </Badge>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col bg-[#F7F9FC]">
                      <div className={cn("grid min-h-0 flex-1", isMobile ? "grid-cols-1" : "lg:grid-cols-[340px_minmax(0,1fr)]")}>
                        <div className="border-b border-[#DDE7FF] bg-white/82 backdrop-blur-sm lg:border-b-0 lg:border-r">
                          <div className={cn("space-y-4", isMobile ? "p-4" : "p-5 sm:p-6")}>
                            <motion.div {...getDeckMotionProps(0.08, 10)} className="rounded-[2rem] border border-[#D7E4FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] p-5 shadow-sm">
                              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5c6e97]">First Check</p>
                              <h4 className="mt-3 text-lg font-black tracking-tight text-[#14295F]">오늘 먼저 볼 개입 포인트</h4>
                              <p className="mt-2 text-sm font-bold leading-6 text-[#5c6e97]">
                                {selectedSeatSignal?.topReason || selectedAttendanceSignal?.note || '지금 바로 개입이 필요한 포인트가 없습니다.'}
                              </p>
                              {selectedSeatDomainInsight && (
                                <div className="mt-4 rounded-[1.5rem] border border-[#D7E4FF] bg-[#F8FBFF] p-4">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-black text-[#14295F]">{selectedSeatDomainInsight.label}</p>
                                    <Badge className={cn("border-none font-black", selectedSeatDomainInsight.badgeClass)}>
                                      {selectedSeatDomainInsight.score}
                                    </Badge>
                                  </div>
                                  <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                                    대응: {selectedSeatDomainInsight.action}
                                  </p>
                                </div>
                              )}
                            </motion.div>

                            <motion.div {...getDeckMotionProps(0.12, 10)} className="rounded-[2rem] border border-[#D7E4FF] bg-white p-5 shadow-sm">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/48">Quick Action</p>
                                  <h4 className="mt-2 text-lg font-black tracking-tight text-[#14295F]">
                                    {isEditMode ? '좌석 관리 액션' : '지금 바로 실행'}
                                  </h4>
                                </div>
                                {isEditMode ? (
                                  <Badge className="h-7 rounded-full border-none bg-[#FFF2E8] px-3 text-[10px] font-black text-[#C95A08]">편집 모드</Badge>
                                ) : (
                                  <Badge className="h-7 rounded-full border-none bg-[#EEF4FF] px-3 text-[10px] font-black text-[#2554D7]">실시간 조치</Badge>
                                )}
                              </div>

                              {isEditMode ? (
                                <div className="mt-4 space-y-3">
                                  <div className="space-y-2">
                                    <Label className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500"><MapPin className="h-3 w-3" /> 좌석 구역 설정</Label>
                                    <Select value={selectedSeat.seatZone || '미정'} onValueChange={handleUpdateZone}>
                                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold shadow-sm">
                                        <SelectValue placeholder="구역 선택" />
                                      </SelectTrigger>
                                      <SelectContent className="rounded-xl border-none shadow-2xl">
                                        <SelectItem value="미정" className="font-bold">미정</SelectItem>
                                        <SelectItem value="A존 (집중)" className="font-bold">A존 (집중)</SelectItem>
                                        <SelectItem value="B존 (표준)" className="font-bold">B존 (표준)</SelectItem>
                                        <SelectItem value="고정석" className="font-bold">고정석</SelectItem>
                                        <SelectItem value="자유석" className="font-bold">자유석</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <Button variant="destructive" onClick={unassignStudentFromSeat} disabled={isSaving} className="h-12 w-full rounded-xl font-black shadow-lg shadow-rose-100">
                                    좌석 배정 해제
                                  </Button>
                                  <Button variant="outline" onClick={handleToggleCellType} disabled={isSaving} className="h-11 w-full rounded-xl border-2 font-black gap-2">
                                    <ArrowRightLeft className="h-4 w-4" />
                                    통로로 전환하기
                                  </Button>
                                </div>
                              ) : (
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                  <Button onClick={() => handleStatusUpdate('studying')} disabled={isSaving} className="h-20 rounded-[1.6rem] bg-blue-600 font-black text-white shadow-lg shadow-blue-200 hover:bg-blue-700">
                                    <div className="flex flex-col items-center gap-1">
                                      <Zap className="h-5 w-5 fill-current" />
                                      <span className="text-sm leading-none">입실 확인</span>
                                    </div>
                                  </Button>
                                  <Button variant="outline" onClick={() => handleStatusUpdate('absent')} disabled={isSaving} className="h-20 rounded-[1.6rem] border-2 border-rose-100 font-black text-rose-600 hover:bg-rose-50">
                                    <div className="flex flex-col items-center gap-1">
                                      <AlertCircle className="h-5 w-5" />
                                      <span className="text-sm leading-none">퇴실 처리</span>
                                    </div>
                                  </Button>
                                </div>
                              )}
                            </motion.div>

                            <motion.div {...getDeckMotionProps(0.16, 10)} className="rounded-[2rem] border border-[#D7E4FF] bg-white p-5 shadow-sm">
                              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/48">Operator Memo</p>
                              <div className="mt-4 space-y-3">
                                <div className="rounded-[1.35rem] bg-[#F7FAFF] px-4 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">최근 학습 기록</p>
                                  <p className="mt-1 text-sm font-black text-[#14295F]">
                                    {selectedStudentHistoryMetrics.latestDateKey ? `${selectedStudentHistoryMetrics.latestDateKey} · ${formatDurationMinutes(selectedStudentHistoryMetrics.latestMinutes)}` : '기록 없음'}
                                  </p>
                                </div>
                                <div className="rounded-[1.35rem] bg-[#FFF7F7] px-4 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-500">최근 벌점</p>
                                  <p className="mt-1 text-sm font-black text-slate-700">
                                    {latestSelectedPenaltyLog?.reason || '최근 벌점 기록 없음'}
                                  </p>
                                </div>
                                <div className="rounded-[1.35rem] bg-[#FFF9F0] px-4 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-600">최근 리포트</p>
                                  <p className="mt-1 text-sm font-black text-slate-700">
                                    {latestSelectedReport?.dateKey || '발송 이력 없음'}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          </div>
                        </div>

                        <div className="min-h-0 flex flex-col">
                          <Tabs defaultValue="status" className="flex h-full min-h-0 w-full flex-col">
                            <div className={cn("px-4 pt-4", isMobile ? "" : "sm:px-6 sm:pt-6")}>
                              <TabsList className="grid h-auto w-full grid-cols-4 rounded-[1.35rem] bg-[#EEF4FF] p-1">
                                <TabsTrigger value="status" className="rounded-[1rem] px-2 py-3 font-black text-[11px] tracking-tight text-slate-500 data-[state=active]:bg-white data-[state=active]:text-[#14295F] data-[state=active]:shadow-sm">실시간 상태</TabsTrigger>
                                <TabsTrigger value="history" className="rounded-[1rem] px-2 py-3 font-black text-[11px] tracking-tight text-slate-500 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">학습 히스토리</TabsTrigger>
                                <TabsTrigger value="penalty" className="rounded-[1rem] px-2 py-3 font-black text-[11px] tracking-tight text-slate-500 data-[state=active]:bg-white data-[state=active]:text-rose-700 data-[state=active]:shadow-sm">벌점 관리</TabsTrigger>
                                <TabsTrigger value="reports" className="rounded-[1rem] px-2 py-3 font-black text-[11px] tracking-tight text-slate-500 data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm">리포트 내역</TabsTrigger>
                              </TabsList>
                            </div>

                            <div className="min-h-0 flex-1 overflow-hidden">
                          <TabsContent value="status" className="mt-0 h-full overflow-y-auto custom-scrollbar p-6 pb-28 sm:p-8 sm:pb-32 space-y-6">
                            <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-2 xl:grid-cols-4")}>
                              <div className="rounded-[1.85rem] border border-[#D7E4FF] bg-white p-5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/48">오늘 판정</p>
                                <p className="mt-3 text-lg font-black text-[#14295F]">{selectedAttendanceSignal?.boardLabel || '확인중'}</p>
                                <p className="mt-2 text-xs font-bold text-slate-500">{selectedAttendanceSignal?.note || '현재 상태를 기준으로 운영 신호를 표시합니다.'}</p>
                              </div>
                              <div className="rounded-[1.85rem] border border-[#D7E4FF] bg-white p-5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/48">루틴 예정</p>
                                <p className="mt-3 text-lg font-black text-[#14295F]">{selectedAttendanceSignal?.routineExpectedArrivalTime || '미설정'}</p>
                                <p className="mt-2 text-xs font-bold text-slate-500">도착 루틴과 실제 출결 흐름을 함께 확인합니다.</p>
                              </div>
                              <div className="rounded-[1.85rem] border border-[#D7E4FF] bg-white p-5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/48">오늘 공부</p>
                                <p className="mt-3 text-lg font-black text-[#14295F]">{selectedAttendanceSignal?.todayStudyLabel || timeInfo?.total || '-'}</p>
                                <p className="mt-2 text-xs font-bold text-slate-500">실시간 세션과 누적 시간을 같이 읽습니다.</p>
                              </div>
                              <div className="rounded-[1.85rem] border border-[#D7E4FF] bg-white p-5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/48">복귀/퇴실</p>
                                <p className="mt-3 text-lg font-black text-[#14295F]">
                                  {selectedAttendanceSignal?.isReturned
                                    ? '복귀'
                                    : selectedAttendanceSignal?.isCheckedOut
                                      ? '퇴실'
                                      : selectedAttendanceSignal?.seatStatus === 'away' || selectedAttendanceSignal?.seatStatus === 'break'
                                        ? '외출 중'
                                        : '진행 중'}
                                </p>
                                <p className="mt-2 text-xs font-bold text-slate-500">{isEditMode ? '좌측 관리 패널에서 수정할 수 있습니다.' : '빠른 조치는 좌측 즉시 액션에서 처리합니다.'}</p>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="flex items-center justify-between px-1">
                                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary/60"><History className="h-3 w-3" /> 오늘의 몰입 세션</h4>
                                <span className="text-[9px] font-bold uppercase text-muted-foreground">{todayKey}</span>
                              </div>
                              <div className="grid gap-3">
                                {sessionsLoading ? (
                                  <div className="py-10 flex justify-center"><Loader2 className="animate-spin h-6 w-6 text-primary opacity-20" /></div>
                                ) : (
                                  <>
                                    {selectedSeat.status === 'studying' && selectedSeat.lastCheckInAt && (
                                      <div className="flex items-center justify-between rounded-[1.8rem] border border-blue-700 bg-blue-600 p-4 text-white shadow-lg">
                                        <div className="flex items-center gap-3">
                                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20"><Zap className="h-4 w-4 fill-current text-white" /></div>
                                          <div className="grid leading-tight">
                                            <span className="text-xs font-black">{format(selectedSeat.lastCheckInAt.toDate(), 'HH:mm:ss')} ~ 진행 중</span>
                                            <span className="text-[8px] font-bold uppercase text-white/60">활성 세션</span>
                                          </div>
                                        </div>
                                        <Badge className="h-6 border-none bg-white/20 px-2.5 text-[10px] font-black text-white">
                                          {timeInfo?.session}
                                        </Badge>
                                      </div>
                                    )}

                                    {selectedStudentSessions.length === 0 && selectedSeat.status !== 'studying' ? (
                                      <div className="rounded-[1.8rem] border-2 border-dashed border-[#D7E4FF] py-10 text-center text-[10px] font-bold italic text-muted-foreground">
                                        기록된 세션이 없습니다.
                                      </div>
                                    ) : (
                                      selectedStudentSessions.map((session) => (
                                        <div key={session.id} className="flex items-center justify-between rounded-[1.65rem] border border-[#D7E4FF] bg-white p-4 shadow-sm">
                                          <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/5"><Timer className="h-4 w-4 text-primary/40" /></div>
                                            <div className="grid leading-tight">
                                              <span className="text-xs font-black">{format(session.startTime.toDate(), 'HH:mm')} ~ {format(session.endTime.toDate(), 'HH:mm')}</span>
                                              <span className="text-[8px] font-bold uppercase text-muted-foreground">기록됨</span>
                                            </div>
                                          </div>
                                          <Badge className="h-6 border-none bg-emerald-50 px-2.5 text-[10px] font-black text-emerald-600">{session.durationMinutes}분</Badge>
                                        </div>
                                      ))
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </TabsContent>

                          <TabsContent value="history" className="mt-0 h-full overflow-y-auto custom-scrollbar p-6 pb-28 sm:p-8 sm:pb-32 space-y-6">
                            <div className="flex items-center gap-2 px-1">
                              <TrendingUp className="h-4 w-4 text-emerald-600" />
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600">최근 학습 시간 변화</h4>
                            </div>

                            <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-3")}>
                              <div className="rounded-[1.9rem] border border-emerald-100 bg-white p-5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">최근 평균</p>
                                <p className="dashboard-number mt-3 text-2xl text-emerald-600">{formatDurationMinutes(selectedStudentHistoryMetrics.averageMinutes)}</p>
                              </div>
                              <div className="rounded-[1.9rem] border border-emerald-100 bg-white p-5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">최고 기록</p>
                                <p className="dashboard-number mt-3 text-2xl text-[#14295F]">{formatDurationMinutes(selectedStudentHistoryMetrics.peakMinutes)}</p>
                              </div>
                              <div className="rounded-[1.9rem] border border-emerald-100 bg-white p-5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">가장 최근</p>
                                <p className="dashboard-number mt-3 text-2xl text-[#14295F]">{formatDurationMinutes(selectedStudentHistoryMetrics.latestMinutes)}</p>
                                <p className="mt-2 text-xs font-bold text-slate-500">{selectedStudentHistoryMetrics.latestDateKey || '기록 없음'}</p>
                              </div>
                            </div>

                            <div className="grid gap-3">
                              {sessionsLoading ? (
                                <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
                              ) : selectedStudentHistory.length === 0 ? (
                                <div className="rounded-[2rem] border-2 border-dashed border-emerald-100 py-20 text-center text-sm font-black italic text-slate-400">학습 기록이 없습니다.</div>
                              ) : (
                                selectedStudentHistory.map((hLog) => (
                                  <div key={hLog.dateKey} className="flex items-center justify-between rounded-[1.8rem] border border-emerald-100 bg-white p-4 shadow-sm transition-all hover:border-emerald-200">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-xs font-black text-primary">{format(new Date(hLog.dateKey.replace(/-/g, '/')), 'MM/dd (EEE)', {locale: ko})}</span>
                                      <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">일일 기록</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted shadow-inner">
                                        <div className="h-full rounded-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(100, (hLog.totalMinutes / 480) * 100)}%` }} />
                                      </div>
                                      <div className="min-w-[70px] text-right">
                                        <span className="dashboard-number text-sm text-slate-900">{Math.floor(hLog.totalMinutes / 60)}시간 {hLog.totalMinutes % 60}분</span>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </TabsContent>

                          <TabsContent value="penalty" className="mt-0 h-full overflow-y-auto custom-scrollbar p-6 pb-28 sm:p-8 sm:pb-32 space-y-6">
                            <div className="flex items-center justify-between gap-2 px-1">
                              <div className="flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4 text-rose-600" />
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-600">벌점 현황</h4>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-xl px-3 text-[10px] font-black text-rose-600 hover:bg-rose-50"
                                onClick={() => setIsPenaltyGuideOpen(true)}
                              >
                                규칙 보기
                              </Button>
                            </div>

                            <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-3")}>
                              <div className="rounded-[1.9rem] border border-rose-100 bg-white p-5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">현재 누적</p>
                                <p className="dashboard-number mt-3 text-3xl text-rose-600">{selectedPenaltyRecovery.effectivePoints}점</p>
                                <p className="mt-2 text-xs font-bold text-slate-500">학생: {selectedStudentName}</p>
                              </div>
                              <div className="rounded-[1.9rem] border border-rose-100 bg-white p-5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">자동 회복</p>
                                <p className="dashboard-number mt-3 text-3xl text-emerald-600">{selectedPenaltyRecovery.recoveredPoints}점</p>
                                <p className="mt-2 text-xs font-bold text-slate-500">원점수 {selectedPenaltyRecovery.basePoints}점</p>
                              </div>
                              <div className="rounded-[1.9rem] border border-rose-100 bg-white p-5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">최근 반영일</p>
                                <p className="mt-3 text-base font-black text-[#14295F]">{selectedPenaltyRecovery.latestPositiveLabel}</p>
                                <p className="mt-2 text-xs font-bold text-slate-500">신규 벌점 없이 7일이 지나면 1점씩 회복됩니다.</p>
                              </div>
                            </div>

                            {canAdjustPenalty && (
                              <div className="rounded-[2rem] border border-rose-100 bg-white p-5 shadow-sm">
                                <div className="grid gap-3 rounded-[1.5rem] border border-rose-100 bg-rose-50/50 p-4">
                                  <div className="grid gap-1">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600">벌점 부여 사유</Label>
                                    <Textarea
                                      value={manualPenaltyReason}
                                      onChange={(event) => setManualPenaltyReason(event.target.value)}
                                      placeholder="벌점 부여 사유를 입력해 주세요."
                                      className="min-h-[88px] resize-none rounded-xl border-2 font-bold"
                                    />
                                  </div>
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr]">
                                    <Input
                                      type="number"
                                      min={1}
                                      step={1}
                                      value={manualPenaltyPoints}
                                      onChange={(event) => setManualPenaltyPoints(event.target.value)}
                                      className="h-11 rounded-xl border-2 text-center font-black"
                                    />
                                    <Button
                                      onClick={handleAddPenalty}
                                      disabled={isPenaltySaving}
                                      className="h-11 rounded-xl bg-rose-600 font-black hover:bg-rose-700"
                                    >
                                      {isPenaltySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : '벌점 부여'}
                                    </Button>
                                  </div>
                                  {canResetPenalty && (
                                    <Button
                                      variant="outline"
                                      onClick={handleResetPenalty}
                                      disabled={isPenaltySaving}
                                      className="h-11 rounded-xl border-2 border-rose-200 font-black text-rose-700 hover:bg-rose-50 gap-2"
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                      벌점 초기화
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="space-y-2">
                              <div className="flex items-center gap-2 px-1">
                                <History className="h-4 w-4 text-rose-500" />
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-600">벌점 기록</h4>
                              </div>
                              {sessionsLoading ? (
                                <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
                              ) : selectedStudentPenaltyLogs.length === 0 ? (
                                <div className="rounded-[2rem] border-2 border-dashed border-rose-100 py-20 text-center text-sm font-black italic text-slate-400">벌점 기록이 없습니다.</div>
                              ) : (
                                <div className="grid gap-3">
                                  {selectedStudentPenaltyLogs.map((log) => {
                                    const rawPoints = Number(log.pointsDelta || 0);
                                    const createdAtDate = (log.createdAt as any)?.toDate?.();
                                    const createdAtLabel = createdAtDate ? format(createdAtDate, 'MM/dd HH:mm') : '-';
                                    const sourceLabel =
                                      log.source === 'reset'
                                        ? '초기화'
                                        : log.source === 'manual'
                                          ? '수동 부여'
                                          : log.source === 'routine_missing'
                                            ? '루틴 미작성'
                                          : '지각/결석 신청';
                                    return (
                                      <div key={log.id} className="flex items-start justify-between gap-3 rounded-[1.8rem] border border-rose-100 bg-white p-4 shadow-sm">
                                        <div className="grid min-w-0 gap-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <Badge className="h-5 border-none bg-rose-50 px-2 text-[10px] font-black text-rose-700">{sourceLabel}</Badge>
                                            <span className="text-[10px] font-bold text-muted-foreground">{createdAtLabel}</span>
                                          </div>
                                          <p className="break-keep text-sm font-bold text-foreground/80">{log.reason || '사유 없음'}</p>
                                        </div>
                                        <Badge className={cn("h-6 border-none px-2.5 text-xs font-black", rawPoints >= 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700")}>
                                          {rawPoints >= 0 ? `+${rawPoints}` : rawPoints}점
                                        </Badge>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </TabsContent>

                          <TabsContent value="reports" className="mt-0 h-full min-h-0 overflow-y-auto custom-scrollbar p-6 pb-36 sm:p-8 sm:pb-40 space-y-6">
                            <div className="flex items-center gap-2 px-1">
                              <FileText className="h-4 w-4 text-amber-600" />
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600">최근 발송된 리포트 (5건)</h4>
                            </div>

                            <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-2")}>
                              <div className="rounded-[1.9rem] border border-amber-100 bg-white p-5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">최근 발송</p>
                                <p className="mt-3 text-base font-black text-[#14295F]">{latestSelectedReport?.dateKey || '발송 없음'}</p>
                                <p className="mt-2 text-xs font-bold text-slate-500">{latestSelectedReport ? '가장 최근 리포트 날짜입니다.' : '아직 발송된 리포트가 없습니다.'}</p>
                              </div>
                              <div className="rounded-[1.9rem] border border-amber-100 bg-white p-5 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">열람 상태</p>
                                <p className="mt-3 text-base font-black text-[#14295F]">
                                  {selectedStudentReports.filter((report) => Boolean(report.viewedAt)).length} / {selectedStudentReports.length}
                                </p>
                                <p className="mt-2 text-xs font-bold text-slate-500">발송된 리포트 중 열람 완료 수입니다.</p>
                              </div>
                            </div>

                            <div className="grid gap-3">
                              {sessionsLoading ? (
                                <div className="py-20 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>
                              ) : selectedStudentReports.length === 0 ? (
                                <div className="rounded-[2rem] border-2 border-dashed border-amber-100 py-20 text-center text-sm font-black italic text-slate-400">발송된 리포트가 없습니다.</div>
                              ) : (
                                selectedStudentReports.map((report) => (
                                  <button
                                    key={report.id}
                                    type="button"
                                    onClick={() => setSelectedReportPreview(report)}
                                    className="w-full text-left"
                                  >
                                    <div className="rounded-[1.85rem] border border-amber-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-600">{report.dateKey}</span>
                                            {report.viewedAt ? (
                                              <Badge className="h-5 border-none bg-emerald-50 px-2 text-[10px] font-black text-emerald-700">열람함</Badge>
                                            ) : (
                                              <Badge className="h-5 border-none bg-amber-50 px-2 text-[10px] font-black text-amber-700">미열람</Badge>
                                            )}
                                          </div>
                                          <p className="mt-3 line-clamp-2 text-sm font-bold leading-6 text-slate-700">{report.content.substring(0, 100)}...</p>
                                        </div>
                                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 opacity-25" />
                                      </div>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>

                            <div className="border-t border-dashed pt-3">
                              <Button
                                variant="secondary"
                                className="h-16 w-full rounded-[1.7rem] border border-primary/5 bg-primary/5 font-black text-primary transition-all hover:bg-primary/10"
                                asChild
                              >
                                <Link href={`/dashboard/teacher/students/${selectedSeat.studentId}`}>
                                  <User className="h-5 w-5 opacity-40" />
                                  학생 정밀 리포트 & 과거 상세 분석
                                  <ChevronRight className="ml-auto h-5 w-5 opacity-20" />
                                </Link>
                              </Button>
                            </div>
                          </TabsContent>
                        </div>
                      </Tabs>
                    </div>
                  </div>

                      <Dialog open={isPenaltyGuideOpen} onOpenChange={setIsPenaltyGuideOpen}>
                        <DialogContent
                          className={cn(
                            "overflow-hidden border-none p-0 shadow-2xl",
                            isMobile
                              ? "fixed left-1/2 top-1/2 w-[95vw] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[2rem]"
                              : "sm:max-w-xl rounded-[2.2rem]",
                          )}
                        >
                          <motion.div
                            {...getDeckMotionProps(0.02, 14)}
                            className="overflow-hidden rounded-[inherit] bg-[#F7F9FC]"
                          >
                            <div className="border-b border-white/15 bg-[linear-gradient(135deg,#7F1D1D_0%,#BE123C_55%,#FB7185_100%)] p-6 text-white sm:p-7">
                              <DialogHeader className="space-y-4">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className="border-white/15 bg-white/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-white">
                                    Penalty Guide
                                  </Badge>
                                  <Badge className="border-white/15 bg-white/12 px-3 py-1 text-[10px] font-bold text-white/90">
                                    누적 {selectedPenaltyRecovery.effectivePoints}점 적용 중
                                  </Badge>
                                </div>
                                <div className="space-y-1">
                                  <DialogTitle className="font-aggro-display text-2xl tracking-tight sm:text-[1.9rem]">
                                    벌점 운영 규칙
                                  </DialogTitle>
                                  <DialogDescription className="text-sm font-semibold leading-relaxed text-white/80">
                                    현재 학생에게 적용되는 벌점 기준과 자동 회복 흐름을 한 번에 확인할 수 있도록 정리했습니다.
                                  </DialogDescription>
                                </div>
                              </DialogHeader>
                            </div>

                            <div className="space-y-4 p-5 sm:p-6">
                              <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-[1.6rem] border border-rose-100 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-500">원점수</p>
                                  <p className="mt-2 dashboard-number text-3xl font-black text-slate-900">
                                    {selectedPenaltyRecovery.basePoints}
                                    <span className="ml-1 text-lg">점</span>
                                  </p>
                                  <p className="mt-1 text-xs font-semibold text-slate-500">수동 부여와 규칙 반영 전 기준 점수</p>
                                </div>
                                <div className="rounded-[1.6rem] border border-emerald-100 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">자동 회복</p>
                                  <p className="mt-2 dashboard-number text-3xl font-black text-slate-900">
                                    {selectedPenaltyRecovery.recoveredPoints}
                                    <span className="ml-1 text-lg">점</span>
                                  </p>
                                  <p className="mt-1 text-xs font-semibold text-slate-500">신규 벌점 없이 유지된 기간만큼 차감</p>
                                </div>
                                <div className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">최근 반영</p>
                                  <p className="mt-2 text-lg font-black text-slate-900">{selectedPenaltyRecovery.latestPositiveLabel}</p>
                                  <p className="mt-1 text-xs font-semibold text-slate-500">가장 최근에 벌점이 올라간 날짜</p>
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-[1.05fr_0.95fr]">
                                <div className="rounded-[1.8rem] border border-rose-100 bg-white p-5 shadow-[0_22px_48px_rgba(15,23,42,0.06)]">
                                  <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-rose-500">부여 기준</p>
                                      <p className="mt-1 text-base font-black text-slate-900">상황별 반영 점수</p>
                                    </div>
                                    <Badge className="border-rose-200 bg-rose-50 px-3 py-1 text-[10px] font-bold text-rose-700">
                                      운영 기준
                                    </Badge>
                                  </div>
                                  <div className="space-y-2">
                                    {[
                                      { label: '지각 출석', value: '+1점' },
                                      { label: '결석', value: '+2점' },
                                      { label: '루틴 미작성', value: `+${ROUTINE_MISSING_PENALTY_POINTS}점` },
                                      { label: '센터 수동 부여', value: '입력 점수 반영' },
                                    ].map((rule) => (
                                      <div
                                        key={rule.label}
                                        className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3"
                                      >
                                        <span className="text-sm font-semibold text-slate-700">{rule.label}</span>
                                        <span className="text-sm font-black text-slate-950">{rule.value}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-3">
                                  <div className="rounded-[1.8rem] border border-amber-100 bg-white p-5 shadow-[0_22px_48px_rgba(15,23,42,0.06)]">
                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-600">상담 단계</p>
                                    <div className="mt-4 space-y-2">
                                      {[
                                        { label: '7점 이상', value: '선생님 상담' },
                                        { label: '12점 이상', value: '학부모 상담' },
                                        { label: '20점 이상', value: '퇴원 검토' },
                                      ].map((step) => (
                                        <div
                                          key={step.label}
                                          className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3"
                                        >
                                          <p className="text-xs font-black text-amber-700">{step.label}</p>
                                          <p className="mt-1 text-sm font-semibold text-slate-700">{step.value}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="rounded-[1.8rem] border border-emerald-100 bg-[#F3FBF8] p-5 shadow-[0_22px_48px_rgba(15,23,42,0.06)]">
                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600">회복 규칙</p>
                                    <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-700">
                                      신규 벌점 없이 7일이 지나면 1점이 자동 회복됩니다.
                                    </p>
                                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-700">
                                      적용 점수는 <span className="font-black text-slate-950">{selectedPenaltyRecovery.effectivePoints}점</span>이며,
                                      원점수 {selectedPenaltyRecovery.basePoints}점에서 회복 {selectedPenaltyRecovery.recoveredPoints}점을 제외한 값입니다.
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <DialogFooter className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
                              <Button
                                className="h-12 w-full rounded-[1.1rem] bg-[#14295F] font-black text-white shadow-[0_14px_32px_rgba(20,41,95,0.24)] hover:bg-[#10224f]"
                                onClick={() => setIsPenaltyGuideOpen(false)}
                              >
                                확인
                              </Button>
                            </DialogFooter>
                          </motion.div>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={!!selectedReportPreview} onOpenChange={(open) => !open && setSelectedReportPreview(null)}>
                        <DialogContent className={cn("overflow-hidden border-none p-0 shadow-2xl", isMobile ? "fixed inset-0 h-full w-full max-w-none rounded-none" : "max-h-[90vh] rounded-[2.5rem] sm:max-w-2xl")}>
                          {selectedReportPreview && (
                            <motion.div
                              {...getDeckMotionProps(0.04, 16)}
                              className="flex h-full flex-col overflow-hidden bg-[#F7F9FC]"
                            >
                              <div className="shrink-0 border-b border-white/10 bg-[linear-gradient(135deg,#14295F_0%,#2246A0_58%,#FF8B2B_100%)] px-6 py-7 text-white sm:px-8 sm:py-8">
                                <DialogHeader className="space-y-5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge className="border-white/15 bg-white/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-white">
                                      Report Review
                                    </Badge>
                                    <Badge className="border-white/15 bg-white/12 px-3 py-1 text-[10px] font-bold text-white/90">
                                      {selectedReportPreview.dateKey}
                                    </Badge>
                                    <Badge className="border-white/15 bg-white/12 px-3 py-1 text-[10px] font-bold text-white/90">
                                      {selectedStudentName}
                                    </Badge>
                                  </div>
                                  <div className="space-y-2">
                                    <DialogTitle className="font-aggro-display text-2xl tracking-tight sm:text-[2rem]">
                                      발송 리포트 상세
                                    </DialogTitle>
                                    <DialogDescription className="max-w-2xl text-sm font-semibold leading-relaxed text-white/82">
                                      학부모에게 전달된 문장을 그대로 검토하고, 열람 여부와 발송 기준일을 빠르게 확인할 수 있는 상세 화면입니다.
                                    </DialogDescription>
                                  </div>
                                </DialogHeader>
                              </div>

                              <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
                                <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                                  <div className="space-y-4">
                                    <div className="rounded-[1.9rem] border border-slate-200 bg-white p-5 shadow-[0_22px_48px_rgba(15,23,42,0.08)]">
                                      <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#FF7A16]">Delivery Brief</p>
                                      <div className="mt-4 space-y-3">
                                        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                                          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">기준일</p>
                                          <p className="mt-1 text-sm font-bold text-slate-900">{selectedReportPreview.dateKey}</p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                                          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">열람 상태</p>
                                          <p className="mt-1 text-sm font-bold text-slate-900">
                                            {selectedReportPreview.viewedAt ? '열람 완료' : '미열람'}
                                          </p>
                                          <p className="mt-1 text-xs font-medium text-slate-500">
                                            {selectedReportPreview.viewedAt
                                              ? (() => {
                                                  const viewedAtDate = toDateSafeAttendance(selectedReportPreview.viewedAt as any);
                                                  return viewedAtDate
                                                    ? format(viewedAtDate, 'MM/dd HH:mm')
                                                    : '열람 기록 확인 필요';
                                                })()
                                              : '아직 확인 기록이 없습니다.'}
                                          </p>
                                        </div>
                                        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                                          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">학생</p>
                                          <p className="mt-1 text-sm font-bold text-slate-900">{selectedStudentName}</p>
                                          <p className="mt-1 text-xs font-medium text-slate-500">최근 상담이나 발송 흐름과 함께 검토해 보세요.</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-4">
                                    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_22px_48px_rgba(15,23,42,0.08)] sm:p-6">
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#14295F]">Report Body</p>
                                          <p className="mt-1 text-base font-black text-slate-900">학부모 발송 본문</p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Badge className="border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold text-amber-700">
                                            {selectedReportPreview.dateKey}
                                          </Badge>
                                          <Badge
                                            className={cn(
                                              "px-3 py-1 text-[10px] font-bold",
                                              selectedReportPreview.viewedAt
                                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                : "border-slate-200 bg-slate-100 text-slate-600",
                                            )}
                                          >
                                            {selectedReportPreview.viewedAt ? '열람 완료' : '미열람'}
                                          </Badge>
                                        </div>
                                      </div>
                                      <div className="mt-5 rounded-[1.6rem] border border-amber-100 bg-[#FFF8F0] p-5 sm:p-6">
                                        <p className="whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-800">
                                          {selectedReportPreview.content?.trim() || '리포트 내용이 없습니다.'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <DialogFooter className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
                                <Button
                                  variant="ghost"
                                  onClick={() => setSelectedReportPreview(null)}
                                  className="h-12 w-full rounded-[1.1rem] font-black text-slate-600 hover:bg-slate-100"
                                >
                                  닫기
                                </Button>
                              </DialogFooter>
                            </motion.div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </>
                );
              })()}
              <DialogFooter className={cn("bg-white border-t shrink-0 flex justify-center", isMobile ? "p-4" : "p-6")}>
                <Button variant="ghost" onClick={() => setIsManaging(false)} className="w-full font-bold text-[#14295F] hover:bg-[#F1F6FF]">닫기</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAssigning} onOpenChange={setIsAssigning}>
        <DialogContent
          className={cn(
            "flex flex-col overflow-hidden border-none p-0 shadow-2xl",
            isMobile ? "fixed inset-0 h-full w-full max-w-none rounded-none" : "sm:max-w-4xl rounded-[3rem]",
          )}
        >
          <motion.div className="flex h-full flex-col overflow-hidden bg-[#F7F9FC]" {...getDeckMotionProps(0.02, 14)}>
            <div className="relative shrink-0 overflow-hidden bg-[linear-gradient(135deg,#14295F_0%,#2046AB_58%,#3769D8_100%)] px-6 py-7 text-white sm:px-8 sm:py-8">
              <div className="absolute right-0 top-0 p-8 opacity-10 sm:p-10">
                {selectedSeat?.type === 'aisle' ? <MapIcon className="h-24 w-24 rotate-6" /> : <UserPlus className="h-24 w-24 rotate-6" />}
              </div>
              <DialogHeader className="relative z-10 space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-white/15 bg-white/12 px-3 py-1 text-[10px] font-black uppercase tracking-[0.26em] text-white">
                    Seat Brief
                  </Badge>
                  <Badge className="border-white/15 bg-white/12 px-3 py-1 text-[10px] font-bold text-white">
                    {selectedSeatLabel}
                  </Badge>
                  <Badge className="border-white/15 bg-white/12 px-3 py-1 text-[10px] font-bold text-white">
                    {selectedSeatModeLabel}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <DialogTitle className="flex items-center gap-3 font-aggro-display text-2xl tracking-tight text-white sm:text-[2rem]">
                    {selectedSeat?.type === 'aisle' ? <MapIcon className="h-7 w-7" /> : <UserPlus className="h-7 w-7" />}
                    배정 설정
                  </DialogTitle>
                  <DialogDescription className="max-w-2xl text-sm font-semibold leading-6 text-white/82">
                    좌석 상태를 먼저 확인하고, 필요하면 통로 전환과 구역 설정을 마친 뒤 학생 배정까지 바로 이어서 처리할 수 있습니다.
                  </DialogDescription>
                </div>
                <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "sm:grid-cols-3")}>
                  <div className="rounded-[1.45rem] border border-white/14 bg-white/10 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/62">현재 구역</p>
                    <p className="mt-2 text-base font-black text-white">{selectedSeatZoneLabel}</p>
                    <p className="mt-1 text-xs font-semibold text-white/72">좌석 컨텍스트를 먼저 고정합니다.</p>
                  </div>
                  <div className="rounded-[1.45rem] border border-white/14 bg-white/10 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/62">좌석 상태</p>
                    <p className="mt-2 text-base font-black text-white">{selectedSeatModeLabel}</p>
                    <p className="mt-1 text-xs font-semibold text-white/72">{selectedSeatAvailabilityCopy}</p>
                  </div>
                  <div className="rounded-[1.45rem] border border-white/14 bg-white/10 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/62">배정 상태</p>
                    <p className="mt-2 text-base font-black text-white">{selectedSeatAssignmentLabel}</p>
                    <p className="mt-1 text-xs font-semibold text-white/72">
                      {selectedSeat?.type === 'aisle' ? '학생 검색은 숨김 처리됩니다.' : '빈 좌석일 때만 학생 배정을 이어갑니다.'}
                    </p>
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#F7F9FC] p-5 sm:p-6">
              <div className={cn("grid gap-5", isMobile ? "grid-cols-1" : "lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]")}>
                <motion.div
                  {...getDeckMotionProps(0.08, 10)}
                  className="rounded-[2rem] border border-[#D7E4FF] bg-white p-5 shadow-[0_20px_44px_rgba(15,23,42,0.07)] sm:p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5C6E97]">Seat Control</p>
                      <p className="mt-2 text-xl font-black tracking-tight text-[#14295F]">좌석 관리</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#5C6E97]">
                        좌석과 통로 상태를 먼저 정리하고, 좌석인 경우에만 구역을 고정합니다.
                      </p>
                    </div>
                    <div className="rounded-full border border-[#D7E4FF] bg-[#F7FAFF] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]">
                      {selectedSeatLabel}
                    </div>
                  </div>

                  {isEditMode && (
                    <div className="mt-6 space-y-4">
                      <div className="rounded-[1.7rem] bg-[#14295F] p-5 text-white shadow-[0_20px_38px_rgba(20,41,95,0.22)]">
                        <div className="flex items-center gap-2">
                          <ArrowRightLeft className="h-4 w-4 text-white" />
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70">Primary Action</p>
                        </div>
                        <p className="mt-3 text-lg font-black text-white">
                          {selectedSeat?.type === 'aisle' ? '좌석으로 다시 활성화' : '통로 모드로 전환'}
                        </p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-white/78">
                          {selectedSeat?.type === 'aisle'
                            ? '학생을 다시 배정할 수 있는 좌석으로 되돌립니다.'
                            : '이 칸을 학생 배정 없이 이동 동선용 통로로 사용합니다.'}
                        </p>
                        <Button
                          onClick={handleToggleCellType}
                          disabled={isSaving}
                          className={cn(
                            "mt-5 h-12 w-full rounded-[1.05rem] font-black transition-all",
                            selectedSeat?.type === 'aisle'
                              ? "bg-white text-[#14295F] hover:bg-white/92"
                              : "bg-[#FF7A16] text-white hover:bg-[#E9680C]",
                          )}
                        >
                          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                          {selectedSeat?.type === 'aisle' ? '좌석으로 사용' : '통로로 전환'}
                        </Button>
                      </div>

                      {selectedSeat?.type !== 'aisle' ? (
                        <div className="rounded-[1.7rem] border border-[#D7E4FF] bg-[#F7FAFF] p-5">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-[#14295F]" />
                            <Label className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5C6E97]">
                              좌석 구역 설정
                            </Label>
                          </div>
                          <p className="mt-3 text-base font-black text-[#14295F]">현재 구역: {selectedSeatZoneLabel}</p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-[#5C6E97]">
                            배정 전에 구역을 고정하면 학생 운영과 좌석 분류가 더 안정적으로 이어집니다.
                          </p>
                          <Select value={selectedSeat?.seatZone || '미정'} onValueChange={handleUpdateZone}>
                            <SelectTrigger className="mt-5 h-12 rounded-[1.05rem] border border-[#D7E4FF] bg-white px-4 font-black text-[#14295F] shadow-none">
                              <SelectValue placeholder="구역 선택" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl">
                              <SelectItem value="미정" className="font-bold text-[#14295F]">미정</SelectItem>
                              <SelectItem value="A존 (집중)" className="font-bold text-[#14295F]">A존 (집중)</SelectItem>
                              <SelectItem value="B존 (표준)" className="font-bold text-[#14295F]">B존 (표준)</SelectItem>
                              <SelectItem value="고정석" className="font-bold text-[#14295F]">고정석</SelectItem>
                              <SelectItem value="자유석" className="font-bold text-[#14295F]">자유석</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="rounded-[1.7rem] bg-[#14295F] p-5 text-white shadow-[0_18px_36px_rgba(20,41,95,0.2)]">
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/68">Aisle Mode</p>
                          <p className="mt-3 text-lg font-black text-white">현재는 통로 모드입니다.</p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-white/78">
                            통로 상태에서는 학생 배정과 구역 선택이 비활성화됩니다. 좌석으로 다시 전환하면 바로 배정 흐름이 열립니다.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>

                <motion.div
                  {...getDeckMotionProps(0.12, 12)}
                  className="rounded-[2rem] border border-[#D7E4FF] bg-white p-5 shadow-[0_20px_44px_rgba(15,23,42,0.07)] sm:p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5C6E97]">Student Assign</p>
                      <p className="mt-2 text-xl font-black tracking-tight text-[#14295F]">학생 배정</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#5C6E97]">
                        이름으로 빠르게 찾고, 미배정 학생을 바로 좌석에 연결합니다.
                      </p>
                    </div>
                    <div className="rounded-full border border-[#D7E4FF] bg-[#F7FAFF] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]">
                      {selectedSeat?.type === 'aisle' ? '배정 잠금' : unassignedStudentCountLabel}
                    </div>
                  </div>

                  {selectedSeat?.type !== 'aisle' ? (
                    <div className="mt-6 space-y-4">
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5C6E97]" />
                        <Input
                          placeholder="학생 이름으로 검색"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="h-12 rounded-[1.05rem] border border-[#D7E4FF] bg-[#F7FAFF] pl-11 font-black text-[#14295F] placeholder:text-[#7F91B3]"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <div className="rounded-full border border-[#D7E4FF] bg-[#F7FAFF] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]">
                          {unassignedStudentCountLabel}
                        </div>
                        <div className="rounded-full border border-[#D7E4FF] bg-[#F7FAFF] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]">
                          {searchTerm.trim() ? `검색어 ${searchTerm.trim()}` : '전체 미배정 보기'}
                        </div>
                      </div>

                      <ScrollArea className="h-[340px] pr-4">
                        <div className="space-y-3">
                          {unassignedStudents.length === 0 ? (
                            <div className="rounded-[1.8rem] bg-[#14295F] p-6 text-center text-white shadow-[0_18px_36px_rgba(20,41,95,0.2)]">
                              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/68">
                                {searchTerm.trim() ? 'Search Empty' : 'No Candidate'}
                              </p>
                              <p className="mt-3 text-lg font-black text-white">
                                {searchTerm.trim() ? '검색 결과가 없습니다.' : '미배정 학생이 없습니다.'}
                              </p>
                              <p className="mt-2 text-sm font-semibold leading-6 text-white/78">
                                {searchTerm.trim()
                                  ? '다른 이름으로 다시 찾거나 검색어를 지우고 전체 학생을 확인해 주세요.'
                                  : '현재는 바로 연결할 수 있는 학생이 없어서 배정 카드가 비어 있습니다.'}
                              </p>
                            </div>
                          ) : (
                            unassignedStudents.map((student) => (
                              <button
                                key={student.id}
                                type="button"
                                onClick={() => assignStudentToSeat(student)}
                                className="flex w-full items-center justify-between rounded-[1.6rem] border border-[#D7E4FF] bg-[#F7FAFF] px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#9CB6F6] hover:shadow-[0_18px_34px_rgba(20,41,95,0.1)]"
                              >
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-white text-base font-black text-[#14295F] shadow-[0_12px_24px_rgba(20,41,95,0.08)]">
                                    {student.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-[#14295F]">{student.name}</p>
                                    <p className="mt-1 truncate text-xs font-semibold text-[#5C6E97]">
                                      {student.schoolName || '학교 미등록'}
                                      {student.grade ? ` · ${student.grade}` : ''}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#14295F]">
                                    배정
                                  </span>
                                  <ChevronRight className="h-4 w-4 text-[#14295F]" />
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-[1.8rem] bg-[#14295F] p-6 text-white shadow-[0_18px_36px_rgba(20,41,95,0.2)]">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/68">Assign Locked</p>
                      <p className="mt-3 text-lg font-black text-white">학생 배정이 잠겨 있습니다.</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-white/78">
                        통로 모드에서는 학생 검색과 배정 리스트가 숨겨집니다. 좌석으로 다시 전환하면 여기서 바로 학생을 연결할 수 있습니다.
                      </p>
                    </div>
                  )}
                </motion.div>
              </div>
            </div>

            <DialogFooter className={cn("shrink-0 border-t border-[#D7E4FF] bg-white flex justify-center", isMobile ? "p-4" : "p-6")}>
              <Button
                variant="ghost"
                onClick={() => setIsAssigning(false)}
                className="h-12 w-full rounded-[1.1rem] font-black text-[#14295F] hover:bg-[#F1F6FF]"
              >
                취소
              </Button>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
