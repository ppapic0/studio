
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
  RotateCcw,
  Trash2
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
import { StudentProfile, AttendanceCurrent, StudyLogDay, CounselingReservation, CenterMembership, StudySession, StudyPlanItem, DailyReport, DailyStudentStat, GrowthProgress, AttendanceRequest, PenaltyLog, LayoutRoomConfig, SeatGenderPolicy } from '@/lib/types';
import { buildDailyReportPreview } from '@/lib/daily-report-preview';
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
import { AdminWorkbenchCommandBar } from '@/components/dashboard/admin-workbench-command-bar';
import { CenterAdminAttendanceBoard } from '@/components/dashboard/center-admin-attendance-board';
import {
  OperationsInbox,
  type OperationsInboxPanel,
  type OperationsInboxQueueItem,
  type OperationsInboxSummaryChip,
} from '@/components/dashboard/operations-inbox';
import { VisualReportViewer } from '@/components/dashboard/visual-report-viewer';
import { AppointmentsPageContent } from '@/app/dashboard/appointments/appointments-page-content';
import { buildNoShowFlag } from '@/features/schedules/lib/buildNoShowFlag';
import { useCenterAdminAttendanceBoard } from '@/hooks/use-center-admin-attendance-board';
import type { CenterAdminAttendanceSeatSignal } from '@/lib/center-admin-attendance-board';
import {
  buildCounselingTrackOverview,
  type DashboardCounselTrackTab,
  type DashboardParentCommunicationRecord,
  normalizeParentCommunicationRecord,
} from '@/lib/dashboard-communications';
import {
  buildCenterAdminPrimaryChip,
  buildCenterAdminSecondaryFlags,
  buildCenterAdminSeatLegend,
  buildCenterAdminSeatOverlaySummary,
  formatCenterAdminWeeklyStudyLabel,
  getCenterAdminDomainSummary,
  getCenterAdminSeatOverlayPresentation,
  type CenterAdminSeatDomainKey,
  type CenterAdminSeatOverlayMode,
  type CenterAdminStudentSeatSignal,
} from '@/lib/center-admin-seat-heatmap';
import { useTeacherClassroomSignals } from '@/lib/teacher-classroom-model';
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
  getSeatGenderPolicyLabel,
  getSeatDisplayLabel,
  getGlobalSeatNo,
  getRoomLabel,
  hasAssignedSeat,
  normalizeSeatGenderBySeatId,
  normalizeSeatGenderPolicy,
  normalizeAisleSeatIds,
  normalizeLayoutRooms,
  normalizeSeatLabelValue,
  normalizeSeatLabelsBySeatId,
  parseSeatId,
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
const MAX_STUDY_SESSION_MINUTES = 360;

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

function getStudySessionDisplayMinutes(session: Partial<StudySession>) {
  const directMinutes = Number(session.durationMinutes ?? 0);
  if (Number.isFinite(directMinutes) && directMinutes > 0) {
    return Math.max(0, Math.round(directMinutes));
  }

  const startMs = session.startTime?.toMillis?.() ?? 0;
  const endMs = session.endTime?.toMillis?.() ?? 0;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;
  return Math.max(1, Math.ceil((endMs - startMs) / 60000));
}

function parsePositivePointValue(value: unknown): number {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.floor(numeric));
}

function getCenterPointEvents(dayStatus: unknown): Record<string, any>[] {
  if (!dayStatus || typeof dayStatus !== 'object') return [];
  const events = (dayStatus as Record<string, any>).pointEvents;
  return Array.isArray(events)
    ? events.filter((event): event is Record<string, any> => Boolean(event && typeof event === 'object'))
    : [];
}

function getCenterPointDayAmount(dayStatus: unknown): number {
  if (!dayStatus || typeof dayStatus !== 'object') return 0;
  const status = dayStatus as Record<string, any>;
  const directAmount = parsePositivePointValue(status.dailyPointAmount);
  const eventAmount = getCenterPointEvents(status).reduce(
    (sum, event) => sum + parsePositivePointValue(event.points),
    0
  );
  return Math.max(directAmount, eventAmount);
}

function getCenterPointDayDetail(dayStatus: unknown): string {
  const labels = getCenterPointEvents(dayStatus)
    .map((event) => {
      const label = typeof event.label === 'string' ? event.label.trim() : '';
      const reason = typeof event.reason === 'string' ? event.reason.trim() : '';
      const source = typeof event.source === 'string' ? event.source.trim() : '';
      if (label) return label;
      if (reason) return reason;
      if (source === 'plan_completion') return '계획 완수';
      if (source === 'study_box') return '공부상자';
      if (source.includes('rank')) return '랭킹 보상';
      return '';
    })
    .filter(Boolean);
  return Array.from(new Set(labels)).slice(0, 3).join(' · ') || '포인트 적립';
}

function getManualSeatOccupantName(seat?: Pick<AttendanceCurrent, 'manualOccupantName'> | null) {
  return typeof seat?.manualOccupantName === 'string' ? seat.manualOccupantName.trim() : '';
}

function hasSeatOccupant(seat?: Pick<AttendanceCurrent, 'studentId' | 'manualOccupantName'> | null) {
  const assignedStudentId = typeof seat?.studentId === 'string' ? seat.studentId.trim() : '';
  return Boolean(assignedStudentId || getManualSeatOccupantName(seat));
}

function areSortedStringArraysEqual(left: string[] | null | undefined, right: string[] | null | undefined) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function getSeatCanvasId(
  seat?: Pick<AttendanceCurrent, 'id' | 'roomId' | 'roomSeatNo'> | null
) {
  const roomSeatNo = Number(seat?.roomSeatNo || 0);
  if (seat?.roomId && Number.isFinite(roomSeatNo) && roomSeatNo > 0) {
    return buildSeatId(seat.roomId, roomSeatNo);
  }
  return typeof seat?.id === 'string' ? seat.id : '';
}

function getSeatUpdatedAtMs(seat?: Pick<AttendanceCurrent, 'updatedAt'> | null) {
  const candidate = (seat?.updatedAt as any)?.toMillis?.();
  return Number.isFinite(candidate) ? Number(candidate) : 0;
}

function shouldPreferResolvedSeatCandidate(
  candidate: ResolvedAttendanceSeat,
  current: ResolvedAttendanceSeat,
  canonicalSeatId: string
) {
  const candidateUpdatedAt = getSeatUpdatedAtMs(candidate);
  const currentUpdatedAt = getSeatUpdatedAtMs(current);
  if (candidateUpdatedAt !== currentUpdatedAt) {
    return candidateUpdatedAt > currentUpdatedAt;
  }

  const candidateUsesCanonicalDoc = (candidate.seatDocId || candidate.id) === canonicalSeatId;
  const currentUsesCanonicalDoc = (current.seatDocId || current.id) === canonicalSeatId;
  if (candidateUsesCanonicalDoc !== currentUsesCanonicalDoc) {
    return candidateUsesCanonicalDoc;
  }

  return Boolean(candidate.studentId || getManualSeatOccupantName(candidate)) &&
    !Boolean(current.studentId || getManualSeatOccupantName(current));
}

function getLegacySeatDocId(seat?: Pick<ResolvedAttendanceSeat, 'id' | 'seatDocId'> | null) {
  const legacySeatDocId = typeof seat?.seatDocId === 'string' ? seat.seatDocId.trim() : '';
  return legacySeatDocId && legacySeatDocId !== seat?.id ? legacySeatDocId : '';
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
  seatDocId?: string;
  seatGenderPolicy?: SeatGenderPolicy;
};

type CenterPointGrantRow = {
  key: string;
  dateKey: string;
  studentId: string;
  studentName: string;
  points: number;
  detail: string;
};

type CenterPointDailySummary = {
  dateKey: string;
  total: number;
  grants: CenterPointGrantRow[];
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

function averageTeacherScores(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getTeacherRiskHealth(params: {
  riskLevel?: 'stable' | 'watch' | 'risk' | 'critical';
  penaltyPoints: number;
  awayMinutes: number;
}) {
  const { riskLevel = 'stable', penaltyPoints, awayMinutes } = params;
  const baseScore =
    riskLevel === 'critical'
      ? 18
      : riskLevel === 'risk'
        ? 34
        : riskLevel === 'watch'
          ? 62
          : 90;

  if (penaltyPoints >= 12) return Math.min(baseScore, 15);
  if (penaltyPoints >= 7) return Math.min(baseScore, 30);
  if (awayMinutes >= 20) return Math.min(baseScore, 42);
  return baseScore;
}

function getTeacherOperationalHealth(signal: CenterAdminAttendanceSeatSignal) {
  if (signal.seatStatus === 'absent') {
    return signal.todayStudyMinutes > 0 ? 54 : 32;
  }
  if (signal.currentAwayMinutes >= 20) return 44;
  if (signal.todayStudyMinutes >= 240) return 92;
  if (signal.todayStudyMinutes >= 120) return 76;
  return 58;
}

function getTeacherParentHealth(hasUnreadReport: boolean, hasCounselingToday: boolean) {
  if (hasUnreadReport && hasCounselingToday) return 52;
  if (hasUnreadReport) return 38;
  if (hasCounselingToday) return 82;
  return 88;
}

function getTeacherEfficiencyHealth(signal: CenterAdminAttendanceSeatSignal, hasUnreadReport: boolean) {
  if (hasUnreadReport && signal.currentAwayMinutes >= 20) return 34;
  if (hasUnreadReport) return 48;
  if (signal.currentAwayMinutes >= 20) return 46;
  if (signal.recentRoutineMissingCount >= 2) return 58;
  return 84;
}

function getTeacherSeatTopReason(params: {
  attendanceSignal: CenterAdminAttendanceSeatSignal;
  hasUnreadReport: boolean;
  hasCounselingToday: boolean;
  penaltyPoints: number;
  riskLevel?: 'stable' | 'watch' | 'risk' | 'critical';
}) {
  const { attendanceSignal, hasUnreadReport, hasCounselingToday, penaltyPoints, riskLevel = 'stable' } = params;
  if (penaltyPoints >= 7 && attendanceSignal.currentAwayMinutes >= 20) {
    return `벌점 ${penaltyPoints}점과 장기 외출이 겹쳐 오늘 바로 개입이 필요합니다.`;
  }
  if (riskLevel === 'critical' || riskLevel === 'risk') {
    return '리스크 신호가 높아 오늘 우선 확인 대상으로 보는 것이 좋습니다.';
  }
  if (hasUnreadReport && hasCounselingToday) {
    return '미열람 리포트와 오늘 상담 일정이 함께 잡혀 있어 소통 후속조치를 먼저 보는 편이 좋습니다.';
  }
  if (hasUnreadReport) {
    return '최근 리포트가 아직 미열람 상태라 학부모 반응을 먼저 확인하는 편이 좋습니다.';
  }
  if (attendanceSignal.currentAwayMinutes >= 20) {
    return `현재 외출/휴식이 ${attendanceSignal.currentAwayMinutes}분 이어져 복귀 관리가 먼저 필요합니다.`;
  }
  return attendanceSignal.note || '오늘 가장 먼저 확인할 상태와 대응 포인트를 한 화면에서 정리했습니다.';
}

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
  const [selectedSeat, setSelectedSeat] = useState<ResolvedAttendanceSeat | null>(null);
  const [isManaging, setIsManaging] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [quickSessionAdjustingStudentId, setQuickSessionAdjustingStudentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [manualSeatOccupantName, setManualSeatOccupantName] = useState('');
  const [seatLabelDraft, setSeatLabelDraft] = useState('');
  const [optimisticAisleSeatIds, setOptimisticAisleSeatIds] = useState<string[] | null>(null);
  
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
  const [heroPriorityExpandedKey, setHeroPriorityExpandedKey] = useState<string | null>(null);
  const [isHeroRoomsDialogOpen, setIsHeroRoomsDialogOpen] = useState(false);
  const [isCounselTrackDialogOpen, setIsCounselTrackDialogOpen] = useState(false);
  const [counselTrackDialogTab, setCounselTrackDialogTab] = useState<DashboardCounselTrackTab>('reservations');
  const [selectedAttendanceDetailSignal, setSelectedAttendanceDetailSignal] = useState<CenterAdminAttendanceSeatSignal | null>(null);
  const [isCenterPointDialogOpen, setIsCenterPointDialogOpen] = useState(false);
  const [expandedCenterPointDateKey, setExpandedCenterPointDateKey] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [historicalCenterMinutes, setHistoricalCenterMinutes] = useState<Record<string, number>>({});
  const [trendLoading, setTrendLoading] = useState(false);
  const staleSeatCleanupInFlightRef = useRef(false);
  const aisleLayoutMigrationRef = useRef<string | null>(null);
  const hasHydratedRoomDraftsRef = useRef(false);
  const liveBoardSectionRef = useRef<HTMLDivElement | null>(null);
  const seatInsightSectionRef = useRef<HTMLDivElement | null>(null);
  const appointmentsSectionRef = useRef<HTMLDivElement | null>(null);
  const reportsSectionRef = useRef<HTMLDivElement | null>(null);
  
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedRoomView, setSelectedRoomView] = useState<'all' | string>('all');
  const hasInitializedRoomViewRef = useRef(false);
  const [roomDrafts, setRoomDrafts] = useState<Record<string, { rows: number; cols: number }>>({});
  const [seatOverlayMode, setSeatOverlayMode] = useState<CenterAdminSeatOverlayMode>('composite');
  const [selectedSeatInsightKey, setSelectedSeatInsightKey] = useState<CenterAdminSeatDomainKey | null>(null);
  const [isSeatSecondaryExpanded, setIsSeatSecondaryExpanded] = useState(false);

  useEffect(() => {
    setMounted(true);
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isHeroPriorityDialogOpen) {
      setHeroPriorityExpandedKey(null);
    }
  }, [isHeroPriorityDialogOpen]);

  const centerId = activeMembership?.id;
  const canAdjustPenalty =
    activeMembership?.role === 'teacher' ||
    activeMembership?.role === 'centerAdmin' ||
    activeMembership?.role === 'owner';
  const canAdjustStudySession =
    activeMembership?.role === 'teacher' ||
    activeMembership?.role === 'centerAdmin' ||
    activeMembership?.role === 'owner';
  const canResetPenalty =
    activeMembership?.role === 'centerAdmin' ||
    activeMembership?.role === 'owner';
  const canManageManualSeatOccupancy =
    activeMembership?.role === 'centerAdmin' ||
    activeMembership?.role === 'owner';
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgoKey = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const { signals: classroomSignals } = useTeacherClassroomSignals(centerId, todayKey);

  const centerRef = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return doc(firestore, 'centers', centerId);
  }, [firestore, centerId]);
  const { data: centerData, isLoading: centerDataLoading } = useDoc<any>(centerRef);

  useEffect(() => {
    hasHydratedRoomDraftsRef.current = false;
    hasInitializedRoomViewRef.current = false;
    aisleLayoutMigrationRef.current = null;
    setRoomDrafts({});
    setSelectedRoomView('all');
  }, [centerId]);

  const persistedRooms = useMemo(
    () => normalizeLayoutRooms(centerData?.layoutSettings),
    [centerData?.layoutSettings]
  );

  useEffect(() => {
    if (centerDataLoading) return;
    setRoomDrafts((prev) => {
      if (!hasHydratedRoomDraftsRef.current) {
        hasHydratedRoomDraftsRef.current = true;
        return Object.fromEntries(
          persistedRooms.map((room) => [room.id, { rows: room.rows, cols: room.cols }])
        );
      }
      const next: Record<string, { rows: number; cols: number }> = {};
      persistedRooms.forEach((room) => {
        next[room.id] = {
          rows: prev[room.id]?.rows ?? room.rows,
          cols: prev[room.id]?.cols ?? room.cols,
        };
      });
      return next;
    });
  }, [centerDataLoading, persistedRooms]);

  useEffect(() => {
    if (centerDataLoading) return;
    if (hasInitializedRoomViewRef.current || persistedRooms.length === 0) return;
    hasInitializedRoomViewRef.current = true;
    if (selectedRoomView === 'all') {
      setSelectedRoomView(persistedRooms[0].id);
    }
  }, [centerDataLoading, persistedRooms, selectedRoomView]);

  useEffect(() => {
    if (persistedRooms.length === 0) {
      if (selectedRoomView !== 'all') {
        setSelectedRoomView('all');
      }
      return;
    }

    if (selectedRoomView === 'all') return;
    const hasSelectedRoom = persistedRooms.some((room) => room.id === selectedRoomView);
    if (!hasSelectedRoom) {
      setSelectedRoomView(persistedRooms[0].id);
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
  const persistedAisleSeatIds = useMemo(
    () => normalizeAisleSeatIds(centerData?.layoutSettings),
    [centerData?.layoutSettings]
  );
  const hasPersistedAisleSeatIds = useMemo(
    () => Array.isArray(centerData?.layoutSettings?.aisleSeatIds),
    [centerData?.layoutSettings]
  );
  const persistedSeatLabelsBySeatId = useMemo(
    () => normalizeSeatLabelsBySeatId(centerData?.layoutSettings),
    [centerData?.layoutSettings]
  );
  const persistedSeatGenderBySeatId = useMemo(
    () => normalizeSeatGenderBySeatId(centerData?.layoutSettings),
    [centerData?.layoutSettings]
  );
  const persistedLayoutRoomsSnapshot = useMemo(
    () => (persistedRooms.length > 0 ? persistedRooms.map((room) => ({ ...room })) : roomConfigs.map((room) => ({ ...room }))),
    [persistedRooms, roomConfigs]
  );
  const persistedLayoutRows = persistedLayoutRoomsSnapshot[0]?.rows ?? 7;
  const persistedLayoutCols = persistedLayoutRoomsSnapshot[0]?.cols ?? 10;
  const filterSeatLabelsByRooms = (
    rooms: LayoutRoomConfig[],
    source: Record<string, string> = persistedSeatLabelsBySeatId
  ) => {
    const roomCellLimitById = new Map(rooms.map((room) => [room.id, room.rows * room.cols]));

    return Object.fromEntries(
      Object.entries(source)
        .filter(([seatId]) => {
          const parsed = parseSeatId(seatId);
          if (!parsed) return false;
          const maxCells = roomCellLimitById.get(parsed.roomId);
          return Boolean(maxCells) && parsed.roomSeatNo <= Number(maxCells);
        })
        .sort(([left], [right]) => left.localeCompare(right))
    );
  };
  const filterSeatGenderByRooms = (
    rooms: LayoutRoomConfig[],
    source: Record<string, SeatGenderPolicy> = persistedSeatGenderBySeatId
  ) => {
    const roomCellLimitById = new Map(rooms.map((room) => [room.id, room.rows * room.cols]));

    return Object.fromEntries(
      Object.entries(source)
        .filter(([seatId, policy]) => {
          const parsed = parseSeatId(seatId);
          if (!parsed) return false;
          const maxCells = roomCellLimitById.get(parsed.roomId);
          return Boolean(maxCells) && parsed.roomSeatNo <= Number(maxCells) && policy !== 'all';
        })
        .sort(([left], [right]) => left.localeCompare(right))
    );
  };

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

  const parentMembersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'parent'));
  }, [firestore, centerId]);
  const { data: parentMembers } = useCollection<CenterMembership>(parentMembersQuery, { enabled: isActive });

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

  const rawResolvedAttendanceList = useMemo<ResolvedAttendanceSeat[]>(() => {
    if (!attendanceList) return [];
    const dedupedSeats = new Map<string, ResolvedAttendanceSeat>();

    attendanceList.forEach((seat) => {
      const identity = resolveSeatIdentity(seat);
      const canvasSeatId =
        buildSeatId(identity.roomId, identity.roomSeatNo) ||
        identity.seatId ||
        (typeof seat.id === 'string' ? seat.id : '');
      const configuredSeatLabel =
        normalizeSeatLabelValue(seat.seatLabel) ||
        normalizeSeatLabelValue(persistedSeatLabelsBySeatId[canvasSeatId || identity.seatId]);
      const configuredSeatGenderPolicy = normalizeSeatGenderPolicy(
        seat.seatGenderPolicy || persistedSeatGenderBySeatId[canvasSeatId || identity.seatId]
      );
      const normalizedSeat: ResolvedAttendanceSeat = {
        ...seat,
        id: canvasSeatId || seat.id,
        seatDocId: seat.id,
        roomId: identity.roomId || PRIMARY_ROOM_ID,
        roomSeatNo: identity.roomSeatNo,
        seatNo: identity.seatNo,
        seatLabel: configuredSeatLabel || undefined,
        seatGenderPolicy: configuredSeatGenderPolicy,
        type: seat.type || 'seat',
      };
      const dedupeKey = normalizedSeat.id || normalizedSeat.seatDocId || '';
      if (!dedupeKey) return;

      const currentSeat = dedupedSeats.get(dedupeKey);
      if (!currentSeat || shouldPreferResolvedSeatCandidate(normalizedSeat, currentSeat, dedupeKey)) {
        dedupedSeats.set(dedupeKey, normalizedSeat);
      }
    });

    return Array.from(dedupedSeats.values()).sort((left, right) => {
      if (left.roomId !== right.roomId) {
        return left.roomId.localeCompare(right.roomId);
      }
      return Number(left.roomSeatNo || 0) - Number(right.roomSeatNo || 0);
    });
  }, [attendanceList, persistedSeatGenderBySeatId, persistedSeatLabelsBySeatId]);
  const legacyAisleSeatIds = useMemo(() => {
    const next = new Set<string>();
    rawResolvedAttendanceList.forEach((seat) => {
      if (seat.type !== 'aisle') return;
      const canonicalSeatId = buildSeatId(seat.roomId, seat.roomSeatNo);
      if (canonicalSeatId) {
        next.add(canonicalSeatId);
      }
    });
    return Array.from(next).sort();
  }, [rawResolvedAttendanceList]);
  const effectiveAisleSeatIds = useMemo(() => {
    if (optimisticAisleSeatIds) return optimisticAisleSeatIds;
    if (hasPersistedAisleSeatIds) return persistedAisleSeatIds;
    return legacyAisleSeatIds;
  }, [hasPersistedAisleSeatIds, legacyAisleSeatIds, optimisticAisleSeatIds, persistedAisleSeatIds]);
  const effectiveAisleSeatIdSet = useMemo(
    () => new Set(effectiveAisleSeatIds),
    [effectiveAisleSeatIds]
  );
  const resolvedAttendanceList = useMemo<ResolvedAttendanceSeat[]>(
    () =>
      rawResolvedAttendanceList.map((seat) => ({
        ...seat,
        type: effectiveAisleSeatIdSet.has(buildSeatId(seat.roomId, seat.roomSeatNo)) ? 'aisle' : 'seat',
      })),
    [effectiveAisleSeatIdSet, rawResolvedAttendanceList]
  );
  useEffect(() => {
    if (!firestore || !centerId || !isActive) return;
    if (centerDataLoading) return;
    if (hasPersistedAisleSeatIds || legacyAisleSeatIds.length === 0) return;

    const migrationKey = `${centerId}:${legacyAisleSeatIds.join('|')}`;
    if (aisleLayoutMigrationRef.current === migrationKey) return;
    aisleLayoutMigrationRef.current = migrationKey;

    void setDoc(
      doc(firestore, 'centers', centerId),
      {
        layoutSettings: {
          rooms: persistedLayoutRoomsSnapshot,
          rows: persistedLayoutRows,
          cols: persistedLayoutCols,
          aisleSeatIds: legacyAisleSeatIds,
          seatLabelsBySeatId: filterSeatLabelsByRooms(persistedLayoutRoomsSnapshot),
          seatGenderBySeatId: filterSeatGenderByRooms(persistedLayoutRoomsSnapshot),
          updatedAt: serverTimestamp(),
        },
      },
      { merge: true }
    ).catch((migrationError) => {
      aisleLayoutMigrationRef.current = null;
      console.warn('[teacher-dashboard] aisle layout migration failed', migrationError);
    });
  }, [
    centerId,
    centerDataLoading,
    firestore,
    hasPersistedAisleSeatIds,
    isActive,
    legacyAisleSeatIds,
    persistedLayoutCols,
    persistedLayoutRoomsSnapshot,
    persistedLayoutRows,
    persistedSeatGenderBySeatId,
    persistedSeatLabelsBySeatId,
  ]);
  useEffect(() => {
    if (!optimisticAisleSeatIds) return;
    if (!hasPersistedAisleSeatIds) return;
    if (!areSortedStringArraysEqual(optimisticAisleSeatIds, persistedAisleSeatIds)) return;
    setOptimisticAisleSeatIds(null);
  }, [hasPersistedAisleSeatIds, optimisticAisleSeatIds, persistedAisleSeatIds]);
  useEffect(() => {
    setOptimisticAisleSeatIds(null);
  }, [centerId]);

  const studentsById = useMemo(
    () => new Map((students || []).map((student) => [student.id, student])),
    [students]
  );

  const studentMembersById = useMemo(
    () => new Map((studentMembers || []).map((member) => [member.id, member])),
    [studentMembers]
  );

  const selectedAttendanceDetail = useMemo(() => {
    const signal = selectedAttendanceDetailSignal;
    if (!signal?.studentId) return null;

    const student = studentsById.get(signal.studentId) || null;
    const studentMember = studentMembersById.get(signal.studentId) || null;
    const parentUidSet = new Set(student?.parentUids || []);
    const parentMember =
      (parentMembers || []).find((member) => {
        if (parentUidSet.has(member.id)) return true;
        return (member.linkedStudentIds || []).includes(signal.studentId);
      }) || null;
    const seatLabel =
      signal.roomId && signal.roomSeatNo
        ? formatSeatLabel(
            { roomId: signal.roomId, roomSeatNo: signal.roomSeatNo, seatId: signal.seatId },
            roomConfigs,
            '좌석 미배정',
            persistedSeatLabelsBySeatId
          )
        : '좌석 미배정';
    const scheduleLabel = [
      signal.classScheduleName,
      signal.scheduleMovementSummary,
    ].filter(Boolean).join(' · ');

    return {
      signal,
      student,
      studentMember,
      parentMember,
      seatLabel,
      plannedArrival: signal.routineExpectedArrivalTime || student?.expectedArrivalTime || '-',
      plannedDeparture: signal.plannedDepartureTime || '-',
      scheduleLabel: scheduleLabel || '등록된 일정 없음',
      parentName: parentMember?.displayName || '학부모',
      parentPhone: parentMember?.phoneNumber || '-',
      studentPhone: student?.phoneNumber || studentMember?.phoneNumber || '-',
    };
  }, [
    parentMembers,
    persistedSeatLabelsBySeatId,
    roomConfigs,
    selectedAttendanceDetailSignal,
    studentMembersById,
    studentsById,
  ]);

  const seatById = useMemo(
    () => {
      const mapped = new Map<string, ResolvedAttendanceSeat>();
      resolvedAttendanceList.forEach((seat) => {
        mapped.set(seat.id, seat);
        if (seat.seatDocId && seat.seatDocId !== seat.id) {
          mapped.set(seat.seatDocId, seat);
        }
      });
      return mapped;
    },
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
  const teacherStudentNameById = useMemo(() => {
    const mapped = new Map<string, string>();
    (studentMembers || []).forEach((member) => {
      const studentProfile = studentsById.get(member.id);
      const displayName = studentProfile?.name || member.displayName || member.id;
      mapped.set(member.id, displayName);
    });
    return mapped;
  }, [studentMembers, studentsById]);

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

  const growthProgressQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'growthProgress');
  }, [firestore, centerId]);
  const { data: growthProgressRecords } = useCollection<GrowthProgress & { id: string }>(growthProgressQuery, {
    enabled: isActive,
  });

  const {
    seatSignals: attendanceSeatSignals,
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

  const classroomSeatSignalsByStudentId = useMemo(
    () => new Map((classroomSignals?.seatSignals || []).map((signal) => [signal.studentId, signal])),
    [classroomSignals]
  );

  const teacherSeatSignals = useMemo<CenterAdminStudentSeatSignal[]>(() => {
    return attendanceSeatSignals.map((attendanceSignal) => {
      const classroomSignal = classroomSeatSignalsByStudentId.get(attendanceSignal.studentId);
      const penaltyPoints = Math.max(0, Math.round(Number(classroomSignal?.effectivePenaltyPoints || 0)));
      const hasUnreadReport = classroomSignal?.hasUnreadReport ?? false;
      const hasCounselingToday = classroomSignal?.hasCounselingToday ?? false;
      const riskLevel = classroomSignal?.riskLevel || 'stable';
      const operationalScore = getTeacherOperationalHealth(attendanceSignal);
      const parentScore = getTeacherParentHealth(hasUnreadReport, hasCounselingToday);
      const riskScore = getTeacherRiskHealth({
        riskLevel,
        penaltyPoints,
        awayMinutes: attendanceSignal.currentAwayMinutes,
      });
      const efficiencyScore = getTeacherEfficiencyHealth(attendanceSignal, hasUnreadReport);
      const compositeHealth = averageTeacherScores([
        operationalScore,
        parentScore,
        riskScore,
        efficiencyScore,
      ]);
      const todayMinutes = Math.max(
        0,
        Math.round(Number(attendanceSignal.todayStudyMinutes || classroomSignal?.todayMinutes || 0))
      );

      return {
        studentId: attendanceSignal.studentId,
        seatId: attendanceSignal.seatId,
        studentName: attendanceSignal.studentName,
        className: attendanceSignal.className,
        roomId: attendanceSignal.roomId,
        roomSeatNo: attendanceSignal.roomSeatNo,
        attendanceStatus: attendanceSignal.seatStatus,
        checkedAtLabel: attendanceSignal.checkedAtLabel,
        firstCheckInLabel: attendanceSignal.firstCheckInLabel,
        routineExpectedArrivalTime: attendanceSignal.routineExpectedArrivalTime,
        plannedDepartureTime: attendanceSignal.plannedDepartureTime,
        compositeHealth,
        domainScores: {
          operational: operationalScore,
          parent: parentScore,
          risk: riskScore,
          billing: 85,
          efficiency: efficiencyScore,
        },
        todayMinutes,
        weeklyStudyMinutes: todayMinutes,
        weeklyStudyLabel: formatCenterAdminWeeklyStudyLabel(todayMinutes),
        effectivePenaltyPoints: penaltyPoints,
        hasUnreadReport,
        hasCounselingToday,
        currentAwayMinutes: attendanceSignal.currentAwayMinutes,
        invoiceStatus: 'none',
        primaryChip: buildCenterAdminPrimaryChip(compositeHealth),
        secondaryFlags: buildCenterAdminSecondaryFlags(
          {
            hasUnreadReport,
            hasCounselingToday,
            invoiceStatus: 'none',
            currentAwayMinutes: attendanceSignal.currentAwayMinutes,
            status: attendanceSignal.seatStatus,
          },
          { includeFinancialSignals: false }
        ),
        topReason: getTeacherSeatTopReason({
          attendanceSignal,
          hasUnreadReport,
          hasCounselingToday,
          penaltyPoints,
          riskLevel,
        }),
      };
    });
  }, [attendanceSeatSignals, classroomSeatSignalsByStudentId]);

  const seatSignalsBySeatId = useMemo(
    () => new Map(teacherSeatSignals.map((signal) => [signal.seatId, signal])),
    [teacherSeatSignals]
  );

  const studentSignalsByStudentId = useMemo(
    () => new Map(teacherSeatSignals.map((signal) => [signal.studentId, signal])),
    [teacherSeatSignals]
  );

  const seatOverlayLegend = useMemo(
    () => buildCenterAdminSeatLegend({ includeFinancialSignals: false }),
    []
  );

  const seatOverlaySummary = useMemo(
    () => buildCenterAdminSeatOverlaySummary(teacherSeatSignals, { includeFinancialSignals: false }),
    [teacherSeatSignals]
  );

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
    const statBaseMinutes = Number(studentStat?.totalStudyMinutes || 0);
    const statAdjustmentMinutes = Number(studentStat?.manualAdjustmentMinutes || 0);
    const cumulativeMinutes = Math.max(
      0,
      Math.round(
        (Number.isFinite(statBaseMinutes) ? statBaseMinutes : 0) +
        (Number.isFinite(statAdjustmentMinutes) ? statAdjustmentMinutes : 0)
      )
    );
    const signalMinutes = Math.max(0, Math.round(Number(attendanceSeatSignalsByStudentId.get(studentId)?.todayStudyMinutes || 0)));
    const selectedSessionMinutes =
      selectedSeat?.studentId === studentId
        ? selectedStudentSessions.reduce((sum, session) => sum + getStudySessionDisplayMinutes(session), 0)
        : 0;
    const adjustedSelectedSessionMinutes = Math.max(0, selectedSessionMinutes + (Number.isFinite(statAdjustmentMinutes) ? statAdjustmentMinutes : 0));
    
    let sessionSeconds = 0;
    if (status === 'studying' && lastCheckInAt) {
      const startTime = lastCheckInAt.toMillis();
      sessionSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
    }

    const sessionMinutes = Math.ceil(sessionSeconds / 60);
    const totalMinutes = Math.max(cumulativeMinutes + Math.max(0, sessionMinutes), signalMinutes, adjustedSelectedSessionMinutes);

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
    const configuredSeatLabel =
      normalizeSeatLabelValue(existingSeat?.seatLabel) ||
      normalizeSeatLabelValue(persistedSeatLabelsBySeatId[seatId]);
    const configuredSeatGenderPolicy = normalizeSeatGenderPolicy(
      existingSeat?.seatGenderPolicy || persistedSeatGenderBySeatId[seatId]
    );
    if (existingSeat) {
      return {
        ...existingSeat,
        roomId: room.id,
        roomSeatNo,
        seatNo: getGlobalSeatNo(room.id, roomSeatNo),
        seatLabel: configuredSeatLabel || undefined,
        seatGenderPolicy: configuredSeatGenderPolicy,
        type: effectiveAisleSeatIdSet.has(seatId) ? 'aisle' : 'seat',
      };
    }

    return {
      id: seatId,
      roomId: room.id,
      roomSeatNo,
      seatNo: getGlobalSeatNo(room.id, roomSeatNo),
      seatLabel: configuredSeatLabel || undefined,
      seatGenderPolicy: configuredSeatGenderPolicy,
      status: 'absent',
      type: effectiveAisleSeatIdSet.has(seatId) ? 'aisle' : 'seat',
      updatedAt: Timestamp.now(),
    };
  };

  const roomSummaries = useMemo(() => {
    return roomConfigs.map((room) => {
      let physicalSeats = 0;
      let studying = 0;
      let away = 0;
      let occupied = 0;

      for (let roomSeatNo = 1; roomSeatNo <= room.rows * room.cols; roomSeatNo += 1) {
        const seat = getSeatForRoom(room, roomSeatNo);
        if (seat.type === 'aisle') continue;
        physicalSeats += 1;

        const member = seat.studentId ? studentMembersById.get(seat.studentId) : null;
        const hasManualOccupant = Boolean(getManualSeatOccupantName(seat));
        const isIncluded =
          selectedClass === 'all'
            ? true
            : hasManualOccupant
              ? true
              : Boolean(member && member.className === selectedClass && member.status === 'active');

        if (!isIncluded) continue;
        if (hasSeatOccupant(seat)) occupied += 1;
        if (seat.status === 'studying') studying += 1;
        if (seat.status === 'away' || seat.status === 'break') away += 1;
      }

      return {
        ...room,
        physicalSeats,
        studying,
        away,
        assigned: occupied,
        availableSeats: Math.max(0, physicalSeats - occupied),
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
  const latestUnreadRecentReport = useMemo(
    () => recentReportsFeed.find((report) => !report.viewedAt) || null,
    [recentReportsFeed]
  );
  const parentActivityWindowStart = useMemo(
    () => Timestamp.fromDate(subDays(new Date(), 30)),
    [todayKey]
  );
  const parentCommunicationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'parentCommunications'),
      where('createdAt', '>=', parentActivityWindowStart)
    );
  }, [firestore, centerId, parentActivityWindowStart]);
  const { data: parentCommunications } = useCollection<DashboardParentCommunicationRecord>(parentCommunicationsQuery, {
    enabled: isActive,
  });
  const normalizedParentCommunications = useMemo(
    () => (parentCommunications || []).map((item) => normalizeParentCommunicationRecord(item)),
    [parentCommunications]
  );
  const counselingReservationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'counselingReservations'),
      orderBy('createdAt', 'desc'),
      limit(120),
    );
  }, [firestore, centerId]);
  const { data: counselingReservations } = useCollection<CounselingReservation>(counselingReservationsQuery, {
    enabled: isActive,
  });

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
  const openCounselTrackDialog = (tab: DashboardCounselTrackTab = 'reservations') => {
    setCounselTrackDialogTab(tab);
    setIsCounselTrackDialogOpen(true);
  };
  const openTeacherAttendanceSignal = (signal: CenterAdminAttendanceSeatSignal) => {
    const matchedSeat =
      seatById.get(signal.seatId)
      || (signal.studentId ? seatByStudentId.get(signal.studentId) || null : null);

    if (signal.roomId) {
      setSelectedRoomView(signal.roomId);
    }
    if (matchedSeat) {
      setSelectedSeat(matchedSeat);
    }
    scrollToSection(liveBoardSectionRef);
  };
  const openTeacherAttendanceSignalDetails = (signal: CenterAdminAttendanceSeatSignal) => {
    setSelectedAttendanceDetailSignal(signal);
  };
  const handleQuickStudySessionAdjustment = async (
    signal: CenterAdminAttendanceSeatSignal,
    requestedDeltaMinutes: number
  ) => {
    if (!firestore || !centerId || !signal.studentId || !canAdjustStudySession) return;

    const currentDisplayMinutes = Math.max(0, Math.round(Number(signal.todayStudyMinutes || 0)));
    const normalizedDelta =
      requestedDeltaMinutes < 0
        ? -Math.min(Math.abs(requestedDeltaMinutes), currentDisplayMinutes)
        : Math.max(0, Math.round(requestedDeltaMinutes));

    if (normalizedDelta === 0) {
      toast({ title: '보정할 공부시간이 없습니다.' });
      return;
    }

    setQuickSessionAdjustingStudentId(signal.studentId);
    try {
      const dailyLogRef = doc(firestore, 'centers', centerId, 'studyLogs', signal.studentId, 'days', todayKey);
      const dailyStatRef = doc(firestore, 'centers', centerId, 'dailyStudentStats', todayKey, 'students', signal.studentId);
      const batch = writeBatch(firestore);

      batch.set(
        dailyLogRef,
        {
          centerId,
          studentId: signal.studentId,
          dateKey: todayKey,
          manualAdjustmentMinutes: increment(normalizedDelta),
          correctedAt: serverTimestamp(),
          correctedByUserId: user?.uid || '',
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      batch.set(
        dailyStatRef,
        {
          centerId,
          studentId: signal.studentId,
          dateKey: todayKey,
          manualAdjustmentMinutes: increment(normalizedDelta),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      await batch.commit();
      toast({
        title: '몰입세션 보정 완료',
        description: `${signal.studentName} 학생 오늘 공부시간 ${normalizedDelta > 0 ? '+' : ''}${normalizedDelta}분`,
      });
    } catch (error) {
      console.error('[teacher-dashboard] quick study session adjustment failed', error);
      toast({ variant: 'destructive', title: '세션 보정 실패', description: '잠시 후 다시 시도해 주세요.' });
    } finally {
      setQuickSessionAdjustingStudentId((current) => (current === signal.studentId ? null : current));
    }
  };
  const teacherCounselingTrackOverview = useMemo(
    () =>
      buildCounselingTrackOverview({
        communications: normalizedParentCommunications,
        reservations: counselingReservations || [],
        studentNameById: teacherStudentNameById,
        targetMemberIds,
      }),
    [counselingReservations, normalizedParentCommunications, targetMemberIds, teacherStudentNameById]
  );
  const teacherNoShowSignals = useMemo(
    () =>
      attendanceSeatSignals
        .filter((signal) => signal.boardStatus === 'absent')
        .filter((signal) =>
          buildNoShowFlag({
            now: new Date(now),
            dateKey: todayKey,
            selectedDateKey: todayKey,
            arrivalPlannedAt: signal.routineExpectedArrivalTime,
            actualArrivalAt: signal.hasAttendanceEvidence ? new Date(now) : null,
            graceMinutes: 15,
          })
        )
        .sort((left, right) => {
          const leftExpected = left.routineExpectedArrivalTime || '99:99';
          const rightExpected = right.routineExpectedArrivalTime || '99:99';
          if (leftExpected !== rightExpected) return leftExpected.localeCompare(rightExpected, 'ko');
          return (left.roomSeatNo ?? Number.MAX_SAFE_INTEGER) - (right.roomSeatNo ?? Number.MAX_SAFE_INTEGER);
        }),
    [attendanceSeatSignals, now, todayKey]
  );
  const teacherLateSignals = useMemo(
    () =>
      attendanceSeatSignals
        .filter((signal) => signal.attendanceDisplayStatus === 'confirmed_late' || signal.boardStatus === 'late')
        .sort(
          (left, right) =>
            (left.roomSeatNo ?? Number.MAX_SAFE_INTEGER) - (right.roomSeatNo ?? Number.MAX_SAFE_INTEGER)
        ),
    [attendanceSeatSignals]
  );
  const centerPointDistribution = useMemo(() => {
    const dailyMap = new Map<string, CenterPointDailySummary>();

    (growthProgressRecords || []).forEach((progress) => {
      const studentId = typeof progress.id === 'string' ? progress.id : '';
      if (!studentId) return;
      const dailyPointStatus = progress.dailyPointStatus || {};
      const studentName = teacherStudentNameById.get(studentId) || studentId;

      Object.entries(dailyPointStatus).forEach(([dateKey, dayStatus]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
        if (dateKey < thirtyDaysAgoKey || dateKey > todayKey) return;

        const points = getCenterPointDayAmount(dayStatus);
        if (points <= 0) return;

        const summary = dailyMap.get(dateKey) || { dateKey, total: 0, grants: [] };
        const grant: CenterPointGrantRow = {
          key: `${dateKey}-${studentId}`,
          dateKey,
          studentId,
          studentName,
          points,
          detail: getCenterPointDayDetail(dayStatus),
        };
        summary.total += points;
        summary.grants.push(grant);
        dailyMap.set(dateKey, summary);
      });
    });

    const dailyRows = Array.from(dailyMap.values())
      .map((row) => ({
        ...row,
        grants: row.grants.sort((left, right) => right.points - left.points || left.studentName.localeCompare(right.studentName, 'ko')),
      }))
      .sort((left, right) => right.dateKey.localeCompare(left.dateKey));
    const monthTotal = dailyRows.reduce((sum, row) => sum + row.total, 0);
    const todayTotal = dailyMap.get(todayKey)?.total || 0;

    return {
      todayTotal,
      monthTotal,
      dailyRows,
      studentGrantCount: dailyRows.reduce((sum, row) => sum + row.grants.length, 0),
    };
  }, [growthProgressRecords, teacherStudentNameById, thirtyDaysAgoKey, todayKey]);
  const teacherOperationsInboxTotalOpenCount =
    teacherNoShowSignals.length
    + teacherLateSignals.length
    + teacherCounselingTrackOverview.consultationCount
    + teacherCounselingTrackOverview.wifiCount
    + teacherCounselingTrackOverview.parentRequestCount;
  const teacherOperationsInboxStatusTone =
    teacherNoShowSignals.length > 0 || teacherLateSignals.length > 0
      ? 'urgent'
      : teacherOperationsInboxTotalOpenCount > 0
        ? 'caution'
        : 'stable';
  const teacherOperationsInboxSummaryChips = useMemo<OperationsInboxSummaryChip[]>(
    () => [
      {
        key: 'no-show',
        label: '연락 필요 미입실',
        value: `${teacherNoShowSignals.length}명`,
        caption: teacherNoShowSignals.length > 0 ? '예정 등원 +15분 경과' : '현재 대상 없음',
        tone: teacherNoShowSignals.length > 0 ? 'rose' : 'blue',
        onClick: teacherNoShowSignals.length > 0 ? () => openTeacherAttendanceSignalDetails(teacherNoShowSignals[0]) : undefined,
      },
      {
        key: 'late',
        label: '지각',
        value: `${teacherLateSignals.length}명`,
        caption: teacherLateSignals.length > 0 ? '입실 시간 확인 필요' : '현재 대상 없음',
        tone: teacherLateSignals.length > 0 ? 'orange' : 'blue',
        onClick: teacherLateSignals.length > 0 ? () => openTeacherAttendanceSignalDetails(teacherLateSignals[0]) : undefined,
      },
      {
        key: 'consultation',
        label: '상담 문의/예약',
        value: `${teacherCounselingTrackOverview.consultationCount}건`,
        caption: '요청과 예약 대기',
        tone: teacherCounselingTrackOverview.consultationCount > 0 ? 'violet' : 'blue',
        onClick:
          teacherCounselingTrackOverview.consultationCount > 0
            ? () => openCounselTrackDialog('reservations')
            : undefined,
      },
      {
        key: 'wifi',
        label: '방화벽 요청',
        value: `${teacherCounselingTrackOverview.wifiCount}건`,
        caption: '학생 문의 트랙',
        tone: teacherCounselingTrackOverview.wifiCount > 0 ? 'amber' : 'blue',
        onClick:
          teacherCounselingTrackOverview.wifiCount > 0
            ? () => openCounselTrackDialog('inquiries')
            : undefined,
      },
      {
        key: 'parent-request',
        label: '학부모 문의',
        value: `${teacherCounselingTrackOverview.parentRequestCount}건`,
        caption: '일반 요청·건의',
        tone: teacherCounselingTrackOverview.parentRequestCount > 0 ? 'teal' : 'blue',
        onClick:
          teacherCounselingTrackOverview.parentRequestCount > 0
            ? () => openCounselTrackDialog('parent')
            : undefined,
      },
    ],
    [teacherCounselingTrackOverview, teacherLateSignals, teacherNoShowSignals]
  );
  const teacherOperationsInboxQueueItems = useMemo<OperationsInboxQueueItem[]>(
    () =>
      [
        teacherNoShowSignals.length > 0
          ? {
              key: 'queue-no-show',
              label: '연락 필요 미입실',
              title: `연락이 필요한 미입실 학생 ${teacherNoShowSignals.length}명`,
              detail: `${teacherNoShowSignals[0].studentName} 학생부터 예정 등원시간이 지나도 아직 입실하지 않았습니다.`,
              meta: teacherNoShowSignals[0].routineExpectedArrivalTime
                ? `예정 등원 ${teacherNoShowSignals[0].routineExpectedArrivalTime}`
                : '예정 시간 미등록',
              tone: 'rose' as const,
              onClick: () => openTeacherAttendanceSignalDetails(teacherNoShowSignals[0]),
            }
          : null,
        teacherLateSignals.length > 0
          ? {
              key: 'queue-late',
              label: '지각',
              title: `지각 학생 ${teacherLateSignals.length}명`,
              detail: `${teacherLateSignals[0].studentName} 학생부터 지각 입실 이후 수업 흐름을 확인하세요.`,
              meta: teacherLateSignals[0].checkedAtLabel ? `입실 ${teacherLateSignals[0].checkedAtLabel}` : '입실 시간 확인 필요',
              tone: 'orange' as const,
              onClick: () => openTeacherAttendanceSignalDetails(teacherLateSignals[0]),
            }
          : null,
        teacherCounselingTrackOverview.consultationCount > 0
          ? {
              key: 'queue-consultation',
              label: '상담 문의/예약',
              title: `상담 문의·예약 대기 ${teacherCounselingTrackOverview.consultationCount}건`,
              detail: `${teacherCounselingTrackOverview.consultationInbox[0]?.studentName || '학생'} 상담 흐름부터 바로 열어 확인할 수 있습니다.`,
              meta: teacherCounselingTrackOverview.consultationInbox[0]?.timeLabel || '최근 접수 순',
              tone: 'violet' as const,
              onClick: () => openCounselTrackDialog('reservations'),
            }
          : null,
        teacherCounselingTrackOverview.wifiCount > 0
          ? {
              key: 'queue-wifi',
              label: '방화벽 요청',
              title: `방화벽 요청 ${teacherCounselingTrackOverview.wifiCount}건`,
              detail: `${teacherCounselingTrackOverview.wifiRequests[0]?.studentName || '학생'} 요청부터 접속 사유를 확인할 수 있습니다.`,
              meta: teacherCounselingTrackOverview.wifiRequests[0]?.timeLabel || '최근 요청 순',
              tone: 'amber' as const,
              onClick: () => openCounselTrackDialog('inquiries'),
            }
          : null,
        teacherCounselingTrackOverview.parentRequestCount > 0
          ? {
              key: 'queue-parent-request',
              label: '학부모 문의',
              title: `학부모 문의 ${teacherCounselingTrackOverview.parentRequestCount}건`,
              detail: `${teacherCounselingTrackOverview.parentRequests[0]?.studentName || '학생'} 관련 요청부터 바로 열어볼 수 있습니다.`,
              meta: teacherCounselingTrackOverview.parentRequests[0]?.timeLabel || '최근 접수 순',
              tone: 'teal' as const,
              onClick: () => openCounselTrackDialog('parent'),
            }
          : null,
      ].filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [teacherCounselingTrackOverview, teacherLateSignals, teacherNoShowSignals]
  );
  useEffect(() => {
    if (
      heroPriorityExpandedKey &&
      !teacherOperationsInboxQueueItems.some((item) => item.key === heroPriorityExpandedKey)
    ) {
      setHeroPriorityExpandedKey(null);
    }
  }, [heroPriorityExpandedKey, teacherOperationsInboxQueueItems]);
  const teacherOperationsInboxPanels = useMemo<OperationsInboxPanel[]>(
    () => [
      {
        key: 'panel-no-show',
        label: '출결',
        title: '연락 필요 미입실',
        count: teacherNoShowSignals.length,
        emptyLabel: '예정 등원시간을 넘긴 미입실 학생이 없습니다.',
        tone: 'rose' as const,
        rows: teacherNoShowSignals.slice(0, 3).map((signal) => ({
          key: `no-show-${signal.seatId}`,
          title: signal.studentName,
          detail: signal.note || '예정 등원시간이 지났지만 아직 입실 증거가 없습니다.',
          meta: signal.routineExpectedArrivalTime ? `예정 ${signal.routineExpectedArrivalTime}` : '예정 시간 미등록',
          badge:
            signal.roomId && signal.roomSeatNo
              ? formatSeatLabel(
                  { roomId: signal.roomId, roomSeatNo: signal.roomSeatNo, seatId: signal.seatId },
                  roomConfigs,
                  '좌석 미배정',
                  persistedSeatLabelsBySeatId
                )
              : '좌석 미배정',
          tone: 'rose' as const,
          onClick: () => openTeacherAttendanceSignalDetails(signal),
        })),
        onOpenAll: teacherNoShowSignals.length > 0 ? () => setIsHeroPriorityDialogOpen(true) : undefined,
      },
      {
        key: 'panel-late',
        label: '출결',
        title: '지각',
        count: teacherLateSignals.length,
        emptyLabel: '오늘 지각 학생이 없습니다.',
        tone: 'orange' as const,
        rows: teacherLateSignals.slice(0, 3).map((signal) => ({
          key: `late-${signal.seatId}`,
          title: signal.studentName,
          detail: signal.note || '지각 입실 이후 상태를 다시 확인할 필요가 있습니다.',
          meta: signal.checkedAtLabel ? `입실 ${signal.checkedAtLabel}` : '입실 시간 확인 필요',
          badge:
            signal.roomId && signal.roomSeatNo
              ? formatSeatLabel(
                  { roomId: signal.roomId, roomSeatNo: signal.roomSeatNo, seatId: signal.seatId },
                  roomConfigs,
                  '좌석 미배정',
                  persistedSeatLabelsBySeatId
                )
              : '좌석 미배정',
          tone: 'orange' as const,
          onClick: () => openTeacherAttendanceSignalDetails(signal),
        })),
        onOpenAll: teacherLateSignals.length > 0 ? () => setIsHeroPriorityDialogOpen(true) : undefined,
      },
      {
        key: 'panel-consultation',
        label: '상담',
        title: '상담 문의/예약',
        count: teacherCounselingTrackOverview.consultationCount,
        emptyLabel: '열린 상담 문의나 예약 대기가 없습니다.',
        tone: 'violet' as const,
        rows: teacherCounselingTrackOverview.consultationInbox.map((item) => ({
          key: item.id,
          title: item.studentName,
          detail: item.preview,
          meta: item.timeLabel,
          badge: item.badge,
          tone: item.tone,
          onClick: () => openCounselTrackDialog(item.targetTab),
        })),
        onOpenAll:
          teacherCounselingTrackOverview.consultationCount > 0
            ? () => openCounselTrackDialog('reservations')
            : undefined,
      },
      {
        key: 'panel-wifi',
        label: '요청',
        title: '방화벽 요청',
        count: teacherCounselingTrackOverview.wifiCount,
        emptyLabel: '열린 방화벽 요청이 없습니다.',
        tone: 'amber' as const,
        rows: teacherCounselingTrackOverview.wifiRequests.map((item) => ({
          key: item.id,
          title: item.studentName,
          detail: item.requestedUrl ? `${item.requestedUrl} · ${item.preview}` : item.preview,
          meta: item.timeLabel,
          badge: item.badge,
          tone: item.tone,
          onClick: () => openCounselTrackDialog(item.targetTab),
        })),
        onOpenAll:
          teacherCounselingTrackOverview.wifiCount > 0
            ? () => openCounselTrackDialog('inquiries')
            : undefined,
      },
      {
        key: 'panel-parent-request',
        label: '학부모',
        title: '학부모 문의',
        count: teacherCounselingTrackOverview.parentRequestCount,
        emptyLabel: '열린 학부모 문의가 없습니다.',
        tone: 'teal' as const,
        rows: teacherCounselingTrackOverview.parentRequests.map((item) => ({
          key: item.id,
          title: item.parentName ? `${item.studentName} · ${item.parentName}` : item.studentName,
          detail: item.preview,
          meta: item.timeLabel,
          badge: item.badge,
          tone: item.tone,
          onClick: () => openCounselTrackDialog(item.targetTab),
        })),
        onOpenAll:
          teacherCounselingTrackOverview.parentRequestCount > 0
            ? () => openCounselTrackDialog('parent')
            : undefined,
      },
    ],
    [persistedSeatLabelsBySeatId, roomConfigs, teacherCounselingTrackOverview, teacherLateSignals, teacherNoShowSignals]
  );

  const renderHeroPriorityAttendanceDetail = (
    signals: CenterAdminAttendanceSeatSignal[],
    emptyLabel: string,
    tone: 'rose' | 'orange'
  ) => {
    const isRose = tone === 'rose';

    return (
      <div
        className={cn(
          'mt-4 rounded-[1.35rem] border p-3',
          isRose ? 'border-rose-100 bg-rose-50/50' : 'border-[#FFD7BA] bg-[#FFF8F2]'
        )}
      >
        {signals.length === 0 ? (
          <div className="rounded-[1.1rem] border border-dashed border-[#DCE7FF] bg-white px-4 py-6 text-center text-xs font-bold text-[#5c6e97]">
            {emptyLabel}
          </div>
        ) : (
          <div className="grid gap-2">
            {signals.map((signal) => {
              const isSessionAdjusting = quickSessionAdjustingStudentId === signal.studentId;
              const seatLabel =
                signal.roomId && signal.roomSeatNo
                  ? formatSeatLabel(
                      { roomId: signal.roomId, roomSeatNo: signal.roomSeatNo, seatId: signal.seatId },
                      roomConfigs,
                      '좌석 미배정',
                      persistedSeatLabelsBySeatId
                    )
                  : '좌석 미배정';
              const timeChips = [
                signal.boardLabel,
                signal.wasLateToday ? '오늘 지각 O' : null,
                signal.firstCheckInLabel ? `최초 입실 ${signal.firstCheckInLabel}` : null,
                signal.lastCheckOutLabel ? `마지막 퇴실 ${signal.lastCheckOutLabel}` : null,
                signal.todayStudyLabel ? `오늘 ${signal.todayStudyLabel}` : null,
              ].filter((chip): chip is string => Boolean(chip));

              return (
                <div key={`${signal.studentId}-${signal.seatId}`} className="rounded-[1.1rem] border border-[#DCE7FF] bg-white px-3.5 py-3.5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={cn(
                            'h-6 rounded-full border-none px-2.5 text-[10px] font-black',
                            isRose ? 'bg-rose-100 text-rose-700' : 'bg-[#FFF1E6] text-[#C95A08]'
                          )}
                        >
                          {seatLabel}
                        </Badge>
                        {signal.className ? (
                          <Badge className="h-6 rounded-full border-none bg-[#F7FAFF] px-2.5 text-[10px] font-black text-[#14295F]">
                            {signal.className}
                          </Badge>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="mt-2 text-left text-sm font-black text-[#14295F] underline-offset-4 hover:underline"
                        onClick={() => openTeacherAttendanceSignalDetails(signal)}
                      >
                        {signal.studentName}
                      </button>
                      <p className="mt-1 text-[11px] font-bold leading-5 text-[#5c6e97]">
                        {signal.note || emptyLabel}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {timeChips.map((chip) => (
                          <span
                            key={chip}
                            className="rounded-full border border-[#E4ECFF] bg-[#F7FAFF] px-2 py-1 text-[10px] font-black text-[#5c6e97]"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      {canAdjustStudySession ? (
                        <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-[#DCE7FF] bg-[#F7FAFF] p-1">
                          <span className="flex items-center gap-1 px-2 text-[10px] font-black text-[#14295F]">
                            <Timer className="h-3.5 w-3.5 text-[#2554D7]" />
                            몰입세션
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-full border-[#DCE7FF] bg-white px-2.5 text-[10px] font-black text-[#14295F] hover:border-[#FF7A16]/24 hover:text-[#C95A08]"
                            disabled={isSessionAdjusting || signal.todayStudyMinutes <= 0}
                            onClick={() => handleQuickStudySessionAdjustment(signal, -5)}
                          >
                            {isSessionAdjusting ? <Loader2 className="h-3 w-3 animate-spin" /> : '-5분'}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 rounded-full bg-[#14295F] px-2.5 text-[10px] font-black text-white hover:bg-[#10224C]"
                            disabled={isSessionAdjusting}
                            onClick={() => handleQuickStudySessionAdjustment(signal, 5)}
                          >
                            {isSessionAdjusting ? <Loader2 className="h-3 w-3 animate-spin" /> : '+5분'}
                          </Button>
                        </div>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full border-[#DCE7FF] bg-white px-3 text-[10px] font-black text-[#14295F] hover:border-[#FF7A16]/24 hover:text-[#C95A08]"
                        onClick={() => {
                          setIsHeroPriorityDialogOpen(false);
                          openTeacherAttendanceSignal(signal);
                        }}
                      >
                        교실에서 보기
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const getHeroPriorityCounselTab = (key: string): DashboardCounselTrackTab | null => {
    if (key === 'queue-consultation') return 'reservations';
    if (key === 'queue-wifi') return 'inquiries';
    if (key === 'queue-parent-request') return 'parent';
    return null;
  };

  const renderHeroPriorityInlineDetail = (item: OperationsInboxQueueItem) => {
    if (item.key === 'queue-no-show') {
      return renderHeroPriorityAttendanceDetail(
        teacherNoShowSignals,
        '예정 등원시간을 넘긴 미입실 학생이 없습니다.',
        'rose'
      );
    }

    if (item.key === 'queue-late') {
      return renderHeroPriorityAttendanceDetail(teacherLateSignals, '오늘 지각 학생이 없습니다.', 'orange');
    }

    const counselTab = getHeroPriorityCounselTab(item.key);
    if (counselTab) {
      return (
        <div className="mt-4 overflow-hidden rounded-[1.35rem] border border-[#DCE7FF] bg-white shadow-[0_14px_28px_-28px_rgba(20,41,95,0.18)]">
          <div className="max-h-[58vh] overflow-y-auto">
            <AppointmentsPageContent forceTab={counselTab} />
          </div>
        </div>
      );
    }

    return null;
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
            onClick: () => {
              if (latestUnreadRecentReport) {
                setSelectedRecentReport(latestUnreadRecentReport);
                return;
              }
              scrollToSection(reportsSectionRef);
            },
          }
        : null,
    ].filter((item): item is NonNullable<typeof item> => Boolean(item));

    // Keep the home preview filled through 3 priorities so the desktop deck
    // always shows rank 1-3 even when only one or two urgent signals exist.
    if (
      items.length < 3
      && pendingAppointments.length === 0
      && upcomingConfirmedAppointments.length === 0
    ) {
      items.push({
        key: 'counseling-overview',
        title: appointments.length > 0 ? `오늘 상담 ${appointments.length}건 점검` : '오늘 상담 흐름 확인',
        detail: appointments.length > 0
          ? '요청 대기는 없지만 오늘 상담 일정과 기록 흐름을 한 번 더 확인하세요.'
          : '오늘 상담 요청은 없지만 상담 현황과 상담일지를 짧게 점검해 두세요.',
        actionLabel: '상담 현황',
        icon: MessageSquare,
        toneClass: 'bg-[#EEF4FF] text-[#2554D7]',
        onClick: () => scrollToSection(appointmentsSectionRef),
      });
    }

    if (
      items.length < 3
      && attendanceBoardSummary.lateOrAbsentCount === 0
      && attendanceBoardSummary.longAwayCount === 0
    ) {
      items.push({
        key: 'attendance-overview',
        title: '실시간 교실 흐름 확인',
        detail: '이상 신호는 없지만 현재 좌석과 출결 흐름을 한 번 더 점검하세요.',
        actionLabel: '실시간 교실',
        icon: Armchair,
        toneClass: 'bg-[#EEF4FF] text-[#2554D7]',
        onClick: () => scrollToSection(liveBoardSectionRef),
      });
    }

    if (items.length < 3 && seatOverlaySummary.riskCount === 0) {
      items.push({
        key: 'risk-overview',
        title: '학생 히트맵 점검',
        detail: '위험 학생은 없지만 집중 흐름이 내려간 학생이 없는지 확인하세요.',
        actionLabel: '학생 히트맵',
        icon: ShieldAlert,
        toneClass: 'bg-[#EEF4FF] text-[#2554D7]',
        onClick: () => scrollToSection(seatInsightSectionRef),
      });
    }

    if (items.length < 3 && unreadReportCount === 0) {
      items.push({
        key: 'report-overview',
        title: '최근 리포트 후속 확인',
        detail: '미열람은 없지만 최근 발송 리포트의 후속 안내 필요 여부를 확인하세요.',
        actionLabel: '리포트 보기',
        icon: Eye,
        toneClass: 'bg-[#FFF2E8] text-[#C95A08]',
        onClick: () => scrollToSection(reportsSectionRef),
      });
    }

    return items.slice(0, 3);
  }, [
    appointments,
    attendanceBoardSummary.lateOrAbsentCount,
    attendanceBoardSummary.longAwayCount,
    latestUnreadRecentReport,
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

  const liveDateLabel = useMemo(
    () => format(new Date(now), 'M월 d일 (EEE)', { locale: ko }),
    [now]
  );
  const liveSyncLabel = useMemo(
    () => format(new Date(now), 'HH:mm:ss'),
    [now]
  );
  const currentTeacherScopeLabel = selectedClass === 'all' ? '센터 전체' : selectedClass;
  const classFilterOptions = useMemo(
    () => [
      { value: 'all', label: '센터 전체' },
      ...availableClasses.map((className) => ({ value: className, label: className })),
    ],
    [availableClasses]
  );
  const teacherCounselingSummary = useMemo(() => {
    const pendingCount = appointments.filter((apt) => apt.status === 'requested').length;
    const confirmedUpcomingCount = appointments.filter((apt) => {
      if (apt.status !== 'confirmed' || !apt.scheduledAt) return false;
      return apt.scheduledAt.toMillis() >= now;
    }).length;

    return {
      pendingCount,
      confirmedUpcomingCount,
      totalCount: appointments.length,
    };
  }, [appointments, now]);
  const teacherRiskCandidates = useMemo(
    () =>
      [...teacherSeatSignals]
        .filter((signal) => Boolean(signal.studentId))
        .sort((left, right) => {
          const healthDiff = left.compositeHealth - right.compositeHealth;
          if (healthDiff !== 0) return healthDiff;

          const awayDiff = (right.currentAwayMinutes || 0) - (left.currentAwayMinutes || 0);
          if (awayDiff !== 0) return awayDiff;

          return left.studentName.localeCompare(right.studentName, 'ko');
        })
        .slice(0, 4),
    [teacherSeatSignals]
  );
  const teacherHomeRoomRows = useMemo(() => roomSummaries.slice(0, 4), [roomSummaries]);
  const teacherHomeAlertCount = useMemo(
    () =>
      attendanceBoardSummary.lateOrAbsentCount +
      attendanceBoardSummary.longAwayCount +
      seatOverlaySummary.riskCount +
      teacherCounselingSummary.pendingCount,
    [
      attendanceBoardSummary.lateOrAbsentCount,
      attendanceBoardSummary.longAwayCount,
      seatOverlaySummary.riskCount,
      teacherCounselingSummary.pendingCount,
    ]
  );
  const teacherHomeActionSignalCount = useMemo(
    () => teacherOperationsInboxQueueItems.length,
    [teacherOperationsInboxQueueItems]
  );
  const teacherHomeStatusMeta = useMemo(() => {
    if (
      seatOverlaySummary.riskCount > 0 ||
      attendanceBoardSummary.lateOrAbsentCount > 0 ||
      teacherCounselingSummary.pendingCount > 0
    ) {
      return {
        label: '긴급',
        headline: '지금은 조치와 좌석 흐름을 먼저 잡아야 합니다.',
        detail: `위험 ${seatOverlaySummary.riskCount}명, 미입실·지각 ${attendanceBoardSummary.lateOrAbsentCount}명, 상담 승인 ${teacherCounselingSummary.pendingCount}건을 우선 확인하세요.`,
        badgeClass: 'border-[#FFB38A]/30 bg-[#FF7A16] text-white',
        dotClass: 'bg-[#FFB38A]',
      };
    }

    if (
      attendanceBoardSummary.longAwayCount > 0 ||
      unreadReportCount > 0 ||
      teacherHomeActionSignalCount > 0
    ) {
      return {
        label: '주의',
        headline: '큰 이상은 없지만 오늘 후속 확인이 남아 있습니다.',
        detail: `장기 외출 ${attendanceBoardSummary.longAwayCount}명, 미열람 리포트 ${unreadReportCount}건을 홈에서 바로 이어서 확인할 수 있습니다.`,
        badgeClass: 'border-amber-200/30 bg-amber-400/20 text-amber-100',
        dotClass: 'bg-amber-300',
      };
    }

    return {
      label: '안정',
      headline: '교실 흐름이 안정적으로 유지되고 있습니다.',
      detail: '출결, 좌석, 상담, 리포트 흐름에 즉시 조치가 필요한 신호가 없습니다.',
      badgeClass: 'border-emerald-200/25 bg-emerald-400/16 text-emerald-100',
      dotClass: 'bg-emerald-300',
    };
  }, [
    attendanceBoardSummary.lateOrAbsentCount,
    attendanceBoardSummary.longAwayCount,
    seatOverlaySummary.riskCount,
    teacherHomeActionSignalCount,
    teacherCounselingSummary.pendingCount,
    unreadReportCount,
  ]);
  const teacherHomeKpiCards = useMemo(
    () => [
      {
        key: 'studying',
        label: '학습 중',
        value: roomScopedKpi?.studying ?? stats.studying,
        unit: '명',
        caption: '현재 공부 상태',
        icon: Activity,
        tone: 'navy' as const,
        deltaLabel: currentTeacherScopeLabel,
        onClick: () => scrollToSection(liveBoardSectionRef),
      },
      {
        key: 'late-absent',
        label: '미입실·지각',
        value: attendanceBoardSummary.lateOrAbsentCount,
        unit: '명',
        caption: '출결 확인 우선',
        icon: AlertCircle,
        tone: attendanceBoardSummary.lateOrAbsentCount > 0 ? 'rose' as const : 'default' as const,
        deltaLabel: '오늘 출결 신호',
        onClick: () => scrollToSection(liveBoardSectionRef),
      },
      {
        key: 'away',
        label: '외출/휴식',
        value: roomScopedKpi?.away ?? stats.away,
        unit: '명',
        caption: `장기 외출 ${attendanceBoardSummary.longAwayCount}명`,
        icon: Clock,
        tone: attendanceBoardSummary.longAwayCount > 0 ? 'orange' as const : 'default' as const,
        deltaLabel: '자리 이탈 상태',
        onClick: () => scrollToSection(liveBoardSectionRef),
      },
      {
        key: 'risk',
        label: '위험 학생',
        value: seatOverlaySummary.riskCount,
        unit: '명',
        caption: '학생 히트맵 기준',
        icon: ShieldAlert,
        tone: seatOverlaySummary.riskCount > 0 ? 'rose' as const : 'emerald' as const,
        deltaLabel: `주의 ${seatOverlaySummary.warningCount}명`,
        onClick: () => scrollToSection(seatInsightSectionRef),
      },
      {
        key: 'total-minutes',
        label: '오늘 누적',
        value: formatDurationMinutes(stats.totalCenterMinutes),
        unit: '',
        caption: '실제 공부시간',
        icon: Timer,
        tone: 'blue' as const,
        deltaLabel: currentTeacherScopeLabel,
      },
      {
        key: 'average-minutes',
        label: '평균 학습',
        value: formatDurationMinutes(stats.avgMinutes),
        unit: '',
        caption: '현재 필터 평균',
        icon: Users,
        tone: 'default' as const,
        deltaLabel: `상위 20% ${formatDurationMinutes(stats.top20Avg)}`,
      },
      {
        key: 'unread-report',
        label: '리포트 미열람',
        value: unreadReportCount,
        unit: '건',
        caption: '최근 발송 기준',
        icon: Eye,
        tone: unreadReportCount > 0 ? 'orange' as const : 'default' as const,
        deltaLabel: latestUnreadRecentReport?.studentName || '후속 확인',
        onClick: () => {
          if (latestUnreadRecentReport) {
            setSelectedRecentReport(latestUnreadRecentReport);
            return;
          }
          scrollToSection(reportsSectionRef);
        },
      },
    ],
    [
      attendanceBoardSummary.lateOrAbsentCount,
      attendanceBoardSummary.longAwayCount,
      currentTeacherScopeLabel,
      latestUnreadRecentReport,
      roomScopedKpi?.away,
      roomScopedKpi?.studying,
      seatOverlaySummary.riskCount,
      seatOverlaySummary.warningCount,
      stats.away,
      stats.avgMinutes,
      stats.studying,
      stats.top20Avg,
      stats.totalCenterMinutes,
      unreadReportCount,
    ]
  );
  const teacherWorkbenchQuickActions = useMemo(
    () => [
      {
        label: '오늘 우선순위',
        icon: <ShieldAlert className="h-4 w-4" />,
        onClick: () => setIsHeroPriorityDialogOpen(true),
      },
      {
        label: '실시간 교실',
        icon: <LayoutGrid className="h-4 w-4" />,
        onClick: () => scrollToSection(liveBoardSectionRef),
      },
      {
        label: '학생 360',
        icon: <Users className="h-4 w-4" />,
        href: '/dashboard/teacher/students',
      },
      {
        label: '상담 현황',
        icon: <MessageSquare className="h-4 w-4" />,
        onClick: () => openCounselTrackDialog('reservations'),
      },
    ],
    [openCounselTrackDialog]
  );

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
        .filter(
          (seat) =>
            Boolean(seat.studentId) ||
            Boolean(seat.seatZone) ||
            Boolean(getManualSeatOccupantName(seat)) ||
            seat.type === 'aisle'
        )
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
  const selectedSeatManualOccupantName = useMemo(
    () => getManualSeatOccupantName(selectedSeat),
    [selectedSeat?.manualOccupantName]
  );
  const selectedSeatHasManualOccupant = useMemo(
    () => Boolean(selectedSeatManualOccupantName),
    [selectedSeatManualOccupantName]
  );
  const selectedSeatCanvasId = useMemo(
    () => getSeatCanvasId(selectedSeat),
    [selectedSeat?.id, selectedSeat?.roomId, selectedSeat?.roomSeatNo]
  );

  useEffect(() => {
    setManualSeatOccupantName(selectedSeatManualOccupantName);
  }, [selectedSeatCanvasId, selectedSeatManualOccupantName]);

  const selectedSeatDisplayLabel = useMemo(
    () => getSeatDisplayLabel(selectedSeat, persistedSeatLabelsBySeatId),
    [persistedSeatLabelsBySeatId, selectedSeat]
  );
  const selectedSeatDefaultLabel = selectedSeat?.roomSeatNo ? String(selectedSeat.roomSeatNo) : '';

  useEffect(() => {
    setSeatLabelDraft(selectedSeatDisplayLabel);
  }, [selectedSeatCanvasId, selectedSeatDisplayLabel]);

  const selectedSeatLabel = useMemo(
    () => formatSeatLabel(selectedSeat, roomConfigs, '좌석 미지정', persistedSeatLabelsBySeatId),
    [persistedSeatLabelsBySeatId, roomConfigs, selectedSeat]
  );
  const selectedSeatGenderPolicy = useMemo(
    () =>
      selectedSeat?.type === 'aisle'
        ? 'all'
        : normalizeSeatGenderPolicy(
            selectedSeat?.seatGenderPolicy || persistedSeatGenderBySeatId[selectedSeatCanvasId]
          ),
    [persistedSeatGenderBySeatId, selectedSeat?.seatGenderPolicy, selectedSeat?.type, selectedSeatCanvasId]
  );
  const selectedSeatGenderLabel = useMemo(
    () => (selectedSeat?.type === 'aisle' ? '성별 미사용' : getSeatGenderPolicyLabel(selectedSeatGenderPolicy)),
    [selectedSeat?.type, selectedSeatGenderPolicy]
  );
  const normalizedSeatLabelDraft = useMemo(
    () => normalizeSeatLabelValue(seatLabelDraft),
    [seatLabelDraft]
  );
  const seatNumberQuickOptions = useMemo(() => {
    const numericLabels = new Set<string>();
    const maxSeatCount = roomConfigs.reduce((max, room) => Math.max(max, room.rows * room.cols), 0);

    for (let index = 1; index <= maxSeatCount; index += 1) {
      numericLabels.add(String(index));
    }

    Object.values(persistedSeatLabelsBySeatId).forEach((label) => {
      const normalized = normalizeSeatLabelValue(label);
      if (/^\d+$/.test(normalized)) {
        numericLabels.add(normalized);
      }
    });

    if (/^\d+$/.test(selectedSeatDefaultLabel)) {
      numericLabels.add(selectedSeatDefaultLabel);
    }
    if (/^\d+$/.test(selectedSeatDisplayLabel)) {
      numericLabels.add(selectedSeatDisplayLabel);
    }

    return Array.from(numericLabels).sort((left, right) => Number(left) - Number(right));
  }, [persistedSeatLabelsBySeatId, roomConfigs, selectedSeatDefaultLabel, selectedSeatDisplayLabel]);
  const seatNumberQuickSelectValue = useMemo(() => {
    if (!normalizedSeatLabelDraft || normalizedSeatLabelDraft === selectedSeatDefaultLabel) {
      return '__empty__';
    }
    return /^\d+$/.test(normalizedSeatLabelDraft) ? normalizedSeatLabelDraft : '__custom__';
  }, [normalizedSeatLabelDraft, selectedSeatDefaultLabel]);
  const selectedSeatModeLabel = useMemo(
    () => (selectedSeat?.type === 'aisle' ? '통로 모드' : '좌석 모드'),
    [selectedSeat?.type]
  );
  const selectedSeatZoneLabel = useMemo(
    () => (selectedSeat?.type === 'aisle' ? '통로' : selectedSeat?.seatZone || '미정'),
    [selectedSeat?.seatZone, selectedSeat?.type]
  );
  const selectedSeatAssignmentLabel = useMemo(() => {
    if (selectedSeat?.type === 'aisle') return '학생 배정 활성화 필요';
    if (selectedSeatManualOccupantName) return '임시 사용중 좌석';
    if (selectedSeat?.studentId) return '현재 배정된 좌석';
    return '즉시 배정 가능';
  }, [selectedSeat?.studentId, selectedSeat?.type, selectedSeatManualOccupantName]);
  const selectedSeatAvailabilityCopy = useMemo(() => {
    if (selectedSeat?.type === 'aisle') {
      return '현재는 이동 동선 확보용 통로입니다. 필요하면 바로 좌석으로 다시 활성화해 학생 배정을 이어갈 수 있습니다.';
    }
    if (selectedSeatManualOccupantName) {
      return `${selectedSeatManualOccupantName} 이름으로 임시 사용중 처리된 좌석입니다.`;
    }
    if (selectedSeat?.studentId) {
      return '배정 정보가 연결된 좌석입니다.';
    }
    return '학생을 바로 연결할 수 있는 빈 좌석입니다.';
  }, [selectedSeat?.studentId, selectedSeat?.type, selectedSeatManualOccupantName]);
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
      seatSignalsBySeatId.get(selectedSeatCanvasId) ||
      seatSignalsBySeatId.get(selectedSeat.id) ||
      (selectedSeat.studentId ? studentSignalsByStudentId.get(selectedSeat.studentId) || null : null)
    );
  }, [selectedSeat, selectedSeatCanvasId, seatSignalsBySeatId, studentSignalsByStudentId]);

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

  useEffect(() => {
    setIsSeatSecondaryExpanded(false);
  }, [selectedSeatCanvasId]);

  const selectedAttendanceSignal = useMemo<CenterAdminAttendanceSeatSignal | null>(() => {
    if (!selectedSeat) return null;
    return (
      attendanceSeatSignalsBySeatId.get(selectedSeatCanvasId) ||
      attendanceSeatSignalsBySeatId.get(selectedSeat.id) ||
      (selectedSeat.studentId ? attendanceSeatSignalsByStudentId.get(selectedSeat.studentId) || null : null)
    );
  }, [attendanceSeatSignalsBySeatId, attendanceSeatSignalsByStudentId, selectedSeat, selectedSeatCanvasId]);

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

  const syncRoomLayoutBatch = (
    batch: ReturnType<typeof writeBatch>,
    roomId: string,
    nextRooms: LayoutRoomConfig[],
    nextAisleSeatIds: string[]
  ) => {
    if (!firestore || !centerId) return;
    const safeFirestore = firestore;
    const safeCenterId = centerId;
    const nextAisleSeatIdSet = new Set(nextAisleSeatIds);
    const roomConfig = nextRooms.find((room) => room.id === roomId);
    if (!roomConfig) return;

    const roomSeatsToNormalize = resolvedAttendanceList.filter(
      (seat) => seat.roomId === roomId && seat.roomSeatNo > 0 && seat.roomSeatNo <= roomConfig.rows * roomConfig.cols
    );

    roomSeatsToNormalize.forEach((seat) => {
      const canonicalSeatId = buildSeatId(roomId, seat.roomSeatNo);
      if (!canonicalSeatId) return;

      const normalizedType = nextAisleSeatIdSet.has(canonicalSeatId) ? 'aisle' : 'seat';
      const manualOccupantName = getManualSeatOccupantName(seat);
      const studentId = typeof seat.studentId === 'string' ? seat.studentId.trim() : '';
      const canonicalSeatRef = doc(safeFirestore, 'centers', safeCenterId, 'attendanceCurrent', canonicalSeatId);

      batch.set(
        canonicalSeatRef,
        {
          seatNo: getGlobalSeatNo(roomId, seat.roomSeatNo),
          roomId,
          roomSeatNo: seat.roomSeatNo,
          seatLabel: seat.seatLabel ?? deleteField(),
          seatGenderPolicy:
            normalizedType === 'aisle' || normalizeSeatGenderPolicy(seat.seatGenderPolicy) === 'all'
              ? deleteField()
              : normalizeSeatGenderPolicy(seat.seatGenderPolicy),
          type: normalizedType,
          studentId: normalizedType === 'aisle' ? null : studentId || null,
          manualOccupantName:
            normalizedType === 'aisle' || !manualOccupantName ? deleteField() : manualOccupantName,
          seatZone: normalizedType === 'aisle' ? deleteField() : seat.seatZone || null,
          status: normalizedType === 'aisle' ? 'absent' : seat.status || 'absent',
          lastCheckInAt:
            normalizedType === 'aisle' || !seat.lastCheckInAt ? deleteField() : seat.lastCheckInAt,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const legacySeatDocId = getLegacySeatDocId(seat);
      if (legacySeatDocId) {
        batch.delete(doc(safeFirestore, 'centers', safeCenterId, 'attendanceCurrent', legacySeatDocId));
      }

      if (!studentId || !studentsById.has(studentId)) return;

      if (normalizedType === 'aisle') {
        batch.update(doc(safeFirestore, 'centers', safeCenterId, 'students', studentId), {
          seatNo: 0,
          seatId: deleteField(),
          roomId: deleteField(),
          roomSeatNo: deleteField(),
          seatLabel: deleteField(),
          seatZone: deleteField(),
          updatedAt: serverTimestamp(),
        });
        return;
      }

      batch.update(doc(safeFirestore, 'centers', safeCenterId, 'students', studentId), {
        seatNo: getGlobalSeatNo(roomId, seat.roomSeatNo),
        seatId: canonicalSeatId,
        roomId,
        roomSeatNo: seat.roomSeatNo,
        seatLabel: seat.seatLabel ?? deleteField(),
        seatZone: seat.seatZone || null,
        updatedAt: serverTimestamp(),
      });
    });
  };

  const handlePersistCurrentRoomLayout = async (roomId: string) => {
    if (!firestore || !centerId) return;

    const roomConfig = roomConfigs.find((room) => room.id === roomId);
    if (!roomConfig) return;

    const nextRooms = roomConfigs.map((room) => ({ ...room }));
    const nextMaxCells = roomConfig.rows * roomConfig.cols;
    const nextAisleSeatIds = effectiveAisleSeatIds.filter((seatId) => {
      const parsed = parseSeatId(seatId);
      if (!parsed) return false;
      if (parsed.roomId !== roomId) return true;
      return parsed.roomSeatNo <= nextMaxCells;
    });
    const nextSeatLabelsBySeatId = filterSeatLabelsByRooms(nextRooms);
    const nextSeatGenderBySeatId = filterSeatGenderByRooms(nextRooms);

    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      batch.set(
        doc(firestore, 'centers', centerId),
        {
          layoutSettings: {
            aisleSeatIds: nextAisleSeatIds,
            seatLabelsBySeatId: nextSeatLabelsBySeatId,
            seatGenderBySeatId: nextSeatGenderBySeatId,
            rows: nextRooms[0]?.rows ?? roomConfig.rows,
            cols: nextRooms[0]?.cols ?? roomConfig.cols,
            rooms: nextRooms,
            updatedAt: serverTimestamp(),
          },
        },
        { merge: true }
      );
      syncRoomLayoutBatch(batch, roomId, nextRooms, nextAisleSeatIds);
      setOptimisticAisleSeatIds(nextAisleSeatIds);
      await batch.commit();

      toast({
        title: `${getRoomLabel(roomId, roomConfigs)} 도면을 다시 저장했습니다.`,
        description: '현재 보이는 가로·세로, 통로, 좌석 연결 상태를 한 번 더 기준값으로 맞췄습니다.',
      });
    } catch (error) {
      setOptimisticAisleSeatIds(null);
      toast({ variant: 'destructive', title: '도면 저장 실패' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRoomSettings = async (roomId: string) => {
    if (!firestore || !centerId) return;

    const roomDraft = roomDrafts[roomId];
    const persistedRoom = persistedRoomMap.get(roomId);
    if (!roomDraft || !persistedRoom) return;

    const conflicts = roomResizeConflicts.get(roomId) || [];
    const nextMaxCells = roomDraft.rows * roomDraft.cols;

    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const nextRooms = persistedRooms.map((room) =>
        room.id === roomId
          ? {
              ...room,
              rows: roomDraft.rows,
              cols: roomDraft.cols,
            }
          : room
      );
      const nextAisleSeatIds = effectiveAisleSeatIds.filter((seatId) => {
        const parsed = parseSeatId(seatId);
        if (!parsed) return false;
        if (parsed.roomId !== roomId) return true;
        return parsed.roomSeatNo <= nextMaxCells;
      });

      conflicts.forEach((seat) => {
        const assignedStudentId = typeof seat.studentId === 'string' ? seat.studentId.trim() : '';
        if (assignedStudentId && studentsById.has(assignedStudentId)) {
          batch.update(doc(firestore, 'centers', centerId, 'students', assignedStudentId), {
            seatNo: 0,
            seatId: deleteField(),
            roomId: deleteField(),
            roomSeatNo: deleteField(),
            seatLabel: deleteField(),
            seatZone: deleteField(),
            updatedAt: serverTimestamp(),
          });
        }

        batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', seat.id));
        const legacySeatDocId = getLegacySeatDocId(seat);
        if (legacySeatDocId) {
          batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', legacySeatDocId));
        }
      });

      const nextSeatLabelsBySeatId = filterSeatLabelsByRooms(nextRooms);
      const nextSeatGenderBySeatId = filterSeatGenderByRooms(nextRooms);
      syncRoomLayoutBatch(batch, roomId, nextRooms, nextAisleSeatIds);

      batch.set(
        doc(firestore, 'centers', centerId),
        {
          layoutSettings: {
            aisleSeatIds: nextAisleSeatIds,
            seatLabelsBySeatId: nextSeatLabelsBySeatId,
            seatGenderBySeatId: nextSeatGenderBySeatId,
            rows: nextRooms[0]?.rows ?? roomDraft.rows,
            cols: nextRooms[0]?.cols ?? roomDraft.cols,
            rooms: nextRooms,
            updatedAt: serverTimestamp(),
          },
        },
        { merge: true }
      );
      batch.update(doc(firestore, 'centers', centerId), {
        'layoutSettings.seatLabelsBySeatId': nextSeatLabelsBySeatId,
        'layoutSettings.seatGenderBySeatId': nextSeatGenderBySeatId,
      });
      setOptimisticAisleSeatIds(nextAisleSeatIds);
      await batch.commit();

      if (selectedSeat?.roomId === roomId && (selectedSeat.roomSeatNo ?? 0) > nextMaxCells) {
        setSelectedSeat(null);
        setIsManaging(false);
        setIsAssigning(false);
        setManualSeatOccupantName('');
      }

      const cleanedSeatPreview = conflicts
        .slice(0, 2)
        .map((seat) => formatSeatLabel(seat, roomConfigs, '좌석 미지정', persistedSeatLabelsBySeatId))
        .join(', ');

      toast({
        title: `${getRoomLabel(roomId, roomConfigs)} 도면이 저장되었습니다.`,
        description:
          conflicts.length > 0
            ? conflicts.length > 2
              ? `${roomDraft.cols} x ${roomDraft.rows} 구조로 반영하고 ${cleanedSeatPreview} 외 ${conflicts.length - 2}개 셀 설정을 함께 정리했습니다.`
              : `${roomDraft.cols} x ${roomDraft.rows} 구조로 반영하고 ${cleanedSeatPreview} 셀 설정을 함께 정리했습니다.`
            : `${roomDraft.cols} x ${roomDraft.rows} 구조로 반영했습니다.`,
      });
    } catch (error) {
      setOptimisticAisleSeatIds(null);
      toast({ variant: 'destructive', title: '도면 저장 실패' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!firestore || !centerId) return;

    const targetRoom = persistedRoomMap.get(roomId);
    if (!targetRoom) return;
    if (roomId === PRIMARY_ROOM_ID || persistedRooms.length <= 1) {
      toast({
        variant: 'destructive',
        title: '기본 호실은 삭제할 수 없습니다.',
        description: '1호실은 최소 한 개는 유지되어야 합니다.',
      });
      return;
    }

    const assignedStudents = (students || []).filter((student) => {
      const identity = resolveSeatIdentity(student);
      return identity.roomId === roomId && identity.roomSeatNo > 0;
    });
    const occupiedSeats = resolvedAttendanceList.filter(
      (seat) => seat.roomId === roomId && (Boolean(seat.studentId) || Boolean(getManualSeatOccupantName(seat)))
    );

    if (assignedStudents.length > 0 || occupiedSeats.length > 0) {
      const previewNames = Array.from(
        new Set(
          [
            ...assignedStudents.map((student) => student.name).filter(Boolean),
            ...occupiedSeats
              .map((seat) => getManualSeatOccupantName(seat))
              .filter(Boolean),
          ]
        )
      )
        .slice(0, 3)
        .join(', ');

      toast({
        variant: 'destructive',
        title: `${targetRoom.name}에는 아직 사용 중 좌석이 있습니다.`,
        description: previewNames
          ? `${previewNames} 좌석을 먼저 비운 뒤 다시 삭제해 주세요.`
          : '배정 또는 임시 사용중 좌석을 먼저 정리해 주세요.',
      });
      return;
    }

    if (!window.confirm(`${targetRoom.name}을(를) 삭제할까요? 비어 있는 좌석 설정과 통로 설정도 함께 정리됩니다.`)) {
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      resolvedAttendanceList
        .filter((seat) => seat.roomId === roomId)
        .forEach((seat) => {
          batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', seat.id));
          const legacySeatDocId = getLegacySeatDocId(seat);
          if (legacySeatDocId) {
            batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', legacySeatDocId));
          }
        });

      const nextRooms = persistedRooms
        .filter((room) => room.id !== roomId)
        .map((room, index) => ({
          ...room,
          order: index + 1,
        }));
      const nextAisleSeatIds = effectiveAisleSeatIds.filter((seatId) => parseSeatId(seatId)?.roomId !== roomId);
      const nextSeatLabelsBySeatId = filterSeatLabelsByRooms(nextRooms);
      const nextSeatGenderBySeatId = filterSeatGenderByRooms(nextRooms);

      batch.set(
        doc(firestore, 'centers', centerId),
        {
          layoutSettings: {
            aisleSeatIds: nextAisleSeatIds,
            seatLabelsBySeatId: nextSeatLabelsBySeatId,
            seatGenderBySeatId: nextSeatGenderBySeatId,
            rows: nextRooms[0]?.rows ?? targetRoom.rows,
            cols: nextRooms[0]?.cols ?? targetRoom.cols,
            rooms: nextRooms,
            updatedAt: serverTimestamp(),
          },
        },
        { merge: true }
      );
      batch.update(doc(firestore, 'centers', centerId), {
        'layoutSettings.seatLabelsBySeatId': nextSeatLabelsBySeatId,
        'layoutSettings.seatGenderBySeatId': nextSeatGenderBySeatId,
      });

      setOptimisticAisleSeatIds(nextAisleSeatIds);
      await batch.commit();

      setRoomDrafts((prev) => {
        const next = { ...prev };
        delete next[roomId];
        return next;
      });
      setSelectedRoomView(nextRooms[0]?.id ?? 'all');

      toast({
        title: `${targetRoom.name}을 삭제했습니다.`,
        description: '사용하지 않는 호실 배치를 정리했습니다.',
      });
    } catch (error) {
      setOptimisticAisleSeatIds(null);
      toast({ variant: 'destructive', title: '호실 삭제 실패' });
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
    const seatCanvasId = getSeatCanvasId(seat);
    const normalizedSeat: ResolvedAttendanceSeat = {
      ...seat,
      roomId: seat.roomId || PRIMARY_ROOM_ID,
      roomSeatNo: Number(seat.roomSeatNo || 0),
      seatGenderPolicy: normalizeSeatGenderPolicy(persistedSeatGenderBySeatId[seatCanvasId]),
      type: effectiveAisleSeatIdSet.has(seatCanvasId) ? 'aisle' : 'seat',
    };
    setSelectedSeat(normalizedSeat);
    if (isEditMode) {
      setIsManaging(false);
      setIsAssigning(false);
      if (normalizedSeat.studentId) {
        fetchStudentDetails(normalizedSeat.studentId);
      }
      scrollToSection(seatInsightSectionRef);
      return;
    }

    if (normalizedSeat.studentId && normalizedSeat.type !== 'aisle') {
      setIsManaging(true);
      fetchStudentDetails(normalizedSeat.studentId);
    }
  };

  const handleEditModeSaveClick = (roomId: string) => {
    if (selectedRoomSummary?.hasUnsavedChanges) {
      void handleSaveRoomSettings(roomId);
      return;
    }
    void handlePersistCurrentRoomLayout(roomId);
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
      const legacySeatDocId = getLegacySeatDocId(selectedSeat);
      const prevStatus = selectedSeat.status;
      const nowDate = new Date();
      const todayDateKey = format(nowDate, 'yyyy-MM-dd');

      // 퇴실 처리 시 공부 시간 강제 저장 로직
      if (prevStatus === 'studying' && nextStatus !== 'studying' && selectedSeat.lastCheckInAt) {
        const nowTs = Date.now();
        const startTime = selectedSeat.lastCheckInAt.toMillis();
        const sessionDateKey = format(selectedSeat.lastCheckInAt.toDate(), 'yyyy-MM-dd');
        const sessionSeconds = Math.max(0, Math.floor((nowTs - startTime) / 1000));
        const sessionMinutes = Math.min(MAX_STUDY_SESSION_MINUTES, Math.max(1, Math.ceil(sessionSeconds / 60)));

        if (sessionSeconds > 0) {
          const logRef = doc(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', sessionDateKey);
          batch.set(logRef, { studentId, centerId, dateKey: sessionDateKey, totalMinutes: increment(sessionMinutes), updatedAt: serverTimestamp() }, { merge: true });

          const statRef = doc(firestore, 'centers', centerId, 'dailyStudentStats', sessionDateKey, 'students', studentId);
          batch.set(
            statRef,
            {
              studentId,
              centerId,
              dateKey: sessionDateKey,
              totalStudyMinutes: increment(sessionMinutes),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );

          const sessionRef = doc(collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', sessionDateKey, 'sessions'));
          batch.set(sessionRef, { startTime: selectedSeat.lastCheckInAt, endTime: Timestamp.fromMillis(nowTs), durationMinutes: sessionMinutes, createdAt: serverTimestamp() });

          const progressRef = doc(firestore, 'centers', centerId, 'growthProgress', studentId);
          const progressUpdate: Record<string, any> = {
            stats: {
              focus: increment((sessionMinutes / 60) * 0.1),
            },
            updatedAt: serverTimestamp(),
          };
          batch.set(progressRef, progressUpdate, { merge: true });
        }
      }

      const updateData: any = {
        studentId,
        seatNo: selectedSeat.seatNo,
        roomId: selectedSeat.roomId,
        roomSeatNo: selectedSeat.roomSeatNo,
        type: selectedSeat.type || 'seat',
        status: nextStatus,
        updatedAt: serverTimestamp(),
        ...(nextStatus === 'studying' ? { lastCheckInAt: serverTimestamp() } : {})
      };

      batch.set(seatRef, updateData, { merge: true });
      if (legacySeatDocId) {
        batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', legacySeatDocId));
      }

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

  const handleSaveSeatLabel = async () => {
    if (!firestore || !centerId || !selectedSeat) return;

    const roomSeatNo = Number(selectedSeat.roomSeatNo || 0);
    if (!Number.isFinite(roomSeatNo) || roomSeatNo <= 0) return;

    const seatId = buildSeatId(selectedSeat.roomId || PRIMARY_ROOM_ID, roomSeatNo);
    if (!seatId) return;

    const normalizedDraft = normalizeSeatLabelValue(seatLabelDraft);
    const nextCustomSeatLabel =
      normalizedDraft && normalizedDraft !== String(roomSeatNo) ? normalizedDraft : '';
    const currentCustomSeatLabel =
      normalizeSeatLabelValue(persistedSeatLabelsBySeatId[seatId]) ||
      normalizeSeatLabelValue(selectedSeat.seatLabel);

    if (nextCustomSeatLabel === currentCustomSeatLabel) {
      toast({
        title: nextCustomSeatLabel ? '같은 좌석 번호가 이미 적용되어 있습니다.' : '기본 좌석 번호로 이미 설정되어 있습니다.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const legacySeatDocId = getLegacySeatDocId(selectedSeat);
      const nextSeatLabelsBySeatId = { ...persistedSeatLabelsBySeatId };

      if (nextCustomSeatLabel) {
        nextSeatLabelsBySeatId[seatId] = nextCustomSeatLabel;
      } else {
        delete nextSeatLabelsBySeatId[seatId];
      }

      batch.update(doc(firestore, 'centers', centerId), {
        'layoutSettings.seatLabelsBySeatId': nextSeatLabelsBySeatId,
        'layoutSettings.updatedAt': serverTimestamp(),
      });

      const hasSeatDocument = resolvedAttendanceList.some((seat) => seat.id === selectedSeat.id);
      const seatLabelFieldValue = nextCustomSeatLabel || deleteField();

      if (
        hasSeatDocument ||
        selectedSeat.studentId ||
        selectedSeat.type === 'aisle' ||
        selectedSeat.seatZone ||
        getManualSeatOccupantName(selectedSeat)
      ) {
        batch.set(
          doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id),
          {
            seatNo: selectedSeat.seatNo,
            roomId: selectedSeat.roomId,
            roomSeatNo: selectedSeat.roomSeatNo,
            seatLabel: seatLabelFieldValue,
            seatGenderPolicy:
              selectedSeat.type === 'aisle' || selectedSeatGenderPolicy === 'all'
                ? deleteField()
                : selectedSeatGenderPolicy,
            type: selectedSeat.type || 'seat',
            status: selectedSeat.status || 'absent',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      if (legacySeatDocId) {
        batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', legacySeatDocId));
      }

      if (selectedSeat.studentId) {
        batch.update(doc(firestore, 'centers', centerId, 'students', selectedSeat.studentId), {
          seatId: selectedSeat.id,
          seatNo: selectedSeat.seatNo,
          roomId: selectedSeat.roomId,
          roomSeatNo: selectedSeat.roomSeatNo,
          seatLabel: seatLabelFieldValue,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setSelectedSeat({
        ...selectedSeat,
        seatDocId: selectedSeat.id,
        seatLabel: nextCustomSeatLabel || undefined,
      });
      setSeatLabelDraft(nextCustomSeatLabel || String(roomSeatNo));
      toast({
        title: nextCustomSeatLabel ? '좌석 번호를 저장했습니다.' : '좌석 번호를 도면 기본 순번으로 되돌렸습니다.',
      });
    } catch (error: any) {
      console.error('[teacher-dashboard] seat label save failed', error);
      toast({
        variant: 'destructive',
        title: '좌석 번호 저장 실패',
        description: error?.message || '잠시 후 다시 시도해 주세요.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateZone = async (zone: string) => {
    if (!firestore || !centerId || !selectedSeat) return;
    const normalizedZone = zone === '미정' ? null : zone;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const seatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id);
      const legacySeatDocId = getLegacySeatDocId(selectedSeat);
      batch.set(seatRef, {
        seatNo: selectedSeat.seatNo,
        roomId: selectedSeat.roomId,
        roomSeatNo: selectedSeat.roomSeatNo,
        seatZone: normalizedZone ?? deleteField(),
        seatGenderPolicy: selectedSeatGenderPolicy === 'all' ? deleteField() : selectedSeatGenderPolicy,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      if (legacySeatDocId) {
        batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', legacySeatDocId));
      }
      
      if (selectedSeat.studentId) {
        const studentRef = doc(firestore, 'centers', centerId, 'students', selectedSeat.studentId);
        batch.update(studentRef, {
          seatId: selectedSeat.id,
          seatNo: selectedSeat.seatNo,
          roomId: selectedSeat.roomId,
          roomSeatNo: selectedSeat.roomSeatNo,
          seatZone: normalizedZone ?? deleteField(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      
      toast({ title: "구역 설정이 완료되었습니다." });
      setSelectedSeat({ ...selectedSeat, seatDocId: selectedSeat.id, seatZone: normalizedZone ?? undefined });
    } catch (e) {
      toast({ variant: "destructive", title: "설정 실패" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSeatGender = async (policy: string) => {
    if (!firestore || !centerId || !selectedSeat || selectedSeat.type === 'aisle') return;

    const roomSeatNo = Number(selectedSeat.roomSeatNo || 0);
    if (!Number.isFinite(roomSeatNo) || roomSeatNo <= 0) return;

    const seatId = buildSeatId(selectedSeat.roomId || PRIMARY_ROOM_ID, roomSeatNo);
    if (!seatId) return;

    const normalizedPolicy = normalizeSeatGenderPolicy(policy);
    if (normalizedPolicy === selectedSeatGenderPolicy) {
      toast({
        title:
          normalizedPolicy === 'all'
            ? '이미 공용 좌석으로 설정되어 있습니다.'
            : `${getSeatGenderPolicyLabel(normalizedPolicy)} 설정이 이미 적용되어 있습니다.`,
      });
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const legacySeatDocId = getLegacySeatDocId(selectedSeat);
      const nextSeatGenderBySeatId = { ...persistedSeatGenderBySeatId };

      if (normalizedPolicy === 'all') {
        delete nextSeatGenderBySeatId[seatId];
      } else {
        nextSeatGenderBySeatId[seatId] = normalizedPolicy;
      }

      batch.update(doc(firestore, 'centers', centerId), {
        'layoutSettings.seatGenderBySeatId': nextSeatGenderBySeatId,
        'layoutSettings.updatedAt': serverTimestamp(),
      });

      batch.set(
        doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id),
        {
          seatNo: selectedSeat.seatNo,
          roomId: selectedSeat.roomId,
          roomSeatNo: selectedSeat.roomSeatNo,
          seatGenderPolicy: normalizedPolicy === 'all' ? deleteField() : normalizedPolicy,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (legacySeatDocId) {
        batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', legacySeatDocId));
      }

      await batch.commit();

      setSelectedSeat({
        ...selectedSeat,
        seatDocId: selectedSeat.id,
        seatGenderPolicy: normalizedPolicy,
      });

      toast({
        title:
          normalizedPolicy === 'all'
            ? '공용 좌석으로 변경했습니다.'
            : `${getSeatGenderPolicyLabel(normalizedPolicy)}으로 설정했습니다.`,
      });
    } catch (error) {
      console.error('[teacher-dashboard] seat gender update failed', error);
      toast({ variant: 'destructive', title: '좌석 성별 설정 실패' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleCellType = async () => {
    if (!firestore || !centerId || !selectedSeat) return;
    const nextType = selectedSeat.type === 'aisle' ? 'seat' : 'aisle';
    const targetSeatId =
      getSeatCanvasId(selectedSeat) ||
      buildSeatId(selectedSeat.roomId || PRIMARY_ROOM_ID, selectedSeat.roomSeatNo ?? 0);
    const legacySeatDocId = getLegacySeatDocId(selectedSeat);
    const previousSelectedSeat = selectedSeat;
    const nextSelectedSeat: ResolvedAttendanceSeat = {
      ...selectedSeat,
      type: nextType,
      seatDocId: selectedSeat.id,
      studentId: nextType === 'aisle' ? undefined : selectedSeat.studentId,
      manualOccupantName: nextType === 'aisle' ? undefined : selectedSeat.manualOccupantName,
      seatZone: nextType === 'aisle' ? undefined : selectedSeat.seatZone,
      seatGenderPolicy: nextType === 'aisle' ? 'all' : selectedSeatGenderPolicy,
      status: 'absent',
      lastCheckInAt: undefined,
    };
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const seatRef = doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id);
      const nextAisleSeatIds = new Set(effectiveAisleSeatIds);
      const nextSeatGenderSource = { ...persistedSeatGenderBySeatId };
      if (targetSeatId) {
        if (nextType === 'aisle') {
          nextAisleSeatIds.add(targetSeatId);
          delete nextSeatGenderSource[targetSeatId];
        } else {
          nextAisleSeatIds.delete(targetSeatId);
        }
      }
      if (nextType === 'aisle' && selectedSeat.studentId) {
        batch.update(doc(firestore, 'centers', centerId, 'students', selectedSeat.studentId), {
          seatNo: 0,
          seatId: deleteField(),
          roomId: deleteField(),
          roomSeatNo: deleteField(),
          seatLabel: deleteField(),
          seatZone: deleteField(),
          updatedAt: serverTimestamp(),
        });
        batch.set(
          seatRef,
          {
            type: 'aisle',
            studentId: null,
            manualOccupantName: deleteField(),
            seatNo: selectedSeat.seatNo,
            roomId: selectedSeat.roomId,
            roomSeatNo: selectedSeat.roomSeatNo,
            seatZone: deleteField(),
            seatGenderPolicy: deleteField(),
            status: 'absent',
            lastCheckInAt: deleteField(),
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
            manualOccupantName: deleteField(),
            seatNo: selectedSeat.seatNo,
            roomId: selectedSeat.roomId,
            roomSeatNo: selectedSeat.roomSeatNo,
            seatZone: deleteField(),
            seatGenderPolicy: deleteField(),
            status: 'absent',
            lastCheckInAt: deleteField(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        batch.set(
          seatRef,
          {
            type: nextType,
            manualOccupantName: deleteField(),
            seatNo: selectedSeat.seatNo,
            roomId: selectedSeat.roomId,
            roomSeatNo: selectedSeat.roomSeatNo,
            seatGenderPolicy: selectedSeatGenderPolicy === 'all' ? deleteField() : selectedSeatGenderPolicy,
            lastCheckInAt: deleteField(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }
      const nextSeatGenderBySeatId = filterSeatGenderByRooms(
        persistedLayoutRoomsSnapshot,
        nextSeatGenderSource
      );
      batch.set(
        doc(firestore, 'centers', centerId),
        {
          layoutSettings: {
            rooms: persistedLayoutRoomsSnapshot,
            rows: persistedLayoutRows,
            cols: persistedLayoutCols,
            aisleSeatIds: Array.from(nextAisleSeatIds).sort(),
            seatLabelsBySeatId: filterSeatLabelsByRooms(persistedLayoutRoomsSnapshot),
            seatGenderBySeatId: nextSeatGenderBySeatId,
            updatedAt: serverTimestamp(),
          },
        },
        { merge: true }
      );
      if (legacySeatDocId) {
        batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', legacySeatDocId));
      }
      const optimisticNextAisles = Array.from(nextAisleSeatIds).sort();
      setOptimisticAisleSeatIds(optimisticNextAisles);
      setSelectedSeat(nextSelectedSeat);
      if (nextType === 'aisle') {
        setManualSeatOccupantName('');
      }
      await batch.commit();
      toast({ title: nextType === 'aisle' ? "통로로 변경됨" : "좌석으로 변경됨" });
    } catch (e) {
      setOptimisticAisleSeatIds(null);
      setSelectedSeat(previousSelectedSeat);
      toast({ variant: "destructive", title: "변경 실패" });
    } finally { setIsSaving(false); }
  };

  const handleSaveManualSeatOccupancy = async () => {
    if (!firestore || !centerId || !selectedSeat || !canManageManualSeatOccupancy) return;
    if (selectedSeat.type === 'aisle') {
      toast({ variant: "destructive", title: "통로는 임시 사용중으로 표시할 수 없습니다." });
      return;
    }
    if (selectedSeat.studentId) {
      toast({ variant: "destructive", title: "이미 학생이 배정된 좌석입니다." });
      return;
    }

    const occupantName = manualSeatOccupantName.trim();
    if (!occupantName) {
      toast({ variant: "destructive", title: "임시 사용중 이름을 입력해 주세요." });
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const legacySeatDocId = getLegacySeatDocId(selectedSeat);
      batch.set(
        doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id),
        {
          studentId: null,
          manualOccupantName: occupantName,
          type: 'seat',
          status: 'studying',
          seatNo: selectedSeat.seatNo,
          roomId: selectedSeat.roomId,
          roomSeatNo: selectedSeat.roomSeatNo,
          seatLabel: selectedSeat.seatLabel ?? deleteField(),
          seatZone: selectedSeat.seatZone || null,
          lastCheckInAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      if (legacySeatDocId) {
        batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', legacySeatDocId));
      }
      await batch.commit();
      setSelectedSeat({
        ...selectedSeat,
        seatDocId: selectedSeat.id,
        studentId: undefined,
        manualOccupantName: occupantName,
        status: 'studying',
      });
      toast({ title: `${occupantName} 이름으로 임시 사용중 처리했습니다.` });
    } catch (e) {
      toast({ variant: "destructive", title: "임시 사용중 저장 실패" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearManualSeatOccupancy = async () => {
    if (!firestore || !centerId || !selectedSeat || !canManageManualSeatOccupancy) return;
    if (!getManualSeatOccupantName(selectedSeat)) return;

    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const legacySeatDocId = getLegacySeatDocId(selectedSeat);
      batch.set(
        doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id),
        {
          studentId: null,
          manualOccupantName: deleteField(),
          type: 'seat',
          status: 'absent',
          seatNo: selectedSeat.seatNo,
          roomId: selectedSeat.roomId,
          roomSeatNo: selectedSeat.roomSeatNo,
          lastCheckInAt: deleteField(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      if (legacySeatDocId) {
        batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', legacySeatDocId));
      }
      await batch.commit();
      setSelectedSeat({
        ...selectedSeat,
        seatDocId: selectedSeat.id,
        studentId: undefined,
        manualOccupantName: undefined,
        status: 'absent',
      });
      setManualSeatOccupantName('');
      toast({ title: "임시 사용중 상태를 해제했습니다." });
    } catch (e) {
      toast({ variant: "destructive", title: "임시 사용중 해제 실패" });
    } finally {
      setIsSaving(false);
    }
  };

  const assignStudentToSeat = async (student: StudentProfile) => {
    if (!firestore || !centerId || !selectedSeat) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const legacySeatDocId = getLegacySeatDocId(selectedSeat);
      batch.update(doc(firestore, 'centers', centerId, 'students', student.id), {
        seatId: selectedSeat.id,
        seatNo: selectedSeat.seatNo,
        roomId: selectedSeat.roomId,
        roomSeatNo: selectedSeat.roomSeatNo,
        seatLabel: selectedSeat.seatLabel ?? deleteField(),
        seatZone: selectedSeat.seatZone || null,
        updatedAt: serverTimestamp()
      });
      batch.set(
        doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id),
        {
          studentId: student.id,
          manualOccupantName: deleteField(),
          status: 'absent',
          type: 'seat',
          seatNo: selectedSeat.seatNo,
          roomId: selectedSeat.roomId,
          roomSeatNo: selectedSeat.roomSeatNo,
          seatLabel: selectedSeat.seatLabel ?? deleteField(),
          seatZone: selectedSeat.seatZone || null,
          lastCheckInAt: deleteField(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      if (legacySeatDocId) {
        batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', legacySeatDocId));
      }
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
      const legacySeatDocId = getLegacySeatDocId(selectedSeat);
      batch.update(doc(firestore, 'centers', centerId, 'students', selectedSeat.studentId), {
        seatNo: 0,
        seatId: deleteField(),
        roomId: deleteField(),
        roomSeatNo: deleteField(),
        seatLabel: deleteField(),
        seatZone: deleteField(),
        updatedAt: serverTimestamp(),
      });
      batch.set(
        doc(firestore, 'centers', centerId, 'attendanceCurrent', selectedSeat.id),
        {
          studentId: null,
          manualOccupantName: deleteField(),
          seatNo: selectedSeat.seatNo,
          roomId: selectedSeat.roomId,
          roomSeatNo: selectedSeat.roomSeatNo,
          status: 'absent',
          lastCheckInAt: deleteField(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      if (legacySeatDocId) {
        batch.delete(doc(firestore, 'centers', centerId, 'attendanceCurrent', legacySeatDocId));
      }
      await batch.commit();
      toast({ title: "배정 해제 완료" });
      setIsManaging(false);
    } catch (e) { toast({ variant: "destructive", title: "해제 실패" }); } finally { setIsSaving(false); }
  };

  const activeRoomConflicts = selectedRoomConfig
    ? roomResizeConflicts.get(selectedRoomConfig.id) || []
    : [];
  const showInlineSeatInsightControls = !isMobile && Boolean(selectedRoomConfig);

  const renderSeatOverlayControlPanel = ({ compact = false, inline = false } = {}) => (
    <div
      ref={inline ? seatInsightSectionRef : undefined}
      className={cn(
        "space-y-4",
        compact && "w-[320px] shrink-0 rounded-[2.2rem] border border-[#D7E4FF] bg-white/95 p-4 shadow-[0_22px_40px_-28px_rgba(20,41,95,0.22)]"
      )}
    >
      {compact ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black text-[#2554D7]">
              도면 학생 히트맵
            </Badge>
            <Badge className="h-6 rounded-full border border-[#D7E4FF] bg-white px-2.5 text-[10px] font-black text-[#14295F]">
              {activeSeatOverlayOption.label}
            </Badge>
            {isEditMode ? (
              <Badge className="h-6 rounded-full border-none bg-[#FFF2E8] px-2.5 text-[10px] font-black text-[#C95A08]">
                상태 고정
              </Badge>
            ) : null}
          </div>
          <div>
            <p className="text-base font-black tracking-tight text-[#14295F]">도면 옆 제어 패널</p>
            <p className="mt-1 text-xs font-bold leading-5 text-[#5c6e97]">
              빈 공간에서 바로 눌러 오버레이를 바꾸고 좌석 위험 신호를 비교합니다.
            </p>
          </div>
        </div>
      ) : (
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
      )}

      <div className={cn("rounded-[2rem] border border-[#D7E4FF] bg-white/85 shadow-sm", compact ? "p-3.5" : "p-4")}>
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

      {isEditMode ? (
        <div className="space-y-3">
          <div className={cn("rounded-[2rem] border border-[#FFD7B0] bg-[#FFF8F1]", compact ? "p-3.5" : "p-4")}>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#C95A08]">편집 모드 안내</p>
            <p className="mt-2 text-sm font-black text-[#14295F]">좌석을 눌러 통로, 구역, 번호 설정을 바로 바꿔주세요.</p>
            <p className="mt-1 text-xs font-bold leading-5 text-[#8A5A2B]">
              편집 중에는 도면 오버레이가 상태 보기로 고정됩니다. 왼쪽 좌석을 누르면 이 패널에서 번호와 설정을 바로 이어서 수정할 수 있습니다.
            </p>
          </div>

          <div className={cn("rounded-[2rem] border border-[#D7E4FF] bg-white", compact ? "p-3.5" : "p-4")}>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#5c6e97]">선택한 좌석</p>
            {selectedSeat ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-[1.35rem] border border-[#E4ECFA] bg-[#F8FBFF] px-4 py-3">
                  <p className="text-sm font-black text-[#14295F]">{selectedSeatLabel}</p>
                  <p className="mt-1 text-xs font-bold leading-5 text-[#5C6E97]">
                    {selectedSeatModeLabel} · {selectedSeatZoneLabel} · {selectedSeatGenderLabel} · {selectedSeatAssignmentLabel}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    <LayoutGrid className="h-3 w-3" /> 좌석 번호 선택
                  </Label>
                  <Select
                    value={seatNumberQuickSelectValue}
                    onValueChange={(value) => setSeatLabelDraft(value === '__empty__' ? '' : value)}
                    disabled={!selectedSeat?.roomSeatNo || isSaving}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-2 font-bold shadow-sm">
                      <SelectValue placeholder="번호 선택" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 rounded-xl border-none shadow-2xl">
                      <SelectItem value="__empty__" className="font-bold">기본 순번 사용</SelectItem>
                      {seatNumberQuickSelectValue === '__custom__' ? (
                        <SelectItem value="__custom__" disabled className="font-bold">직접 입력값 사용</SelectItem>
                      ) : null}
                      {seatNumberQuickOptions.map((option) => (
                        <SelectItem key={`seat-number-${option}`} value={option} className="font-bold">
                          {option}번
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Input
                      value={seatLabelDraft}
                      onChange={(event) => setSeatLabelDraft(event.target.value.slice(0, 12))}
                      placeholder={selectedSeatDefaultLabel || '예: 64'}
                      className="h-11 rounded-xl border-2 font-bold shadow-sm"
                    />
                    <Button
                      type="button"
                      onClick={handleSaveSeatLabel}
                      disabled={
                        isSaving ||
                        !selectedSeat?.roomSeatNo ||
                        normalizedSeatLabelDraft === (selectedSeatDisplayLabel || selectedSeatDefaultLabel)
                      }
                      className="h-11 rounded-xl px-4 font-black whitespace-nowrap"
                    >
                      저장
                    </Button>
                  </div>
                  <p className="ml-1 text-[11px] font-semibold leading-5 text-slate-500">
                    드롭다운에서 빠르게 고르거나 직접 입력할 수 있습니다. 비워두면 기본 순번 {selectedSeatDefaultLabel || '-'}번을 사용합니다.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    <Users className="h-3 w-3" /> 좌석 성별 설정
                  </Label>
                  <Select
                    value={selectedSeat?.type === 'aisle' ? 'all' : selectedSeatGenderPolicy}
                    onValueChange={handleUpdateSeatGender}
                    disabled={selectedSeat?.type === 'aisle' || isSaving}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-2 font-bold shadow-sm">
                      <SelectValue placeholder="성별 구분 선택" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      <SelectItem value="all" className="font-bold">공용</SelectItem>
                      <SelectItem value="male" className="font-bold">남학생 전용</SelectItem>
                      <SelectItem value="female" className="font-bold">여학생 전용</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="ml-1 text-[11px] font-semibold leading-5 text-slate-500">
                    {selectedSeat?.type === 'aisle'
                      ? '통로 상태에서는 성별 좌석 구분을 쓰지 않습니다. 좌석으로 전환한 뒤 설정해 주세요.'
                      : '홍보페이지 실시간 좌석 보기와 좌석예약 단계에도 같은 기준이 그대로 반영됩니다.'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                    <ArrowRightLeft className="h-3 w-3" /> 좌석/통로 전환
                  </Label>
                  <Button
                    type="button"
                    onClick={handleToggleCellType}
                    disabled={isSaving}
                    className={cn(
                      "h-11 w-full rounded-xl font-black",
                      selectedSeat?.type === 'aisle'
                        ? "bg-[#14295F] text-white hover:bg-[#10224E]"
                        : "bg-[#FF7A16] text-white hover:bg-[#E9680C]"
                    )}
                  >
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRightLeft className="mr-2 h-4 w-4" />}
                    {selectedSeat?.type === 'aisle' ? '좌석으로 다시 사용' : '통로로 전환'}
                  </Button>
                  <p className="ml-1 text-[11px] font-semibold leading-5 text-slate-500">
                    통로도 누르면 바로 좌석으로 되돌릴 수 있고, 기존 좌석은 여기서 바로 통로로 바꿉니다.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAssigning(true)}
                    disabled={selectedSeat.type === 'aisle'}
                    className="h-10 rounded-xl border-2 font-black"
                  >
                    학생 배정 열기
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (selectedSeat.studentId) {
                        fetchStudentDetails(selectedSeat.studentId);
                      }
                      setIsManaging(true);
                    }}
                    disabled={!selectedSeat.studentId}
                    className="h-10 rounded-xl border-2 font-black"
                  >
                    학생 상세 열기
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-[1.35rem] border border-dashed border-[#D7E4FF] bg-[#F8FBFF] px-4 py-4">
                <p className="text-sm font-black text-[#14295F]">왼쪽 도면에서 좌석을 먼저 눌러주세요.</p>
                <p className="mt-1 text-xs font-bold leading-5 text-[#5C6E97]">
                  선택한 좌석의 번호, 통로 여부, 구역 설정을 여기서 바로 바꿀 수 있습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={cn("flex flex-wrap gap-2", compact && "gap-1.5")}>
          {SEAT_OVERLAY_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={activeSeatOverlayMode === option.value ? 'default' : 'outline'}
              onClick={() => setSeatOverlayMode(option.value)}
              className={cn(
                "rounded-2xl font-black",
                compact ? "h-10 min-w-[88px] px-3 text-[12px]" : isMobile ? "h-10 flex-1 min-w-[92px] px-4" : "h-11 px-4",
                activeSeatOverlayMode === option.value ? "bg-[#14295F] text-white" : "border-2 bg-white/80 text-[#14295F]"
              )}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}

      <div className={cn("rounded-[2rem] border border-[#D7E4FF] bg-[#F7FAFF]", compact ? "p-3.5" : "p-4")}>
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
    </div>
  );

  const renderRoomGridCanvas = (room: LayoutRoomConfig, compact = false) => (
    <ScrollArea className="w-full max-w-full">
      <div
        className={cn(
          compact || !showInlineSeatInsightControls
            ? 'mx-auto w-fit rounded-[2.5rem] border-2 border-muted/30 bg-[#fafafa]'
            : 'flex min-w-full items-start justify-between gap-5',
          compact ? 'p-3 sm:p-4' : isMobile ? 'p-4' : showInlineSeatInsightControls ? '' : 'p-6 sm:p-10 shadow-inner'
        )}
      >
        <div
          className={cn(
            'rounded-[2.5rem] border-2 border-muted/30 bg-[#fafafa]',
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
                  const manualOccupantName = getManualSeatOccupantName(seat);
                  const hasManualOccupant = Boolean(manualOccupantName);
                  const hasOccupant = Boolean(occupantId) || hasManualOccupant;
                  const occupantName =
                    student?.name ||
                    studentMember?.displayName ||
                    manualOccupantName ||
                    (occupantId ? '배정됨' : '');
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
                  const seatDisplayLabel =
                    getSeatDisplayLabel(seat, persistedSeatLabelsBySeatId) || String(roomSeatNo);
                  const isAisle = seat.type === 'aisle';
                  const seatCanvasId = getSeatCanvasId(seat);
                  const nameTextClass =
                    hasOccupant && overlayPresentation.isDark
                      ? 'text-white drop-shadow-[0_1px_6px_rgba(15,23,42,0.28)]'
                      : 'text-slate-950';
                  const firstCheckInTimeLabel = seatSignal?.firstCheckInLabel || seatSignal?.checkedAtLabel || null;
                  const plannedDepartureTimeLabel = seatSignal?.plannedDepartureTime
                    ? seatSignal.routineExpectedArrivalTime
                      ? `${seatSignal.routineExpectedArrivalTime}~${seatSignal.plannedDepartureTime}`
                      : seatSignal.plannedDepartureTime
                    : null;
                  const seatTimeChips = !isEditMode && seatSignal
                    ? [
                        firstCheckInTimeLabel
                          ? {
                              key: 'firstCheckIn',
                              label: `입실 ${firstCheckInTimeLabel}`,
                              className: 'border-white/80 bg-white/92 text-[#14295F]',
                            }
                          : null,
                        plannedDepartureTimeLabel
                          ? {
                              key: 'plannedDeparture',
                              label: `하원 ${plannedDepartureTimeLabel}`,
                              className: 'border-[#FFD0A6] bg-[#FFF1E2] text-[#C95A08]',
                            }
                          : null,
                      ].filter(Boolean) as { key: string; label: string; className: string }[]
                    : [];
                  const hasSeatTimeChips = seatTimeChips.length > 0;

                  return (
                    <div
                      key={`${room.id}_${roomSeatNo}`}
                      onClick={() => handleSeatClick(seat)}
                      className={cn(
                        'relative aspect-square cursor-pointer overflow-hidden border-2 outline-none shadow-sm transition-all duration-500',
                        compact ? 'min-w-[52px] rounded-[1.1rem] p-1' : 'min-w-[64px] rounded-2xl p-1',
                        'flex flex-col items-center justify-center',
                        selectedSeatCanvasId === seatCanvasId && 'ring-4 ring-[#FFB273]/40 ring-offset-2 ring-offset-white',
                        isFilteredOut ? 'border-transparent bg-muted/10 opacity-20 grayscale' :
                        isAisle ? (isEditMode
                          ? 'border-dashed border-[#FFB273] bg-[#FFF7EF] text-[#C95A08] hover:border-[#FF7A16]'
                          : 'border-transparent bg-transparent text-transparent hover:bg-muted/10') :
                        hasOccupant ? overlayPresentation.surfaceClass :
                        'border-primary/40 bg-white text-primary/5 hover:border-primary/60',
                        isEditMode && isAisle && 'shadow-none'
                      )}
                    >
                      {!isAisle ? (
                        <span
                          className={cn(
                            'absolute left-1.5 top-1 font-black',
                            compact ? 'text-[6px]' : 'text-[7px]',
                            hasOccupant && overlayPresentation.isDark ? 'opacity-70' : 'opacity-40'
                          )}
                        >
                          {seatDisplayLabel}
                        </span>
                      ) : isEditMode ? (
                        <>
                          <span className={cn('absolute left-1.5 top-1 font-black text-[#C95A08]/75', compact ? 'text-[6px]' : 'text-[7px]')}>
                            {seatDisplayLabel}
                          </span>
                          <span className={cn('font-black tracking-tight text-[#C95A08]', compact ? 'text-[8px]' : 'text-[10px]')}>
                            통로
                          </span>
                        </>
                      ) : null}
                      {hasManualOccupant && !isAisle && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'absolute left-1 top-1 border-none px-1 font-black',
                            compact ? 'h-3 text-[5px]' : 'h-3.5 text-[6px]',
                            overlayPresentation.flagClass
                          )}
                        >
                          임시
                        </Badge>
                      )}
                      {seat.seatZone && !isAisle && isEditMode && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'absolute right-1 top-1 border-none px-1 font-black',
                            compact ? 'h-3 text-[5px]' : 'h-3.5 text-[6px]',
                            hasOccupant ? overlayPresentation.flagClass : 'bg-primary/5 text-primary/40'
                          )}
                        >
                          {seat.seatZone.charAt(0)}
                        </Badge>
                      )}
                      {isAisle ? (
                        isEditMode && <MapIcon className={cn(compact ? 'h-2.5 w-2.5' : 'h-3 w-3', 'opacity-40')} />
                      ) : hasOccupant ? (
                        <div
                          className={cn(
                            'flex h-full w-full flex-col items-center justify-center text-center',
                            hasSeatTimeChips ? (compact ? 'gap-0.5 px-0.5 pt-2' : 'gap-1 px-1.5 pt-2') : compact ? 'px-1 pt-2' : 'px-1.5'
                          )}
                        >
                          <span
                            className={cn(
                              'w-full font-black tracking-tight break-keep text-center',
                              nameTextClass,
                              hasSeatTimeChips
                                ? compact
                                  ? 'truncate text-[8.5px] leading-none'
                                  : 'truncate text-[10px] leading-[1.05]'
                                : compact
                                  ? 'whitespace-normal text-[10px] leading-[1.12] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden'
                                  : 'whitespace-normal text-[12px] leading-[1.18] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden'
                            )}
                          >
                            {occupantName}
                          </span>
                          {hasSeatTimeChips ? (
                            <div className="flex w-full min-w-0 flex-col items-center gap-0.5">
                              {seatTimeChips.map((chip) => (
                                <span
                                  key={chip.key}
                                  className={cn(
                                    'inline-flex max-w-full items-center justify-center rounded-full border px-1.5 py-0.5 font-black leading-none shadow-[0_8px_14px_-12px_rgba(20,41,95,0.34)]',
                                    chip.className,
                                    compact ? 'min-h-[12px] text-[5.5px]' : 'min-h-[15px] text-[7px]'
                                  )}
                                >
                                  <span className="truncate">{chip.label}</span>
                                </span>
                              ))}
                            </div>
                          ) : null}
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
        {showInlineSeatInsightControls && !compact ? renderSeatOverlayControlPanel({ compact: true, inline: true }) : null}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );

  function renderTeacherHomeHeroSection() {
    return (
      <OperationsInbox
        headline={teacherHomeStatusMeta.headline}
        summary={teacherHomeStatusMeta.detail}
        statusLabel={teacherHomeStatusMeta.label}
        statusTone={teacherOperationsInboxStatusTone}
        liveLabel={`${liveDateLabel} ${liveSyncLabel}`}
        totalOpenCount={teacherOperationsInboxTotalOpenCount}
        summaryChips={teacherOperationsInboxSummaryChips}
        queueItems={teacherOperationsInboxQueueItems}
        panels={teacherOperationsInboxPanels}
        headerActions={
          <>
            <Badge className="h-10 rounded-xl border border-[#DCE7FF] bg-white px-3 text-[11px] font-black text-[#14295F]">
              {currentTeacherScopeLabel}
            </Badge>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsHeroRoomsDialogOpen(true)}
              className="h-10 rounded-xl border-2 border-[#DCE7FF] bg-white px-3 text-xs font-black text-[#14295F]"
            >
              호실 요약
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => openCounselTrackDialog('reservations')}
              className="h-10 rounded-xl border-2 border-[#DCE7FF] bg-white px-3 text-xs font-black text-[#14295F]"
            >
              상담/문의
            </Button>
          </>
        }
        queueButtonLabel="우선순위"
        onOpenQueue={() => setIsHeroPriorityDialogOpen(true)}
      />
    );

    const kpiToneClassMap = {
      default: {
        shell: 'border-[#DCE7FF] bg-white text-[#14295F]',
        icon: 'bg-[#EEF4FF] text-[#2554D7]',
        value: 'text-[#14295F]',
      },
      navy: {
        shell: 'border-[#C9D8FF] bg-[linear-gradient(180deg,#F8FBFF_0%,#EEF4FF_100%)] text-[#14295F]',
        icon: 'bg-[#14295F] text-white',
        value: 'text-[#14295F]',
      },
      blue: {
        shell: 'border-[#C9D8FF] bg-[linear-gradient(180deg,#F7FAFF_0%,#ECF4FF_100%)] text-[#14295F]',
        icon: 'bg-[#E6F0FF] text-[#2554D7]',
        value: 'text-[#2554D7]',
      },
      orange: {
        shell: 'border-[#FFD7B0] bg-[linear-gradient(180deg,#FFF9F3_0%,#FFF1E4_100%)] text-[#14295F]',
        icon: 'bg-[#FFF0DF] text-[#C95A08]',
        value: 'text-[#C95A08]',
      },
      rose: {
        shell: 'border-rose-200 bg-[linear-gradient(180deg,#FFF8FA_0%,#FFF1F4_100%)] text-[#14295F]',
        icon: 'bg-rose-100 text-rose-600',
        value: 'text-rose-600',
      },
      emerald: {
        shell: 'border-emerald-200 bg-[linear-gradient(180deg,#F4FFF9_0%,#ECFFF4_100%)] text-[#14295F]',
        icon: 'bg-emerald-100 text-emerald-700',
        value: 'text-emerald-700',
      },
    };

    return (
      <motion.section className="space-y-5 px-1" {...getDeckMotionProps(0.04, 16)}>
        <motion.div
          className="relative overflow-hidden rounded-[2rem] border border-[#1C3A82] admin-exec-header text-white shadow-[0_32px_64px_-40px_rgba(20,41,95,0.62)]"
          {...getDeckMotionProps(0.06, 16)}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,122,22,0.16),transparent_42%),radial-gradient(ellipse_at_bottom_right,rgba(37,84,215,0.18),transparent_50%)]" />
          <div className={cn("relative grid gap-5", isMobile ? "p-5" : "p-6 sm:p-7 lg:grid-cols-[minmax(0,1.4fr)_360px] lg:items-stretch")}>
            <div className="flex min-w-0 flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={cn("h-7 rounded-full px-3 text-[10px] font-black", teacherHomeStatusMeta.badgeClass)}>
                    <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full", teacherHomeStatusMeta.dotClass)} />
                    {teacherHomeStatusMeta.label}
                  </Badge>
                  <Badge className="h-7 rounded-full border border-white/10 bg-white/10 px-3 text-[10px] font-black text-white">
                    {currentTeacherScopeLabel}
                  </Badge>
                  <Badge className="h-7 rounded-full border border-white/10 bg-white/[0.07] px-3 text-[10px] font-black text-white/82">
                    {liveDateLabel}
                  </Badge>
                </div>

                <div className="flex items-start gap-4">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                    <Monitor className="h-6 w-6 text-white" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#FFD7BA]">teacher live studio</p>
                    <h1 className={cn("mt-2 font-aggro-display tracking-tight text-white", isMobile ? "text-[1.9rem] leading-[1.08]" : "text-[2.55rem] leading-[0.98]")}>
                      {teacherHomeStatusMeta.headline}
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-white/72">
                      {teacherHomeStatusMeta.detail}
                    </p>
                  </div>
                </div>
              </div>

              <div className={cn("grid gap-2.5", isMobile ? "grid-cols-2" : "grid-cols-4")}>
                <button
                  type="button"
                  onClick={() => setIsHeroPriorityDialogOpen(true)}
                  className="rounded-[1.35rem] border border-white/10 bg-white/[0.08] px-4 py-3 text-left transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.12]"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/56">오늘 조치</p>
                  <p className="mt-2 text-base font-black text-white">
                    {teacherHomeActionSignalCount > 0 ? `${teacherHomeActionSignalCount}건` : '안정'}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRoomView('all');
                    scrollToSection(liveBoardSectionRef);
                  }}
                  className="rounded-[1.35rem] border border-white/10 bg-white/[0.08] px-4 py-3 text-left transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.12]"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/56">실시간 좌석</p>
                  <p className="mt-2 text-base font-black text-white">{stats.studying}/{stats.total}</p>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection(seatInsightSectionRef)}
                  className={cn(
                    "rounded-[1.35rem] border px-4 py-3 text-left transition-[transform,border-color,background-color] hover:-translate-y-0.5",
                    seatOverlaySummary.riskCount > 0
                      ? "border-[#FFB38A]/35 bg-[#FF7A16]/18 hover:bg-[#FF7A16]/24"
                      : "border-white/10 bg-white/[0.08] hover:border-white/20 hover:bg-white/[0.12]"
                  )}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/56">학생 리스크</p>
                  <p className="mt-2 text-base font-black text-white">위험 {seatOverlaySummary.riskCount}명</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (latestUnreadRecentReport) {
                      setSelectedRecentReport(latestUnreadRecentReport);
                      return;
                    }
                    scrollToSection(reportsSectionRef);
                  }}
                  className="rounded-[1.35rem] border border-white/10 bg-white/[0.08] px-4 py-3 text-left transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.12]"
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/56">리포트</p>
                  <p className="mt-2 text-base font-black text-white">미열람 {unreadReportCount}건</p>
                </button>
              </div>
            </div>

            <div className="flex h-full flex-col justify-between gap-3 rounded-[1.65rem] border border-white/10 bg-white/[0.09] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/56">live sync</p>
                  <p className="dashboard-number mt-2 text-[1.55rem] text-white">{liveSyncLabel}</p>
                </div>
                <Badge className="h-7 rounded-full border border-white/10 bg-white px-3 text-[10px] font-black text-[#14295F]">
                  운영실
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.08] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50">확인 필요</p>
                  <p className="dashboard-number mt-2 text-2xl text-[#FFD7BA]">{teacherHomeAlertCount}</p>
                </div>
                <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.08] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50">현재 보기</p>
                  <p className="mt-2 truncate text-sm font-black text-white">{selectedRoomLabel}</p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => setIsHeroRoomsDialogOpen(true)}
                className="h-11 rounded-[1.15rem] bg-white text-xs font-black text-[#14295F] hover:bg-[#F4F7FF]"
              >
                호실 운영 요약 보기
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>

        <div className={cn("grid gap-3", isMobile ? "grid-cols-2" : "md:grid-cols-3 xl:grid-cols-7")}>
          {teacherHomeKpiCards.map((item, index) => {
            const toneClasses = kpiToneClassMap[item.tone] || kpiToneClassMap.default;
            const KpiIcon = item.icon;
            const content = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#5C6E97]">{item.label}</p>
                    <p className={cn("dashboard-number mt-3 break-keep leading-none", isMobile ? "text-[1.35rem]" : "text-[1.55rem]", toneClasses.value)}>
                      {item.value}
                      {item.unit ? <span className="ml-1 align-baseline text-[0.8rem] font-black">{item.unit}</span> : null}
                    </p>
                  </div>
                  <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem]", toneClasses.icon)}>
                    <KpiIcon className="h-[18px] w-[18px]" />
                  </span>
                </div>
                <div className="mt-4 min-h-[2.4rem]">
                  <p className="text-[11px] font-bold leading-5 text-[#5C6E97]">{item.caption}</p>
                  <p className="mt-0.5 truncate text-[10px] font-black text-[#8A98B5]">{item.deltaLabel}</p>
                </div>
              </>
            );

            return (
              <motion.div key={item.key} {...getDeckMotionProps(0.1 + index * 0.035, 10)}>
                {item.onClick ? (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className={cn(
                      "h-full w-full rounded-[1.55rem] border p-4 text-left shadow-[0_18px_34px_-30px_rgba(20,41,95,0.22)] transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:shadow-[0_24px_44px_-34px_rgba(20,41,95,0.3)]",
                      toneClasses.shell
                    )}
                  >
                    {content}
                  </button>
                ) : (
                  <div className={cn("h-full rounded-[1.55rem] border p-4 shadow-[0_18px_34px_-30px_rgba(20,41,95,0.22)]", toneClasses.shell)}>
                    {content}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "lg:grid-cols-12")}>
          <Card className="admin-surface-primary overflow-hidden rounded-[2rem] border-[#DCE7FF] lg:col-span-4">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black text-[#2554D7]">교실 현황</Badge>
                  <p className="mt-3 text-lg font-black tracking-tight text-[#14295F]">호실별 좌석 흐름</p>
                </div>
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-[1rem] bg-[#14295F] text-white">
                  <Armchair className="h-5 w-5" />
                </span>
              </div>
              <div className="space-y-2.5">
                {teacherHomeRoomRows.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => {
                      setSelectedRoomView(room.id);
                      scrollToSection(liveBoardSectionRef);
                    }}
                    className={cn(
                      "group w-full rounded-[1.25rem] border px-4 py-3 text-left transition-[transform,border-color,background-color] hover:-translate-y-0.5",
                      selectedRoomView === room.id
                        ? "border-[#FFB36D] bg-[#FFF5EA]"
                        : "border-[#DCE7FF] bg-white hover:border-[#C9D8FF] hover:bg-[#F8FBFF]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#14295F]">{getRoomLabel(room.id, roomConfigs)}</p>
                        <p className="mt-1 text-[11px] font-bold text-[#5C6E97]">
                          착석 {room.studying} · 외출 {room.away} · 배정 {room.assigned}/{room.physicalSeats}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#8A98B5] transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedRoomView('all');
                  scrollToSection(liveBoardSectionRef);
                }}
                className="h-11 w-full rounded-xl border-2 bg-white font-black text-[#14295F]"
              >
                전체 좌석 보기
              </Button>
            </CardContent>
          </Card>

          <Card className="admin-surface-primary overflow-hidden rounded-[2rem] border-[#DCE7FF] lg:col-span-4">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge className="h-6 rounded-full border-none bg-[#FFF2E8] px-2.5 text-[10px] font-black text-[#C95A08]">오늘 우선 조치</Badge>
                  <p className="mt-3 text-lg font-black tracking-tight text-[#14295F]">상위 3개만 고정</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsHeroPriorityDialogOpen(true)}
                  className="h-10 rounded-xl border-2 bg-white px-3 text-xs font-black text-[#14295F]"
                >
                  전체
                </Button>
              </div>
              {topTeacherPriority ? (
                <div className="rounded-[1.45rem] border border-[#FFD7B0] bg-[#FFF8F2] p-4">
                  <div className="flex items-start gap-3">
                    <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full", topTeacherPriority.toneClass)}>
                      {TopTeacherPriorityIcon ? <TopTeacherPriorityIcon className="h-5 w-5" /> : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="h-6 rounded-full border-none bg-[#FF7A16] px-2.5 text-[10px] font-black text-white">1순위</Badge>
                        <p className="truncate text-sm font-black text-[#14295F]">{topTeacherPriority.title}</p>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs font-bold leading-5 text-[#5C6E97]">{topTeacherPriority.detail}</p>
                      <Button
                        type="button"
                        onClick={topTeacherPriority.onClick}
                        className="mt-3 h-9 rounded-xl bg-[#14295F] px-3 text-xs font-black text-white hover:bg-[#10224C]"
                      >
                        {topTeacherPriority.actionLabel}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[1.45rem] border border-dashed border-[#DCE7FF] bg-white px-4 py-8 text-center text-sm font-black text-[#5C6E97]">
                  지금 바로 처리할 항목이 없습니다.
                </div>
              )}
              <div className="space-y-2.5">
                {secondaryTeacherPriorities.map((item, index) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={item.onClick}
                    className="group flex w-full items-center justify-between gap-3 rounded-[1.15rem] border border-[#DCE7FF] bg-white px-4 py-3 text-left transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-[#C9D8FF] hover:bg-[#F8FBFF]"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge className="h-5 rounded-full border-none bg-[#EEF4FF] px-2 text-[10px] font-black text-[#2554D7]">{index + 2}순위</Badge>
                        <p className="truncate text-sm font-black text-[#14295F]">{item.title}</p>
                      </div>
                      <p className="mt-1 truncate text-[11px] font-bold text-[#5C6E97]">{item.detail}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[#8A98B5] transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="admin-surface-primary overflow-hidden rounded-[2rem] border-[#DCE7FF] lg:col-span-4">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge className="h-6 rounded-full border-none bg-rose-50 px-2.5 text-[10px] font-black text-rose-600">학생 리스크</Badge>
                  <p className="mt-3 text-lg font-black tracking-tight text-[#14295F]">우선 확인 학생</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => scrollToSection(seatInsightSectionRef)}
                  className="h-10 rounded-xl border-2 bg-white px-3 text-xs font-black text-[#14295F]"
                >
                  히트맵
                </Button>
              </div>
              <div className="space-y-2.5">
                {teacherRiskCandidates.length === 0 ? (
                  <div className="rounded-[1.45rem] border border-dashed border-[#DCE7FF] bg-white px-4 py-8 text-center text-sm font-black text-[#5C6E97]">
                    현재 표시할 위험 학생이 없습니다.
                  </div>
                ) : (
                  teacherRiskCandidates.map((signal, index) => (
                    <button
                      key={`${signal.studentId}-${signal.seatId}`}
                      type="button"
                      onClick={() => {
                        if (signal.roomId) setSelectedRoomView(signal.roomId);
                        scrollToSection(seatInsightSectionRef);
                      }}
                      className="group w-full rounded-[1.2rem] border border-[#DCE7FF] bg-white px-4 py-3 text-left transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-[#C9D8FF] hover:bg-[#F8FBFF]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge className={cn("h-6 rounded-full border-none px-2.5 text-[10px] font-black", index === 0 ? "bg-rose-100 text-rose-700" : "bg-[#EEF4FF] text-[#2554D7]")}>
                              {signal.compositeHealth}점
                            </Badge>
                            <p className="truncate text-sm font-black text-[#14295F]">{signal.studentName}</p>
                          </div>
                          <p className="mt-1 truncate text-[11px] font-bold text-[#5C6E97]">
                            {signal.className || '반 미지정'} · {signal.primaryChip} · {signal.topReason}
                          </p>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#8A98B5] transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="admin-surface-primary overflow-hidden rounded-[2rem] border-[#DCE7FF] lg:col-span-5">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black text-[#2554D7]">상담·리포트</Badge>
                  <p className="mt-3 text-lg font-black tracking-tight text-[#14295F]">오늘 커뮤니케이션 흐름</p>
                </div>
                <Button asChild variant="outline" className="h-10 rounded-xl border-2 bg-white px-3 text-xs font-black text-[#14295F]">
                  <Link href="/dashboard/appointments">상담</Link>
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { label: '오늘 상담', value: teacherCounselingSummary.totalCount, tone: 'text-[#14295F]' },
                  { label: '승인 대기', value: teacherCounselingSummary.pendingCount, tone: teacherCounselingSummary.pendingCount > 0 ? 'text-[#C95A08]' : 'text-[#14295F]' },
                  { label: '미열람', value: unreadReportCount, tone: unreadReportCount > 0 ? 'text-[#C95A08]' : 'text-[#14295F]' },
                ].map((item) => (
                  <div key={item.label} className="rounded-[1.2rem] border border-[#DCE7FF] bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#5C6E97]">{item.label}</p>
                    <p className={cn("dashboard-number mt-2 text-2xl", item.tone)}>{item.value}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (recentReportsFeed[0]) {
                    setSelectedRecentReport(recentReportsFeed[0]);
                    return;
                  }
                  scrollToSection(reportsSectionRef);
                }}
                className="group w-full rounded-[1.25rem] border border-[#DCE7FF] bg-white px-4 py-3 text-left transition-[transform,border-color,background-color] hover:-translate-y-0.5 hover:border-[#C9D8FF] hover:bg-[#F8FBFF]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#14295F]">
                      {recentReportsFeed[0] ? `${recentReportsFeed[0].studentName || '학생'} 리포트` : '최근 리포트 없음'}
                    </p>
                    <p className="mt-1 truncate text-[11px] font-bold text-[#5C6E97]">
                      {recentReportsFeed[0]
                        ? `${recentReportsFeed[0].dateKey} · ${recentReportsFeed[0].viewedAt ? '열람 완료' : '미열람'}`
                        : '리포트 섹션에서 발송 흐름을 확인하세요.'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#8A98B5] transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            </CardContent>
          </Card>

          <Card className="admin-surface-elevated overflow-hidden rounded-[2rem] border-[#DCE7FF] shadow-[0_24px_48px_-36px_rgba(20,41,95,0.28)] lg:col-span-7">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge className="h-6 rounded-full border border-[#DCE7FF] bg-white px-2.5 text-[10px] font-black text-[#14295F]">학습 온도</Badge>
                  <p className="mt-3 text-lg font-black tracking-tight text-[#14295F]">최근 30일 누적 학습 흐름</p>
                  <p className="mt-1 text-xs font-semibold text-[#5C6E97]">홈 안에서 오늘 흐름과 장기 흐름을 함께 봅니다.</p>
                </div>
                <div className="flex items-center gap-2">
                  {trendLoading ? <Loader2 className="h-4 w-4 animate-spin text-[#8A98B5]" /> : null}
                  <Badge className="h-8 rounded-full border border-[#DCE7FF] bg-white px-3 text-[10px] font-black text-[#14295F]">
                    {trendLoading ? '업데이트 중' : '최근 30일'}
                  </Badge>
                </div>
              </div>
              <div className="h-[210px] w-full rounded-[1.55rem] border border-[#DCE7FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F6FAFF_100%)] px-1 pb-2 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={centerTrendData} margin={{ top: 10, right: 12, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="teacherHomeTrend" x1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6EE7B7" stopOpacity={0.32} />
                        <stop offset="95%" stopColor="#6EE7B7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(20,41,95,0.08)" />
                    <XAxis dataKey="name" fontSize={9} fontWeight="bold" axisLine={false} tickLine={false} tick={{ fill: '#6E7EA3' }} />
                    <YAxis width={42} fontSize={9} fontWeight="900" axisLine={false} tickLine={false} tick={{ fill: '#6E7EA3' }} />
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
                    <Area type="monotone" dataKey="hours" stroke="#6EE7B7" strokeWidth={3} fillOpacity={1} fill="url(#teacherHomeTrend)" animationDuration={prefersReducedMotion ? 0 : 1400} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.section>
    );
  }

  if (!mounted) return (
    <div className="flex flex-col h-[70vh] w-full items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      <p className="font-black text-primary tracking-tighter uppercase opacity-40">대시보드 불러오는 중...</p>
    </div>
  );

  return (
    <div className={cn("mx-auto flex min-h-screen w-full max-w-[1520px] flex-col gap-6", isMobile ? "px-2 pb-10 pt-3" : "px-4 py-6 pb-24")}>
      <AdminWorkbenchCommandBar
        eyebrow="실시간 운영"
        title="선생님 실시간 홈"
        description="오늘 조치와 실시간 좌석을 첫 화면에서 바로 판단할 수 있게 선생님 운영 흐름을 재정리했습니다."
        variant="adminStudio"
        quickActions={teacherWorkbenchQuickActions}
        selectValue={selectedClass}
        onSelectChange={setSelectedClass}
        selectOptions={classFilterOptions}
        selectLabel="운영 범위"
        className="top-3"
      >
        <Badge className="h-8 rounded-full border-none bg-white/12 px-3.5 text-[10px] font-black text-white">
          {currentTeacherScopeLabel}
        </Badge>
        <Badge className={cn("h-8 rounded-full border-none px-3.5 text-[10px] font-black", seatOverlaySummary.riskCount > 0 ? "bg-[#FF7A16] text-white" : "bg-white px-3.5 text-[#14295F]")}>
          위험 {seatOverlaySummary.riskCount}명
        </Badge>
        <Badge className={cn("h-8 rounded-full border-none px-3.5 text-[10px] font-black", unreadReportCount > 0 ? "bg-[#FFD7BA] text-[#14295F]" : "bg-white text-[#14295F]")}>
          미열람 {unreadReportCount}건
        </Badge>
      </AdminWorkbenchCommandBar>

      {renderTeacherHomeHeroSection()}
      <CenterAdminAttendanceBoard
        roomConfigs={roomConfigs}
        selectedRoomView={selectedRoomView}
        onRoomViewChange={setSelectedRoomView}
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
        <div className={cn("grid gap-6", isMobile || showInlineSeatInsightControls ? "grid-cols-1" : "lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.92fr)]")}>
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
                              <p className="text-[10px] font-black uppercase tracking-widest text-[#5c6e97]">사용 좌석</p>
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
                      <p className="mb-3 text-xs font-bold leading-5 text-[#8A5A2B]">
                        통로/좌석 전환은 바로 저장되고, 아래 저장 버튼은 가로·세로 구조를 바꿨을 때만 활성화됩니다.
                      </p>
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
                          {selectedRoomConfig.id !== PRIMARY_ROOM_ID && roomConfigs.length > 1 ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void handleDeleteRoom(selectedRoomConfig.id)}
                              disabled={isSaving}
                              className="h-11 rounded-xl border-rose-200 bg-white font-black text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="mr-1.5 h-4 w-4" />
                              {selectedRoomConfig.name} 삭제
                            </Button>
                          ) : null}
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
                            onClick={() => handleEditModeSaveClick(selectedRoomConfig.id)}
                            disabled={isSaving}
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
                            사용 좌석 {selectedRoomSummary?.assigned ?? 0}
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
                        <p className="text-sm font-black text-rose-700">축소 저장 시 함께 정리될 셀이 있습니다.</p>
                      </div>
                      <p className="mt-2 text-xs font-bold leading-relaxed text-rose-700/90">
                        저장하면 아래 셀의 배정, 임시 사용중, 통로 설정이 자동으로 정리됩니다.
                      </p>
                      <p className="mt-2 text-xs font-bold leading-relaxed text-rose-700/90">
                        {activeRoomConflicts
                          .slice(0, 5)
                          .map((seat) => formatSeatLabel(seat, roomConfigs, '좌석 미지정', persistedSeatLabelsBySeatId))
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

          {!showInlineSeatInsightControls ? (
          <div ref={seatInsightSectionRef} className={cn("space-y-5", isMobile ? "order-1" : "order-2")}>
            <Card className="marketing-card-soft overflow-hidden rounded-[2.65rem] border-none">
              <CardContent className={cn("space-y-5", isMobile ? "p-4" : "p-5 sm:p-6")}>
                {renderSeatOverlayControlPanel()}
              </CardContent>
            </Card>
          </div>
          ) : null}
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
                              <p className="max-w-[180px] truncate text-[10px] font-bold text-[#5c6e97]">{buildDailyReportPreview(report, 42)}</p>
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
                  {teacherOperationsInboxQueueItems.length}건
                </Badge>
              </div>
              <div className="space-y-1">
                <DialogTitle className="font-aggro-display text-2xl tracking-tight sm:text-[2rem]">
                  바로 확인할 항목
                </DialogTitle>
                <DialogDescription className="text-sm font-semibold leading-6 text-white/82">
                  미입실, 지각, 상담 문의, 방화벽 요청, 학부모 문의 가운데 지금 먼저 볼 항목만 추렸습니다.
                </DialogDescription>
              </div>
            </DialogHeader>
          </div>

          <div className="max-h-[68vh] overflow-y-auto bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)] p-5 sm:p-6">
            {teacherOperationsInboxQueueItems.length === 0 ? (
              <div className="rounded-[1.8rem] border border-dashed border-[#DCE7FF] bg-white px-6 py-12 text-center">
                <p className="text-base font-black text-[#14295F]">지금 바로 처리할 우선 항목이 없습니다.</p>
                <p className="mt-2 text-sm font-medium text-[#5c6e97]">현재 대시보드 흐름은 안정적입니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teacherOperationsInboxQueueItems.map((item, index) => {
                  const isExpanded = heroPriorityExpandedKey === item.key;

                  return (
                    <div key={item.key} className="rounded-[1.7rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_34px_-30px_rgba(20,41,95,0.18)]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black text-[#2554D7]">
                              {index === 0 ? '최우선' : `${index + 1}순위`}
                            </Badge>
                            <Badge className="h-6 rounded-full border-none bg-[#F7FAFF] px-2.5 text-[10px] font-black text-[#14295F]">
                              {item.label}
                            </Badge>
                          </div>
                          <p className="mt-3 text-base font-black text-[#14295F]">{item.title}</p>
                          <p className="mt-2 text-[12px] font-bold leading-6 text-[#5c6e97]">{item.detail}</p>
                          {item.meta ? (
                            <p className="mt-2 text-[11px] font-black text-[#8A98B5]">{item.meta}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end">
                        <Button
                          type="button"
                          className={cn(
                            'h-10 rounded-xl px-4 text-sm font-black',
                            isExpanded
                              ? 'border border-[#DCE7FF] bg-white text-[#14295F] hover:bg-[#F1F6FF]'
                              : 'bg-[#FF7A16] text-white hover:bg-[#E56D10]'
                          )}
                          onClick={() => setHeroPriorityExpandedKey((current) => (current === item.key ? null : item.key))}
                        >
                          {isExpanded ? '접기' : '바로 열기'}
                        </Button>
                      </div>
                      {isExpanded ? renderHeroPriorityInlineDetail(item) : null}
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

      <Dialog
        open={!!selectedAttendanceDetailSignal}
        onOpenChange={(open) => {
          if (!open) setSelectedAttendanceDetailSignal(null);
        }}
      >
        <DialogContent className={cn("overflow-hidden border-none p-0 shadow-2xl", isMobile ? "w-[calc(100vw-1rem)] rounded-[2rem]" : "sm:max-w-xl rounded-[2.2rem]")}>
          {selectedAttendanceDetail ? (
            <>
              <div className="bg-[linear-gradient(135deg,#14295F_0%,#1E4DB7_72%,#FF8B2B_100%)] p-6 text-white">
                <DialogHeader className="text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border border-white/14 bg-white/10 px-3 py-1 text-[10px] font-black text-white">
                      {selectedAttendanceDetail.seatLabel}
                    </Badge>
                    <Badge className="border border-white/14 bg-white/10 px-3 py-1 text-[10px] font-black text-white">
                      {selectedAttendanceDetail.signal.boardLabel}
                    </Badge>
                    {selectedAttendanceDetail.signal.wasLateToday ? (
                      <Badge className="border border-white/20 bg-[#FF7A16] px-3 py-1 text-[10px] font-black text-white">
                        오늘 지각O
                      </Badge>
                    ) : null}
                  </div>
                  <DialogTitle className="mt-4 text-2xl font-black tracking-tight">
                    {selectedAttendanceDetail.signal.studentName}
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-sm font-semibold leading-6 text-white/82">
                    {selectedAttendanceDetail.signal.note || '오늘 출결과 연락 정보를 바로 확인합니다.'}
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="space-y-3 bg-[#F7FAFF] p-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#DCE7FF] bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5C6E97]">원래 등원 예정</p>
                    <p className="mt-2 text-lg font-black text-[#14295F]">{selectedAttendanceDetail.plannedArrival}</p>
                  </div>
                  <div className="rounded-2xl border border-[#DCE7FF] bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5C6E97]">원래 하원 예정</p>
                    <p className="mt-2 text-lg font-black text-[#14295F]">{selectedAttendanceDetail.plannedDeparture}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#DCE7FF] bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5C6E97]">오늘 일정</p>
                  <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{selectedAttendanceDetail.scheduleLabel}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[#DCE7FF] bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5C6E97]">어머님 연락처</p>
                    <p className="mt-2 text-base font-black text-[#14295F]">{selectedAttendanceDetail.parentPhone}</p>
                    <p className="mt-1 text-[11px] font-bold text-[#6E7EA3]">{selectedAttendanceDetail.parentName}</p>
                  </div>
                  <div className="rounded-2xl border border-[#DCE7FF] bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5C6E97]">학생 연락처</p>
                    <p className="mt-2 text-base font-black text-[#14295F]">{selectedAttendanceDetail.studentPhone}</p>
                    <p className="mt-1 text-[11px] font-bold text-[#6E7EA3]">{selectedAttendanceDetail.studentMember?.className || selectedAttendanceDetail.student?.className || '반 정보 없음'}</p>
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t border-[#D7E4FF] bg-white px-5 py-4">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl font-black text-[#14295F]"
                  onClick={() => setSelectedAttendanceDetailSignal(null)}
                >
                  닫기
                </Button>
                <Button
                  type="button"
                  className="h-11 rounded-xl bg-[#14295F] font-black text-white hover:bg-[#10224C]"
                  onClick={() => {
                    const signal = selectedAttendanceDetail.signal;
                    setSelectedAttendanceDetailSignal(null);
                    openTeacherAttendanceSignal(signal);
                  }}
                >
                  교실에서 보기
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCenterPointDialogOpen}
        onOpenChange={(open) => {
          setIsCenterPointDialogOpen(open);
          if (!open) setExpandedCenterPointDateKey(null);
        }}
      >
        <DialogContent className={cn("flex min-h-0 flex-col overflow-hidden border-none p-0 shadow-2xl", isMobile ? "fixed inset-0 h-full w-full max-w-none rounded-none" : "max-h-[calc(100dvh-2rem)] sm:max-w-2xl rounded-[2.2rem]")}>
          <div className="shrink-0 bg-[linear-gradient(135deg,#14295F_0%,#1E4DB7_65%,#20A66B_100%)] p-6 text-white">
            <DialogHeader className="text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-white/14 bg-white/10 px-3 py-1 text-[10px] font-black text-white">
                  센터 포인트
                </Badge>
                <Badge className="border border-white/14 bg-white/10 px-3 py-1 text-[10px] font-black text-white">
                  최근 30일
                </Badge>
              </div>
              <DialogTitle className="mt-4 text-2xl font-black tracking-tight">
                포인트 배부 현황
              </DialogTitle>
              <DialogDescription className="mt-2 text-sm font-semibold leading-6 text-white/82">
                오늘 센터에서 나간 포인트와 최근 한달 일자별 학생 적립 내역입니다.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.35rem] border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/62">오늘 배부</p>
                <p className="dashboard-number mt-1.5 text-2xl text-white">{centerPointDistribution.todayTotal.toLocaleString()}P</p>
              </div>
              <div className="rounded-[1.35rem] border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/62">한달 합계</p>
                <p className="dashboard-number mt-1.5 text-2xl text-white">{centerPointDistribution.monthTotal.toLocaleString()}P</p>
              </div>
              <div className="rounded-[1.35rem] border border-white/10 bg-white/10 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/62">학생별 기록</p>
                <p className="dashboard-number mt-1.5 text-2xl text-white">{centerPointDistribution.studentGrantCount.toLocaleString()}건</p>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#F7FAFF] p-5">
            {centerPointDistribution.dailyRows.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-[#DCE7FF] bg-white px-5 py-10 text-center">
                <p className="text-sm font-black text-[#14295F]">최근 한달 포인트 배부 기록이 없습니다.</p>
                <p className="mt-2 text-xs font-bold leading-5 text-[#6E7EA3]">계획 완수, 공부상자, 랭킹 보상 등이 발생하면 여기에 쌓입니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {centerPointDistribution.dailyRows.map((day) => {
                  const isExpanded = expandedCenterPointDateKey === day.dateKey;
                  const topGrants = day.grants.slice(0, 3);

                  return (
                    <div key={day.dateKey} className="rounded-[1.5rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_34px_-32px_rgba(20,41,95,0.2)]">
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedCenterPointDateKey((current) => (current === day.dateKey ? null : day.dateKey))}
                        className="flex w-full items-start justify-between gap-3 border-b border-[#EEF4FF] pb-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2554D7] focus-visible:ring-offset-2"
                      >
                        <div>
                          <p className="text-sm font-black text-[#14295F]">{day.dateKey}</p>
                          <p className="mt-1 text-[11px] font-bold text-[#6E7EA3]">
                            {day.grants.length}명 적립 · 클릭하면 학생별 전체 내역
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge className="border-none bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-700">
                            {day.total.toLocaleString()}P
                          </Badge>
                          <ChevronRight className={cn("h-4 w-4 text-[#8FA5CF] transition-transform", isExpanded && "rotate-90")} />
                        </div>
                      </button>

                      <div className="mt-3 space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6E7EA3]">그날 포인트 TOP 3</p>
                        {topGrants.map((grant, index) => (
                          <div key={`top-${grant.key}`} className="flex items-center justify-between gap-3 rounded-2xl border border-[#EEF4FF] bg-[#F8FBFF] px-3 py-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <Badge className={cn("h-6 rounded-full border-none px-2 text-[10px] font-black", index === 0 ? "bg-[#FF7A16] text-white" : "bg-[#EEF4FF] text-[#2554D7]")}>
                                {index + 1}위
                              </Badge>
                              <p className="truncate text-sm font-black text-[#14295F]">{grant.studentName}</p>
                            </div>
                            <span className="shrink-0 text-sm font-black text-emerald-700">{grant.points.toLocaleString()}P</span>
                          </div>
                        ))}
                      </div>

                      {isExpanded ? (
                        <div className="mt-4 space-y-2 border-t border-[#EEF4FF] pt-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6E7EA3]">학생별 전체 상세</p>
                          {day.grants.map((grant) => (
                            <div key={grant.key} className="flex items-start justify-between gap-3 rounded-2xl border border-[#EEF4FF] bg-white px-3 py-2.5">
                              <div className="min-w-0">
                                <p className="text-sm font-black text-[#14295F]">{grant.studentName}</p>
                                <p className="mt-1 truncate text-[11px] font-bold text-[#6E7EA3]">{grant.detail}</p>
                              </div>
                              <span className="shrink-0 text-sm font-black text-emerald-700">{grant.points.toLocaleString()}P</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCounselTrackDialogOpen} onOpenChange={setIsCounselTrackDialogOpen}>
        <DialogContent
          className={cn(
            "overflow-hidden border-none p-0 shadow-2xl",
            isMobile ? "fixed inset-0 h-full w-full max-w-none rounded-none" : "sm:max-w-6xl rounded-[2.4rem]"
          )}
        >
          <div className="bg-[linear-gradient(135deg,#14295F_0%,#1E4DB7_58%,#FF8B2B_100%)] p-6 text-white sm:p-7">
            <DialogHeader className="space-y-4 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-white/14 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white">
                  상담·문의 트랙
                </Badge>
                <Badge className="border border-white/14 bg-white/10 px-3 py-1 text-[10px] font-black text-white">
                  {currentTeacherScopeLabel}
                </Badge>
              </div>
              <div className="space-y-1">
                <DialogTitle className="font-aggro-display text-2xl tracking-tight sm:text-[2rem]">
                  상담 문의와 요청을 바로 확인합니다
                </DialogTitle>
                <DialogDescription className="text-sm font-semibold leading-6 text-white/82">
                  예약 대기, 학생 문의, 방화벽 요청, 학부모 문의를 같은 모달 안에서 바로 확인할 수 있습니다.
                </DialogDescription>
              </div>
            </DialogHeader>
          </div>

          <div className="max-h-[78vh] overflow-y-auto bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)]">
            <AppointmentsPageContent forceTab={counselTrackDialogTab} />
          </div>
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
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">사용 좌석</p>
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
        <DialogContent className={cn("rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col", isMobile ? "fixed inset-0 w-full h-full max-w-none rounded-none" : "w-[calc(100vw-1.5rem)] max-w-[1100px] max-h-[90vh]")}>
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
              <div className="flex-1 overflow-y-auto bg-[#F7F9FC] custom-scrollbar p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <Badge className="border-none bg-[#EEF4FF] text-[#14295F] font-black">{selectedRecentReport.dateKey}</Badge>
                  <Badge className={cn("border-none font-black", selectedRecentReport.viewedAt ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                    {selectedRecentReport.viewedAt ? '열람 완료' : '미열람'}
                  </Badge>
                </div>
                <div className="mt-4">
                  <VisualReportViewer
                    content={selectedRecentReport.content || ''}
                    aiMeta={selectedRecentReport.aiMeta}
                    dateKey={selectedRecentReport.dateKey}
                    studentName={selectedRecentReport.studentName}
                  />
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
                      <div className={cn("relative space-y-4", isMobile ? "p-5" : "p-6 sm:p-6 lg:p-7")}>
                        <DialogHeader className="space-y-4">
                          <div className={cn("flex gap-4", isMobile ? "flex-col" : "items-start justify-between")}>
                            <div className="min-w-0 space-y-3">
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
                              <div className="space-y-2">
                                <DialogTitle className="text-2xl font-black tracking-tighter sm:text-3xl">
                                  {selectedStudentName}
                                </DialogTitle>
                                <DialogDescription className="max-w-[44rem] text-sm font-bold leading-6 text-white/84">
                                  {selectedSeatSignal?.topReason || selectedAttendanceSignal?.note || '오늘 가장 먼저 확인할 상태와 대응 포인트를 한 화면에서 정리했습니다.'}
                                </DialogDescription>
                              </div>
                            </div>

                            <div className={cn("grid gap-2.5", isMobile ? "grid-cols-2" : "min-w-[250px] grid-cols-2")}>
                              <div className="rounded-[1.45rem] border border-white/10 bg-white/10 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">실시간 세션</p>
                                <p className="mt-1.5 text-lg font-black tabular-nums text-white">{timeInfo?.session || '-'}</p>
                              </div>
                              <div className="rounded-[1.45rem] border border-white/10 bg-white/10 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">오늘 누적</p>
                                <p className="mt-1.5 text-lg font-black tabular-nums text-white">{timeInfo?.total || '-'}</p>
                              </div>
                            </div>
                          </div>
                        </DialogHeader>

                        <div className={cn("grid gap-2.5", isMobile ? "grid-cols-2" : "md:grid-cols-4")}>
                          <div className="rounded-[1.35rem] border border-white/10 bg-white/10 px-4 py-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/58">오늘 판정</p>
                            <p className="mt-1.5 text-sm font-black text-white">{selectedAttendanceSignal?.boardLabel || '확인중'}</p>
                          </div>
                          <div className="rounded-[1.35rem] border border-white/10 bg-white/10 px-4 py-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/58">최근 7일</p>
                            <p className="mt-1.5 text-sm font-black text-white">{selectedAttendanceSignal?.attendanceRiskLabel || '데이터 없음'}</p>
                          </div>
                          <div className="rounded-[1.35rem] border border-white/10 bg-white/10 px-4 py-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/58">최근 리포트</p>
                            <p className="mt-1.5 text-sm font-black text-white">{latestSelectedReport?.dateKey || '발송 없음'}</p>
                          </div>
                          <div className="rounded-[1.35rem] border border-white/10 bg-white/10 px-4 py-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/58">현재 벌점</p>
                            <p className="mt-1.5 text-sm font-black text-white">{selectedPenaltyRecovery.effectivePoints}점</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F7F9FC]">
                      <Tabs defaultValue="status" className="flex h-full min-h-0 w-full flex-col">
                        <div className="shrink-0 border-b border-[#DDE7FF] bg-white/88 backdrop-blur-sm">
                          <div className={cn("px-4 py-4", isMobile ? "" : "sm:px-6 sm:py-5")}>
                            <TabsList className="grid h-auto w-full grid-cols-4 rounded-[1.35rem] bg-[#EEF4FF] p-1">
                              <TabsTrigger value="status" className="rounded-[1rem] px-2 py-3 font-black text-[11px] tracking-tight text-slate-500 data-[state=active]:bg-white data-[state=active]:text-[#14295F] data-[state=active]:shadow-sm">실시간 상태</TabsTrigger>
                              <TabsTrigger value="history" className="rounded-[1rem] px-2 py-3 font-black text-[11px] tracking-tight text-slate-500 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">학습 히스토리</TabsTrigger>
                              <TabsTrigger value="penalty" className="rounded-[1rem] px-2 py-3 font-black text-[11px] tracking-tight text-slate-500 data-[state=active]:bg-white data-[state=active]:text-rose-700 data-[state=active]:shadow-sm">벌점 관리</TabsTrigger>
                              <TabsTrigger value="reports" className="rounded-[1rem] px-2 py-3 font-black text-[11px] tracking-tight text-slate-500 data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm">리포트 내역</TabsTrigger>
                            </TabsList>
                          </div>
                        </div>

                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                          <TabsContent value="status" className="mt-0 min-h-0 flex-1 overflow-y-auto custom-scrollbar p-5 pb-12 data-[state=active]:flex data-[state=active]:flex-col sm:p-6 sm:pb-14 space-y-5">
                            <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]")}>
                              <motion.div {...getDeckMotionProps(0.03, 10)} className="rounded-[2rem] border border-[#D7E4FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] p-5 shadow-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                  {selectedSeatSignal ? (
                                    <>
                                      <Badge
                                        className={cn(
                                          "border-none font-black",
                                          selectedSeatPresentation.isDark
                                            ? "bg-[#14295F] text-white"
                                            : selectedSeatPresentation.chipClass
                                        )}
                                      >
                                        {selectedSeatSignal.primaryChip}
                                      </Badge>
                                      {selectedSeatSignal.secondaryFlags.map((flag) => (
                                        <Badge
                                          key={`${selectedSeat.id}_${flag}`}
                                          className={cn(
                                            "font-black",
                                            selectedSeatPresentation.isDark
                                              ? "border border-[#D7E4FF] bg-[#F7FAFF] text-[#5C6E97]"
                                              : selectedSeatPresentation.flagClass
                                          )}
                                        >
                                          {flag}
                                        </Badge>
                                      ))}
                                    </>
                                  ) : (
                                    <Badge className="border-none bg-[#EEF4FF] font-black text-[#2554D7]">운영 신호 확인중</Badge>
                                  )}
                                </div>
                                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.22em] text-[#5C6E97]">First Check</p>
                                <h4 className="mt-2 text-xl font-black leading-snug tracking-tight text-[#14295F]">
                                  {selectedSeatSignal?.topReason || selectedAttendanceSignal?.note || '지금 바로 개입이 필요한 포인트가 없습니다.'}
                                </h4>
                                <p className="mt-3 text-sm font-bold leading-6 text-[#5C6E97]">
                                  {selectedSeatDomainInsight
                                    ? `대응: ${selectedSeatDomainInsight.action}`
                                    : selectedAttendanceSignal?.note || '상단 브리프 기준으로 가장 먼저 확인할 상태를 요약합니다.'}
                                </p>
                              </motion.div>

                              <motion.div {...getDeckMotionProps(0.06, 10)} className="rounded-[2rem] border border-[#D7E4FF] bg-white p-5 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/48">Quick Action</p>
                                    <h4 className="mt-2 text-lg font-black tracking-tight text-[#14295F]">
                                      {isEditMode ? '좌석 관리 액션' : '지금 바로 실행'}
                                    </h4>
                                  </div>
                                  <Badge className={cn(
                                    "h-7 rounded-full border-none px-3 text-[10px] font-black",
                                    isEditMode ? "bg-[#FFF2E8] text-[#C95A08]" : "bg-[#EEF4FF] text-[#2554D7]"
                                  )}>
                                    {isEditMode ? '편집 모드' : '실시간 조치'}
                                  </Badge>
                                </div>
                                <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
                                  {selectedSeatAvailabilityCopy}
                                </p>

                                {isEditMode ? (
                                  <div className="mt-4 space-y-3">
                                    <div className="rounded-[1.45rem] border border-[#D7E4FF] bg-[#F8FBFF] px-4 py-3">
                                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">현재 설정</p>
                                      <p className="mt-1 text-sm font-black text-[#14295F]">
                                        {selectedSeatModeLabel} · {selectedSeatZoneLabel} · {selectedSeatGenderLabel} · 번호 {selectedSeatDisplayLabel || selectedSeatDefaultLabel || '-'}
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                                        <LayoutGrid className="h-3 w-3" /> 좌석 번호 설정
                                      </Label>
                                      <div className="flex gap-2">
                                        <Input
                                          value={seatLabelDraft}
                                          onChange={(event) => setSeatLabelDraft(event.target.value.slice(0, 12))}
                                          placeholder={selectedSeatDefaultLabel || '예: 64'}
                                          className="h-12 rounded-xl border-2 font-bold shadow-sm"
                                        />
                                        <Button
                                          type="button"
                                          onClick={handleSaveSeatLabel}
                                          disabled={
                                            isSaving ||
                                            !selectedSeat?.roomSeatNo ||
                                            normalizeSeatLabelValue(seatLabelDraft) === (selectedSeatDisplayLabel || selectedSeatDefaultLabel)
                                          }
                                          className="h-12 rounded-xl px-4 font-black whitespace-nowrap"
                                        >
                                          번호 저장
                                        </Button>
                                      </div>
                                      <p className="ml-1 text-[11px] font-semibold leading-5 text-slate-500">
                                        비워두거나 기본 번호 {selectedSeatDefaultLabel || '-'}와 같게 저장하면 도면 기본 순번으로 돌아갑니다.
                                      </p>
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500"><MapPin className="h-3 w-3" /> 좌석 구역 설정</Label>
                                      <Select
                                        value={selectedSeat.seatZone || '미정'}
                                        onValueChange={handleUpdateZone}
                                        disabled={selectedSeat?.type === 'aisle' || isSaving}
                                      >
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
                                      {selectedSeat?.type === 'aisle' ? (
                                        <p className="ml-1 text-[11px] font-semibold leading-5 text-slate-500">
                                          통로 상태에서는 구역 설정이 잠깁니다. 좌석으로 다시 전환하면 바로 변경할 수 있습니다.
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="ml-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500"><Users className="h-3 w-3" /> 좌석 성별 설정</Label>
                                      <Select
                                        value={selectedSeat?.type === 'aisle' ? 'all' : selectedSeatGenderPolicy}
                                        onValueChange={handleUpdateSeatGender}
                                        disabled={selectedSeat?.type === 'aisle' || isSaving}
                                      >
                                        <SelectTrigger className="h-12 rounded-xl border-2 font-bold shadow-sm">
                                          <SelectValue placeholder="성별 구분 선택" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl border-none shadow-2xl">
                                          <SelectItem value="all" className="font-bold">공용</SelectItem>
                                          <SelectItem value="male" className="font-bold">남학생 전용</SelectItem>
                                          <SelectItem value="female" className="font-bold">여학생 전용</SelectItem>
                                        </SelectContent>
                                      </Select>
                                      {selectedSeat?.type === 'aisle' ? (
                                        <p className="ml-1 text-[11px] font-semibold leading-5 text-slate-500">
                                          통로 상태에서는 성별 좌석 구분이 잠깁니다. 좌석으로 다시 전환하면 바로 변경할 수 있습니다.
                                        </p>
                                      ) : (
                                        <p className="ml-1 text-[11px] font-semibold leading-5 text-slate-500">
                                          공개 좌석 보기와 좌석예약에서도 이 성별 기준이 그대로 적용됩니다.
                                        </p>
                                      )}
                                    </div>
                                    <Button variant="destructive" onClick={unassignStudentFromSeat} disabled={isSaving || !selectedSeat?.studentId} className="h-12 w-full rounded-xl font-black shadow-lg shadow-rose-100">
                                      좌석 배정 해제
                                    </Button>
                                    <Button variant="outline" onClick={handleToggleCellType} disabled={isSaving} className="h-11 w-full rounded-xl border-2 font-black gap-2">
                                      <ArrowRightLeft className="h-4 w-4" />
                                      {selectedSeat?.type === 'aisle' ? '좌석으로 다시 전환' : '통로로 전환하기'}
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="mt-4 grid grid-cols-2 gap-3">
                                    <Button onClick={() => handleStatusUpdate('studying')} disabled={isSaving} className="h-16 rounded-[1.45rem] bg-blue-600 font-black text-white shadow-lg shadow-blue-200 hover:bg-blue-700">
                                      <div className="flex flex-col items-center gap-1">
                                        <Zap className="h-5 w-5 fill-current" />
                                        <span className="text-sm leading-none">입실 확인</span>
                                      </div>
                                    </Button>
                                    <Button variant="outline" onClick={() => handleStatusUpdate('absent')} disabled={isSaving} className="h-16 rounded-[1.45rem] border-2 border-rose-100 font-black text-rose-600 hover:bg-rose-50">
                                      <div className="flex flex-col items-center gap-1">
                                        <AlertCircle className="h-5 w-5" />
                                        <span className="text-sm leading-none">퇴실 처리</span>
                                      </div>
                                    </Button>
                                  </div>
                                )}
                              </motion.div>
                            </div>

                            <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-2 xl:grid-cols-4")}>
                              <div className="rounded-[1.7rem] border border-[#D7E4FF] bg-white p-4 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/48">오늘 판정</p>
                                <p className="mt-2 text-base font-black text-[#14295F]">{selectedAttendanceSignal?.boardLabel || '확인중'}</p>
                                <p className="mt-2 text-xs font-bold text-slate-500">{selectedAttendanceSignal?.note || '현재 상태를 기준으로 운영 신호를 표시합니다.'}</p>
                              </div>
                              <div className="rounded-[1.7rem] border border-[#D7E4FF] bg-white p-4 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/48">루틴 예정</p>
                                <p className="mt-2 text-base font-black text-[#14295F]">{selectedAttendanceSignal?.routineExpectedArrivalTime || '미설정'}</p>
                                <p className="mt-2 text-xs font-bold text-slate-500">도착 루틴과 실제 출결 흐름을 함께 확인합니다.</p>
                              </div>
                              <div className="rounded-[1.7rem] border border-[#D7E4FF] bg-white p-4 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/48">오늘 공부</p>
                                <p className="mt-2 text-base font-black text-[#14295F]">{selectedAttendanceSignal?.todayStudyLabel || timeInfo?.total || '-'}</p>
                                <p className="mt-2 text-xs font-bold text-slate-500">실시간 세션과 누적 시간을 같이 읽습니다.</p>
                              </div>
                              <div className="rounded-[1.7rem] border border-[#D7E4FF] bg-white p-4 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/48">복귀/퇴실</p>
                                <p className="mt-2 text-base font-black text-[#14295F]">
                                  {selectedAttendanceSignal?.isReturned
                                    ? '복귀'
                                    : selectedAttendanceSignal?.isCheckedOut
                                      ? selectedAttendanceSignal.lastCheckOutLabel
                                        ? `퇴실 ${selectedAttendanceSignal.lastCheckOutLabel}`
                                        : '퇴실'
                                      : selectedAttendanceSignal?.seatStatus === 'away' || selectedAttendanceSignal?.seatStatus === 'break'
                                        ? '외출 중'
                                        : '진행 중'}
                                </p>
                                <p className="mt-2 text-xs font-bold text-slate-500">
                                  {selectedAttendanceSignal?.isCheckedOut
                                    ? [
                                        selectedAttendanceSignal.wasLateToday ? '오늘 지각O' : '오늘 지각X',
                                        selectedAttendanceSignal.firstCheckInLabel ? `최초입실 ${selectedAttendanceSignal.firstCheckInLabel}` : null,
                                        selectedAttendanceSignal.lastCheckOutLabel ? `마지막퇴실 ${selectedAttendanceSignal.lastCheckOutLabel}` : null,
                                      ].filter(Boolean).join(' · ')
                                    : isEditMode ? '바로 위 관리 액션에서 설정을 수정할 수 있습니다.' : '빠른 조치는 위 액션 카드에서 바로 처리합니다.'}
                                </p>
                              </div>
                            </div>

                            <motion.div {...getDeckMotionProps(0.09, 10)} className="rounded-[1.9rem] border border-[#D7E4FF] bg-white p-4 shadow-sm">
                              <button
                                type="button"
                                onClick={() => setIsSeatSecondaryExpanded((current) => !current)}
                                className="flex w-full items-center justify-between gap-3 text-left"
                              >
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5C6E97]">보조 정보</p>
                                  <p className="mt-1 text-sm font-black text-[#14295F]">AI 해석 · 도메인 점수 · 운영 메모</p>
                                </div>
                                <ChevronRight className={cn("h-4 w-4 text-[#5C6E97] transition-transform", isSeatSecondaryExpanded && "rotate-90")} />
                              </button>

                              {isSeatSecondaryExpanded ? (
                                <div className="mt-4 space-y-4 border-t border-[#E4ECFA] pt-4">
                                  <div className="rounded-[1.7rem] border border-[#D7E4FF] bg-[#F8FBFF] p-4">
                                    <div className="flex items-center justify-between gap-3">
                                      <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5C6E97]">선택된 AI 해석</p>
                                        <p className="mt-1 text-base font-black text-[#14295F]">
                                          {selectedSeatDomainInsight ? `${selectedSeatDomainInsight.label} ${selectedSeatDomainInsight.score}점` : '도메인 해석 준비중'}
                                        </p>
                                      </div>
                                      {selectedSeatDomainInsight ? (
                                        <Badge className={cn("border-none font-black", selectedSeatDomainInsight.badgeClass)}>
                                          {selectedSeatDomainInsight.score}
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <p className="mt-3 text-sm font-bold leading-6 text-slate-600">
                                      {selectedSeatDomainInsight?.analysis || '도메인 점수를 선택하면 왜 이 점수가 나왔는지와 바로 할 대응을 보여줍니다.'}
                                    </p>
                                    {selectedSeatDomainInsight ? (
                                      <p className="mt-3 text-xs font-bold leading-5 text-slate-500">
                                        대응: {selectedSeatDomainInsight.action}
                                      </p>
                                    ) : null}
                                  </div>

                                  {selectedSeatSignal ? (
                                    <div>
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-[11px] font-bold text-slate-500">
                                          점수를 누르면 개입 이유와 다음 대응이 바로 바뀝니다.
                                        </p>
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
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
                                                "rounded-[1.25rem] border px-3 py-3 text-center transition-all",
                                                isActive
                                                  ? "border-[#14295F] bg-[#14295F] text-white shadow-lg shadow-[#14295F]/10"
                                                  : "border-[#D7E4FF] bg-[#F8FBFF] text-[#14295F] hover:border-[#BFD1F8] hover:bg-white"
                                              )}
                                            >
                                              <p className={cn("text-[10px] font-black uppercase tracking-[0.16em]", isActive ? "text-white/70" : "text-slate-500")}>{domain.label}</p>
                                              <Badge className={cn("mt-2 border-none font-black", isActive ? "bg-white/14 text-white" : domain.badgeClass)}>
                                                {domain.score}
                                              </Badge>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : null}

                                  <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "sm:grid-cols-3")}>
                                    <div className="rounded-[1.45rem] bg-[#F7FAFF] px-4 py-3">
                                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">최근 학습 기록</p>
                                      <p className="mt-1 text-sm font-black text-[#14295F]">
                                        {selectedStudentHistoryMetrics.latestDateKey ? `${selectedStudentHistoryMetrics.latestDateKey} · ${formatDurationMinutes(selectedStudentHistoryMetrics.latestMinutes)}` : '기록 없음'}
                                      </p>
                                    </div>
                                    <div className="rounded-[1.45rem] bg-[#FFF7F7] px-4 py-3">
                                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-500">최근 벌점</p>
                                      <p className="mt-1 text-sm font-black text-slate-700">
                                        {latestSelectedPenaltyLog?.reason || '최근 벌점 기록 없음'}
                                      </p>
                                    </div>
                                    <div className="rounded-[1.45rem] bg-[#FFF9F0] px-4 py-3">
                                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-600">최근 리포트</p>
                                      <p className="mt-1 text-sm font-black text-slate-700">
                                        {latestSelectedReport?.dateKey || '발송 이력 없음'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </motion.div>

                            <div className="space-y-4">
                              <div className="flex items-center justify-between px-1">
                                <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary/60"><History className="h-3 w-3" /> 오늘의 몰입 세션</h4>
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  {selectedAttendanceSignal && canAdjustStudySession ? (
                                    <div className="flex items-center gap-1 rounded-full border border-[#DCE7FF] bg-white p-1">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="h-7 rounded-full border-[#DCE7FF] px-2.5 text-[10px] font-black text-[#14295F]"
                                        disabled={quickSessionAdjustingStudentId === selectedAttendanceSignal.studentId || selectedAttendanceSignal.todayStudyMinutes <= 0}
                                        onClick={() => handleQuickStudySessionAdjustment(selectedAttendanceSignal, -5)}
                                      >
                                        {quickSessionAdjustingStudentId === selectedAttendanceSignal.studentId ? <Loader2 className="h-3 w-3 animate-spin" /> : '-5분'}
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-7 rounded-full bg-[#14295F] px-2.5 text-[10px] font-black text-white hover:bg-[#10224C]"
                                        disabled={quickSessionAdjustingStudentId === selectedAttendanceSignal.studentId}
                                        onClick={() => handleQuickStudySessionAdjustment(selectedAttendanceSignal, 5)}
                                      >
                                        {quickSessionAdjustingStudentId === selectedAttendanceSignal.studentId ? <Loader2 className="h-3 w-3 animate-spin" /> : '+5분'}
                                      </Button>
                                    </div>
                                  ) : null}
                                  <span className="text-[9px] font-bold uppercase text-muted-foreground">{todayKey}</span>
                                </div>
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

                          <TabsContent value="history" className="mt-0 min-h-0 flex-1 overflow-y-auto custom-scrollbar p-5 pb-12 data-[state=active]:flex data-[state=active]:flex-col sm:p-6 sm:pb-14 space-y-6">
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

                          <TabsContent value="penalty" className="mt-0 min-h-0 flex-1 overflow-y-auto custom-scrollbar p-5 pb-12 data-[state=active]:flex data-[state=active]:flex-col sm:p-6 sm:pb-14 space-y-6">
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

                          <TabsContent value="reports" className="mt-0 min-h-0 flex-1 overflow-y-auto custom-scrollbar p-5 pb-12 data-[state=active]:flex data-[state=active]:flex-col sm:p-6 sm:pb-14 space-y-6">
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
                                          <p className="mt-3 line-clamp-2 text-sm font-bold leading-6 text-slate-700">{buildDailyReportPreview(report, 92)}</p>
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
                        <DialogContent className={cn("overflow-hidden border-none p-0 shadow-2xl", isMobile ? "fixed inset-0 h-full w-full max-w-none rounded-none" : "h-[min(920px,calc(100dvh-1rem))] w-[calc(100vw-1.5rem)] max-h-[calc(100dvh-1rem)] max-w-[1120px] rounded-[2.5rem]")}>
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
                                      학부모가 받는 리포트 기준으로 그래프와 코칭 흐름까지 함께 검토할 수 있는 상세 화면입니다.
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
                                          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#14295F]">Parent Report View</p>
                                          <p className="mt-1 text-base font-black text-slate-900">학부모 확인 화면 그대로 보기</p>
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
                                      <div className="mt-5">
                                        <VisualReportViewer
                                          content={selectedReportPreview.content || ''}
                                          aiMeta={selectedReportPreview.aiMeta}
                                          dateKey={selectedReportPreview.dateKey}
                                          studentName={selectedStudentName}
                                        />
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
                    <p className="mt-1 text-xs font-semibold text-white/72">성별 기준: {selectedSeatGenderLabel}</p>
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
                      {selectedSeat?.type === 'aisle'
                        ? '학생 검색은 숨김 처리됩니다.'
                        : selectedSeatHasManualOccupant
                          ? '임시 사용중을 해제한 뒤 실제 학생 배정을 이어갈 수 있습니다.'
                          : '빈 좌석일 때만 학생 배정을 이어갑니다.'}
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
                        좌석과 통로 상태를 먼저 정리하고, 좌석인 경우 구역과 성별 기준까지 함께 고정합니다.
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
                        <div className="space-y-4">
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

                          <div className="rounded-[1.7rem] border border-[#D7E4FF] bg-[#F7FAFF] p-5">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-[#14295F]" />
                              <Label className="text-[10px] font-black uppercase tracking-[0.22em] text-[#5C6E97]">
                                좌석 성별 설정
                              </Label>
                            </div>
                            <p className="mt-3 text-base font-black text-[#14295F]">현재 기준: {selectedSeatGenderLabel}</p>
                            <p className="mt-2 text-sm font-semibold leading-6 text-[#5C6E97]">
                              홍보페이지 좌석 보기와 좌석예약 단계에서도 같은 성별 기준을 사용합니다.
                            </p>
                            <Select value={selectedSeatGenderPolicy} onValueChange={handleUpdateSeatGender} disabled={isSaving}>
                              <SelectTrigger className="mt-5 h-12 rounded-[1.05rem] border border-[#D7E4FF] bg-white px-4 font-black text-[#14295F] shadow-none">
                                <SelectValue placeholder="성별 구분 선택" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-none shadow-2xl">
                                <SelectItem value="all" className="font-bold text-[#14295F]">공용</SelectItem>
                                <SelectItem value="male" className="font-bold text-[#14295F]">남학생 전용</SelectItem>
                                <SelectItem value="female" className="font-bold text-[#14295F]">여학생 전용</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
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
                      {selectedSeat?.type === 'aisle'
                        ? '활성화 필요'
                        : selectedSeatHasManualOccupant
                          ? '임시 사용중'
                          : unassignedStudentCountLabel}
                    </div>
                  </div>

                  {selectedSeat?.type !== 'aisle' ? (
                    <div className="mt-6 space-y-4">
                      {canManageManualSeatOccupancy ? (
                        <div className="rounded-[1.6rem] border border-[#D7E4FF] bg-[#F7FAFF] p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-[#14295F]">회원가입 전 학생 임시 사용중</p>
                              <p className="mt-1 text-xs font-semibold leading-5 text-[#5C6E97]">
                                실제 등록 전 학생이나 선예약 좌석을 운영실에서 먼저 막아둘 수 있습니다.
                              </p>
                            </div>
                            {selectedSeatHasManualOccupant ? (
                              <Badge className="border-none bg-[#14295F] text-[10px] font-black text-white">
                                {selectedSeatManualOccupantName}
                              </Badge>
                            ) : (
                              <Badge className="border-none bg-white text-[10px] font-black text-[#14295F]">
                                빈 좌석
                              </Badge>
                            )}
                          </div>
                          {selectedSeat?.studentId ? (
                            <div className="mt-4 rounded-[1.2rem] bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#5C6E97]">
                              현재는 실제 학생이 배정된 좌석이라 임시 사용중 등록이 잠겨 있습니다.
                            </div>
                          ) : (
                            <>
                              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                <Input
                                  value={manualSeatOccupantName}
                                  onChange={(event) => setManualSeatOccupantName(event.target.value)}
                                  placeholder="예: 대기 등록 김민준"
                                  className="h-12 rounded-[1.05rem] border border-[#D7E4FF] bg-white font-black text-[#14295F] placeholder:text-[#7F91B3]"
                                />
                                <Button
                                  type="button"
                                  onClick={() => void handleSaveManualSeatOccupancy()}
                                  disabled={isSaving || !manualSeatOccupantName.trim()}
                                  className="h-12 rounded-[1.05rem] bg-[#14295F] px-5 font-black text-white hover:bg-[#10224e]"
                                >
                                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                  {selectedSeatHasManualOccupant ? '임시 사용중 수정' : '임시 사용중 등록'}
                                </Button>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {selectedSeatHasManualOccupant ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => void handleClearManualSeatOccupancy()}
                                    disabled={isSaving}
                                    className="h-10 rounded-[1rem] border-[#D7E4FF] font-black text-[#14295F]"
                                  >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    임시 사용중 해제
                                  </Button>
                                ) : null}
                                <p className="self-center text-[11px] font-semibold leading-5 text-[#5C6E97]">
                                  등록 후에는 임시 사용중을 해제하고 실제 학생 배정으로 이어가면 됩니다.
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}

                      {selectedSeatHasManualOccupant ? (
                        <div className="rounded-[1.8rem] bg-[#14295F] p-6 text-white shadow-[0_18px_36px_rgba(20,41,95,0.2)]">
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/68">Manual Hold</p>
                          <p className="mt-3 text-lg font-black text-white">임시 사용중 좌석입니다.</p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-white/78">
                            {selectedSeatManualOccupantName} 이름으로 사용 중이라 학생 배정 리스트를 잠시 숨겨두었습니다. 먼저 임시 사용중을 해제한 뒤 실제 학생을 연결해 주세요.
                          </p>
                        </div>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-[1.8rem] bg-[#14295F] p-6 text-white shadow-[0_18px_36px_rgba(20,41,95,0.2)]">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/68">Assign Activation</p>
                      <p className="mt-3 text-lg font-black text-white">학생 배정을 바로 다시 열 수 있습니다.</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-white/78">
                        지금은 통로로 설정되어 있어 학생 검색과 배정 리스트를 숨겨둔 상태입니다. 아래 버튼을 누르면 이 칸을 좌석으로 되돌리고, 바로 학생 배정 흐름으로 이어집니다.
                      </p>
                      <Button
                        type="button"
                        onClick={handleToggleCellType}
                        disabled={isSaving}
                        className="mt-5 h-12 w-full rounded-[1.05rem] bg-white font-black text-[#14295F] hover:bg-white/92"
                      >
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                        학생 배정 활성화
                      </Button>
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
