
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
import { Label } from '@/components/ui/label';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
  CalendarClock,
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
  Link2,
  Wifi,
} from 'lucide-react';
import { useFirestore, useCollection, useFunctions, useDoc, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { addDoc, collection, query, where, Timestamp, doc, limit, getDoc, getDocs, orderBy, serverTimestamp, documentId } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { AttendanceCurrent, AttendanceRequest, CounselingReservation, DailyStudentStat, DailyReport, CenterMembership, InviteCode, GrowthProgress, ParentActivityEvent, CounselingLog, LayoutRoomConfig, StudentProfile, StudyLogDay, OpenClawIntegrationDoc, OpenClawSnapshotRecordCounts, PointBoostEvent } from '@/lib/types';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { logHandledClientIssue } from '@/lib/handled-client-log';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { AdminWorkbenchCommandBar } from '@/components/dashboard/admin-workbench-command-bar';
import { CenterAdminAttendanceBoard } from '@/components/dashboard/center-admin-attendance-board';
import { CenterAdminHeatmapCharts } from '@/components/dashboard/center-admin-heatmap-charts';
import type { CenterAdminAttendanceSeatSignal } from '@/lib/center-admin-attendance-board';
import { AppointmentsPageContent } from '@/app/dashboard/appointments/appointments-page-content';
import {
  OperationsInbox,
  type OperationsInboxPanel,
  type OperationsInboxQueueItem,
  type OperationsInboxSummaryChip,
} from '@/components/dashboard/operations-inbox';
import { motion, useReducedMotion } from 'framer-motion';
import { buildNoShowFlag } from '@/features/schedules/lib/buildNoShowFlag';
import { useCenterAdminAttendanceBoard } from '@/hooks/use-center-admin-attendance-board';
import { useCenterAdminHeatmap } from '@/hooks/use-center-admin-heatmap';
import { getAttendanceRequestTypeLabel, getScheduleChangeReasonLabel } from '@/lib/attendance-request';
import {
  buildCounselingTrackOverview,
  type DashboardCounselTrackTab,
  type DashboardParentCommunicationRecord,
  formatDashboardTrackTime,
  getCommunicationKindLabel,
  normalizeParentCommunicationRecord,
} from '@/lib/dashboard-communications';
import {
  buildSeatId,
  getGlobalSeatNo,
  normalizeLayoutRooms,
  resolveSeatIdentity,
} from '@/lib/seat-layout';
import { toStudyRoomTrackScheduleName } from '@/lib/study-room-class-schedule';
import { createPointBoostEventSecure, cancelPointBoostEventSecure } from '@/lib/point-boost-actions';
import { getDailyPointBreakdown } from '@/lib/student-rewards';

const ADMIN_DASHBOARD_REFRESH_INTERVAL_MS = 60 * 1000;
const MANUAL_PARENT_SMS_UID = '__manual_parent__';
const STUDENT_SMS_FALLBACK_UID = '__student__';

type AdminSmsRecipientPreference = {
  id: string;
  studentId?: string;
  parentUid?: string;
  parentName?: string;
  phoneNumber?: string;
  enabled?: boolean;
  isManualRecipient?: boolean;
  isFallbackRecipient?: boolean;
};

const buildSmsRecipientPreferenceId = (studentId: string, parentUid: string) => `${studentId}_${parentUid}`;

const buildAdminCheckInTimeLabel = (
  signal: Pick<CenterAdminAttendanceSeatSignal, 'checkedAtLabel' | 'firstCheckInLabel'>,
  fallback = '입실 시간 확인 필요'
) => {
  const firstCheckInLabel = signal.firstCheckInLabel?.trim();
  const checkedAtLabel = signal.checkedAtLabel?.trim();

  if (firstCheckInLabel && checkedAtLabel && firstCheckInLabel !== checkedAtLabel) {
    return `최초입실 ${firstCheckInLabel} · 최근입실 ${checkedAtLabel}`;
  }
  if (firstCheckInLabel) return `최초입실 ${firstCheckInLabel}`;
  if (checkedAtLabel) return `입실 ${checkedAtLabel}`;
  return fallback;
};

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

const STAFF_MEMBER_ROLES: CenterMembership['role'][] = ['teacher', 'centerAdmin', 'owner'];

const getStaffRoleLabel = (role?: CenterMembership['role'] | null): string => {
  if (role === 'centerAdmin') return '센터관리자';
  if (role === 'owner') return '원장';
  return '선생님';
};

const resolveDateKey = (docId: string, rawDateKey: unknown): string => {
  if (typeof rawDateKey === 'string' && rawDateKey.trim()) {
    return rawDateKey.trim();
  }
  return docId;
};

const DAY_RANGE_MS = 24 * 60 * 60 * 1000;

const formatPointBoostMultiplier = (value: number): string => {
  const safe = Number(value);
  if (!Number.isFinite(safe) || safe <= 0) return '1배';
  const label = Number.isInteger(safe) ? safe.toFixed(0) : safe.toFixed(2).replace(/\.?0+$/, '');
  return `${label}배`;
};

const buildDefaultPointBoostMessage = (multiplier: number): string =>
  `지금부터 상자 pt가 ${formatPointBoostMultiplier(multiplier)}로 적용돼요. 집중한 만큼 더 크게 받아가세요!`;

const resolvePointBoostMessage = (message: unknown, multiplier: number): string => {
  if (typeof message !== 'string') {
    return buildDefaultPointBoostMessage(multiplier);
  }

  const trimmed = message.trim();
  return trimmed || buildDefaultPointBoostMessage(multiplier);
};

const formatPointsInPt = (value: number): string => `${value.toLocaleString()}pt`;

type PointHistoryWindow = 'today' | '7d' | '30d';

type PointHistoryGrantRow = {
  key: string;
  dateKey: string;
  studentId: string;
  studentName: string;
  className: string;
  totalPoints: number;
  studyBoxPoints: number;
  rankPoints: number;
  otherPoints: number;
  detail: string;
};

type PointHistoryRow = {
  studentId: string;
  studentName: string;
  className: string;
  totalPoints: number;
  studyBoxPoints: number;
  rankPoints: number;
  otherPoints: number;
};

type PointHistorySummary = {
  totalPoints: number;
  studyBoxPoints: number;
  rankPoints: number;
  otherPoints: number;
  earners: number;
};

type PointHistoryDailySummary = PointHistorySummary & {
  dateKey: string;
  grants: PointHistoryGrantRow[];
};

const POINT_HISTORY_WINDOW_ORDER: PointHistoryWindow[] = ['today', '7d', '30d'];

const EMPTY_POINT_HISTORY_SUMMARY: PointHistorySummary = {
  totalPoints: 0,
  studyBoxPoints: 0,
  rankPoints: 0,
  otherPoints: 0,
  earners: 0,
};

const buildRecentDateKeys = (referenceDate: Date | null, dayCount: number): string[] => {
  if (!referenceDate || dayCount <= 0) return [];
  return Array.from({ length: dayCount }, (_, index) => format(subDays(referenceDate, index), 'yyyy-MM-dd'));
};

function formatPointBreakdownDetail(breakdown: ReturnType<typeof getDailyPointBreakdown>): string {
  const eventLabels = Array.isArray(breakdown.pointItems)
    ? breakdown.pointItems
        .map((item: any) => {
          const label = typeof item?.label === 'string' ? item.label.trim() : '';
          const reason = typeof item?.reason === 'string' ? item.reason.trim() : '';
          const type = typeof item?.type === 'string' ? item.type.trim() : '';
          if (label) return label;
          if (reason) return reason;
          if (type === 'box') return '공부상자';
          if (type === 'rank') return '랭킹 보상';
          return '';
        })
        .filter(Boolean)
    : [];

  if (eventLabels.length > 0) {
    return Array.from(new Set(eventLabels)).slice(0, 3).join(' · ');
  }

  return [
    breakdown.studyBoxPoints > 0 ? `상자 ${formatPointsInPt(breakdown.studyBoxPoints)}` : '',
    breakdown.rankPoints > 0 ? `랭킹 ${formatPointsInPt(breakdown.rankPoints)}` : '',
    breakdown.otherPoints > 0 ? `기타 ${formatPointsInPt(breakdown.otherPoints)}` : '',
  ].filter(Boolean).join(' · ') || '포인트 적립';
}

const summarizePointHistoryRows = (rows: PointHistoryRow[]): PointHistorySummary =>
  rows.reduce(
    (acc, row) => ({
      totalPoints: acc.totalPoints + row.totalPoints,
      studyBoxPoints: acc.studyBoxPoints + row.studyBoxPoints,
      rankPoints: acc.rankPoints + row.rankPoints,
      otherPoints: acc.otherPoints + row.otherPoints,
      earners: acc.earners + (row.totalPoints > 0 ? 1 : 0),
    }),
    EMPTY_POINT_HISTORY_SUMMARY
  );

const parseKstDayRange = (dateKey: string): { startAtMs: number; endAtMs: number } | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const startAtMs = Date.parse(`${dateKey}T00:00:00+09:00`);
  if (!Number.isFinite(startAtMs)) return null;
  return {
    startAtMs,
    endAtMs: startAtMs + DAY_RANGE_MS,
  };
};

const parseKstDateTimeInput = (value: string): number | null => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}:00+09:00`);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDateTimeLocalInput = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatChartMinutesAxisTick = (value: number) => {
  const safeMinutes = Math.max(0, Math.round(Number(value || 0)));
  if (safeMinutes < 60) return `${safeMinutes}m`;
  const hours = safeMinutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
};

const roundUpToNextTenMinutes = (value: Date) => {
  const rounded = new Date(value);
  rounded.setSeconds(0, 0);
  const nextMinutes = Math.ceil((rounded.getMinutes() + 1) / 10) * 10;
  rounded.setMinutes(nextMinutes, 0, 0);
  return rounded;
};

const formatPointBoostWindowLabel = (event: PointBoostEvent) => {
  const startAt = toTimestampDateSafe(event.startAt);
  const endAt = toTimestampDateSafe(event.endAt);
  if (!startAt || !endAt) return '시간 미상';
  if (event.mode === 'day') {
    return `${format(startAt, 'M/d')} 하루 종일`;
  }
  const sameDay = format(startAt, 'yyyy-MM-dd') === format(endAt, 'yyyy-MM-dd');
  if (sameDay) {
    return `${format(startAt, 'M/d HH:mm')} - ${format(endAt, 'HH:mm')}`;
  }
  return `${format(startAt, 'M/d HH:mm')} - ${format(endAt, 'M/d HH:mm')}`;
};

const getAttendanceRequestCreatedLabel = (request: AttendanceRequest): string => {
  const createdAt = toTimestampDateSafe(request.createdAt);
  return createdAt ? format(createdAt, 'MM.dd HH:mm') : '접수 시간 미상';
};

const buildAttendanceRequestTimingSummary = (request: AttendanceRequest): string => {
  const detailParts: string[] = [];

  if (request.requestedArrivalTime || request.requestedDepartureTime) {
    detailParts.push(`등하원 ${request.requestedArrivalTime || '?'}~${request.requestedDepartureTime || '?'}`);
  }

  if (request.requestedAcademyStartTime || request.requestedAcademyEndTime) {
    const academyName = request.requestedAcademyName?.trim();
    detailParts.push(
      `학원/외출 ${request.requestedAcademyStartTime || '?'}~${request.requestedAcademyEndTime || '?'}${academyName ? ` · ${academyName}` : ''}`
    );
  }

  if (request.classScheduleName?.trim()) {
    detailParts.push(toStudyRoomTrackScheduleName(request.classScheduleName));
  }

  if (request.reasonCategory) {
    detailParts.push(getScheduleChangeReasonLabel(request.reasonCategory));
  }

  const reason = request.reason?.trim();
  if (reason) {
    detailParts.push(reason);
  }

  return detailParts.join(' · ') || '신청 사유와 시간을 확인해 처리하세요.';
};

const getAttendanceRequestSortScore = (request: AttendanceRequest, todayKey: string): number => {
  if (!request.date || !todayKey) return 4;
  if (request.date === todayKey) return 0;
  if (request.date < todayKey) return 1;
  return 2;
};

export function AdminDashboard({ isActive }: { isActive: boolean }) {
  const firestore = useFirestore();
  const functions = useFunctions();
  const router = useRouter();
  const { user } = useUser();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const [isMounted, setIsMounted] = useState(false);
  const [today, setToday] = useState<Date | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [now, setNow] = useState<number>(0);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [deletingTeacherId, setDeletingTeacherId] = useState<string | null>(null);
  const [isTeacherManagementDialogOpen, setIsTeacherManagementDialogOpen] = useState(false);
  const [isParentTrustDialogOpen, setIsParentTrustDialogOpen] = useState(false);
  const [parentTrustSearch, setParentTrustSearch] = useState('');
  const [selectedFocusStudentId, setSelectedFocusStudentId] = useState<string | null>(null);
  const [selectedAttendanceDetailSignal, setSelectedAttendanceDetailSignal] = useState<CenterAdminAttendanceSeatSignal | null>(null);
  const [isStudyingStudentsDialogOpen, setIsStudyingStudentsDialogOpen] = useState(false);
  const [isAttendanceFullscreenOpen, setIsAttendanceFullscreenOpen] = useState(false);
  const [isOperationsMemoOpen, setIsOperationsMemoOpen] = useState(false);
  const [isImmediateInterventionSheetOpen, setIsImmediateInterventionSheetOpen] = useState(false);
  const [isAttendancePriorityDialogOpen, setIsAttendancePriorityDialogOpen] = useState(false);
  const [isControlAlertsDialogOpen, setIsControlAlertsDialogOpen] = useState(false);
  const [isCounselTrackDialogOpen, setIsCounselTrackDialogOpen] = useState(false);
  const [counselTrackDialogTab, setCounselTrackDialogTab] = useState<DashboardCounselTrackTab>('reservations');
  const [selectedHomeAxisId, setSelectedHomeAxisId] = useState<string | null>(null);
  const [selectedRoomView, setSelectedRoomView] = useState<'all' | string>('all');
  const hasInitializedRoomViewRef = useRef(false);
  const [focusDayData, setFocusDayData] = useState<Record<string, { awayMinutes: number; startHour: number | null; endHour: number | null }>>({});
  const [dayDataLoading, setDayDataLoading] = useState(false);
  const [dailyGrowthWindowIndex, setDailyGrowthWindowIndex] = useState(0);
  const [liveTickMs, setLiveTickMs] = useState<number>(0);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeAudience, setNoticeAudience] = useState<'parent' | 'student' | 'all'>('parent');
  const [isNoticeSubmitting, setIsNoticeSubmitting] = useState(false);
  const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] = useState(false);
  const [isTodayPointsDialogOpen, setIsTodayPointsDialogOpen] = useState(false);
  const [selectedPointHistoryWindow, setSelectedPointHistoryWindow] = useState<PointHistoryWindow>('today');
  const [expandedPointHistoryDateKey, setExpandedPointHistoryDateKey] = useState<string | null>(null);
  const [isPointBoostDialogOpen, setIsPointBoostDialogOpen] = useState(false);
  const [pointBoostModeDraft, setPointBoostModeDraft] = useState<'day' | 'window'>('day');
  const [pointBoostDateDraft, setPointBoostDateDraft] = useState('');
  const [pointBoostStartDraft, setPointBoostStartDraft] = useState('');
  const [pointBoostEndDraft, setPointBoostEndDraft] = useState('');
  const [pointBoostMultiplierDraft, setPointBoostMultiplierDraft] = useState('2');
  const [pointBoostMessageDraft, setPointBoostMessageDraft] = useState('');
  const [isCreatingPointBoost, setIsCreatingPointBoost] = useState(false);
  const [cancellingPointBoostId, setCancellingPointBoostId] = useState<string | null>(null);
  const [isOpenClawExporting, setIsOpenClawExporting] = useState(false);
  const [optimisticAnnouncements, setOptimisticAnnouncements] = useState<Array<{
    id: string;
    title: string;
    body: string;
    audience: 'parent' | 'student' | 'all';
    createdAt: Date;
    isPending: true;
  }>>([]);

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
    if (!isActive) return;

    const syncLiveTick = () => setLiveTickMs(Date.now());
    syncLiveTick();
    const refreshTimer = window.setInterval(syncLiveTick, ADMIN_DASHBOARD_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(refreshTimer);
  }, [isActive]);

  const isMobile = viewMode === 'mobile';
  const centerId = activeMembership?.id;
  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';
  const yesterdayKey = today ? format(subDays(today, 1), 'yyyy-MM-dd') : '';

  useEffect(() => {
    if (!today) return;
    if (!pointBoostDateDraft) {
      setPointBoostDateDraft(format(today, 'yyyy-MM-dd'));
    }
    if (!pointBoostStartDraft || !pointBoostEndDraft) {
      const nextWindowStart = roundUpToNextTenMinutes(new Date());
      const nextWindowEnd = new Date(nextWindowStart.getTime() + 2 * 60 * 60 * 1000);
      if (!pointBoostStartDraft) {
        setPointBoostStartDraft(formatDateTimeLocalInput(nextWindowStart));
      }
      if (!pointBoostEndDraft) {
        setPointBoostEndDraft(formatDateTimeLocalInput(nextWindowEnd));
      }
    }
  }, [pointBoostDateDraft, pointBoostEndDraft, pointBoostStartDraft, today]);

  const parentActivityWindowStart = useMemo(
    () => Timestamp.fromDate(subDays(today ?? new Date(), 30)),
    [today]
  );
  const getStudioMotionProps = (delay = 0, offset = 18) =>
    prefersReducedMotion
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: offset },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay, ease: 'easeOut' as const },
        };

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

  const pointBoostEventsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'pointBoostEvents'),
      orderBy('startAt', 'desc'),
      limit(40)
    );
  }, [firestore, centerId]);
  const { data: pointBoostEvents } = useCollection<PointBoostEvent>(pointBoostEventsQuery, { enabled: isActive });

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
    if (hasInitializedRoomViewRef.current || roomConfigs.length === 0) return;
    hasInitializedRoomViewRef.current = true;
    if (selectedRoomView === 'all') {
      setSelectedRoomView(roomConfigs[0].id);
    }
  }, [roomConfigs, selectedRoomView]);

  useEffect(() => {
    if (roomConfigs.length === 0) {
      if (selectedRoomView !== 'all') {
        setSelectedRoomView('all');
      }
      return;
    }

    if (selectedRoomView === 'all') return;
    const hasSelectedRoom = roomConfigs.some((room) => room.id === selectedRoomView);
    if (!hasSelectedRoom) {
      setSelectedRoomView(roomConfigs[0].id);
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
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', 'in', STAFF_MEMBER_ROLES));
  }, [firestore, centerId]);
  const { data: teacherMembers } = useCollection<CenterMembership>(teacherMembersQuery, { enabled: isActive });

  const parentMembersQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'members'), where('role', '==', 'parent'));
  }, [firestore, centerId]);
  const { data: parentMembers } = useCollection<CenterMembership>(parentMembersQuery, { enabled: isActive });

  const smsRecipientPreferencesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(collection(firestore, 'centers', centerId, 'smsRecipientPreferences'), limit(800));
  }, [firestore, centerId]);
  const { data: smsRecipientPreferences } = useCollection<AdminSmsRecipientPreference>(smsRecipientPreferencesQuery, { enabled: isActive });

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

  const attendanceRequestsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'attendanceRequests'),
      where('status', '==', 'requested'),
      limit(80)
    );
  }, [firestore, centerId]);
  const { data: attendanceRequests } = useCollection<AttendanceRequest>(attendanceRequestsQuery, { enabled: isActive });

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

  const smsRecipientPreferencesByKey = useMemo(
    () => new Map((smsRecipientPreferences || []).map((preference) => [preference.id, preference])),
    [smsRecipientPreferences]
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
    const parentPreference = parentMember
      ? smsRecipientPreferencesByKey.get(buildSmsRecipientPreferenceId(signal.studentId, parentMember.id))
      : null;
    const manualParentPreference = smsRecipientPreferencesByKey.get(
      buildSmsRecipientPreferenceId(signal.studentId, MANUAL_PARENT_SMS_UID)
    );
    const studentFallbackPreference = smsRecipientPreferencesByKey.get(
      buildSmsRecipientPreferenceId(signal.studentId, STUDENT_SMS_FALLBACK_UID)
    );
    const manualParentPhone = normalizePhoneNumber(manualParentPreference?.phoneNumber);
    const parentPhone =
      manualParentPhone
      || normalizePhoneNumber(parentPreference?.phoneNumber)
      || normalizePhoneNumber(parentMember?.phoneNumber)
      || '-';
    const studentPhone =
      normalizePhoneNumber(student?.phoneNumber)
      || normalizePhoneNumber(studentMember?.phoneNumber)
      || normalizePhoneNumber(studentFallbackPreference?.phoneNumber)
      || '-';
    const roomName = signal.roomId ? roomNameById.get(signal.roomId) || signal.roomId : '좌석 미배정';
    const seatLabel = signal.roomSeatNo ? `${roomName} ${signal.roomSeatNo}번` : roomName;
    const classScheduleLabel = signal.classScheduleName?.trim()
      ? toStudyRoomTrackScheduleName(signal.classScheduleName)
      : '';
    const outingLabel =
      signal.scheduleMovementSummary
      || (
        signal.excursionStartAt && signal.excursionEndAt
          ? `학원/외출 ${signal.excursionStartAt} ~ ${signal.excursionEndAt}${signal.excursionReason ? ` · ${signal.excursionReason}` : ''}`
          : '오늘 등록된 외출/학원 시간이 없습니다.'
      );
    const scheduleLabel = [classScheduleLabel, signal.scheduleMovementSummary].filter(Boolean).join(' · ');

    return {
      signal,
      student,
      studentMember,
      seatLabel,
      plannedArrival: signal.routineExpectedArrivalTime || student?.expectedArrivalTime || '-',
      firstCheckInLabel: signal.firstCheckInLabel || '-',
      plannedDeparture: signal.plannedDepartureTime || '-',
      outingLabel,
      scheduleLabel: scheduleLabel || classScheduleLabel || '등록된 일정 없음',
      parentName:
        manualParentPhone
          ? manualParentPreference?.parentName || '보호자'
          : parentPreference?.parentName || parentMember?.displayName || '어머님',
      parentPhone,
      studentPhone,
    };
  }, [
    parentMembers,
    roomNameById,
    selectedAttendanceDetailSignal,
    smsRecipientPreferencesByKey,
    studentMembersById,
    studentsById,
  ]);

  const progressById = useMemo(
    () => new Map((progressList || []).map((progress) => [progress.id, progress])),
    [progressList]
  );

  const seatById = useMemo(
    () => new Map(resolvedAttendanceList.map((seat) => [seat.id, seat])),
    [resolvedAttendanceList]
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

  const {
    seatSignals: attendanceSeatSignals,
    seatSignalsBySeatId: attendanceSeatSignalsBySeatId,
    seatSignalsByStudentId: attendanceSeatSignalsByStudentId,
    summary: attendanceBoardSummary,
    isLoading: attendanceBoardLoading,
  } = useCenterAdminAttendanceBoard({
    centerId,
    isActive: isActive && !!today,
    selectedClass,
    referenceDate: today,
    students,
    studentMembers: activeMembers,
    attendanceList: resolvedAttendanceList,
    todayStats,
    nowMs: now,
    refreshKey: liveTickMs,
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
              where(documentId(), '>=', studyLogStartKey),
              where(documentId(), '<=', todayKey),
              orderBy(documentId(), 'asc')
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
              .map((docSnap) => {
                const raw = docSnap.data() as StudyLogDay;
                return {
                  ...raw,
                  dateKey: resolveDateKey(docSnap.id, raw?.dateKey),
                } as StudyLogDay;
              })
              .filter((row) => typeof row.dateKey === 'string' && row.dateKey.length > 0)
          );
          setFocusStudentTrendRaw(
            trendStatSnaps
              .filter((snap) => snap.exists())
              .map((snap) => {
                const raw = snap.data() as DailyStudentStat;
                return {
                  ...raw,
                  dateKey: resolveDateKey(snap.id, raw?.dateKey),
                } as DailyStudentStat;
              })
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
    return query(
      collection(firestore, 'centers', centerId, 'parentActivityEvents'),
      where('createdAt', '>=', parentActivityWindowStart)
    );
  }, [firestore, centerId, parentActivityWindowStart]);
  const { data: parentActivityEvents, isLoading: parentActivityEventsLoading } = useCollection<ParentActivityEvent>(parentActivityQuery, { enabled: isActive });

  const parentCommunicationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'parentCommunications'),
      where('createdAt', '>=', parentActivityWindowStart)
    );
  }, [firestore, centerId, parentActivityWindowStart]);
  const { data: parentCommunications, isLoading: parentCommunicationsLoading } = useCollection<DashboardParentCommunicationRecord>(parentCommunicationsQuery, { enabled: isActive });
  const normalizedParentCommunications = useMemo(
    () =>
      (parentCommunications || []).map((item) => ({
        ...normalizeParentCommunicationRecord(item),
        id: item.id || '',
      })),
    [parentCommunications]
  );
  const heatmapParentCommunications = useMemo(
    () =>
      normalizedParentCommunications.map((item) => ({
        id: item.id || '',
        studentId: item.studentId || undefined,
        type: item.type,
        createdAt: item.createdAt instanceof Timestamp ? item.createdAt : undefined,
      })),
    [normalizedParentCommunications]
  );

  const counselingReservationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'counselingReservations'),
      orderBy('createdAt', 'desc'),
      limit(120),
    );
  }, [firestore, centerId]);
  const { data: counselingReservations } = useCollection<CounselingReservation>(counselingReservationsQuery, { enabled: isActive });

  const {
    rows: adminHeatmapRows,
    interventionSignals: heatmapInterventionSignals,
    isLoading: adminHeatmapLoading,
    weeklyStudyMinutesByStudent,
  } = useCenterAdminHeatmap({
    centerId,
    isActive: isActive && !!today,
    selectedClass,
    referenceDate: today,
    preloadedActiveMembers: activeMembers,
    preloadedActiveMembersLoading: membersLoading,
    preloadedProgressList: progressList,
    preloadedProgressListLoading: !progressList && isActive,
    preloadedAttendanceList: attendanceList,
    preloadedAttendanceListLoading: attendanceLoading,
    preloadedParentActivityEvents: parentActivityEvents,
    preloadedParentActivityEventsLoading: parentActivityEventsLoading,
    preloadedParentCommunications: heatmapParentCommunications,
    preloadedParentCommunicationsLoading: parentCommunicationsLoading,
  });

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

  const pendingAttendanceRequests = useMemo(
    () =>
      (attendanceRequests || [])
        .filter((request) => request.status === 'requested')
        .filter((request) => selectedClass === 'all' || targetMemberIds.has(request.studentId))
        .sort((left, right) => {
          const dateRankDelta =
            getAttendanceRequestSortScore(left, todayKey) - getAttendanceRequestSortScore(right, todayKey);
          if (dateRankDelta !== 0) return dateRankDelta;

          const leftCreatedAtMs = toTimestampDateSafe(left.createdAt)?.getTime() ?? 0;
          const rightCreatedAtMs = toTimestampDateSafe(right.createdAt)?.getTime() ?? 0;
          if (leftCreatedAtMs !== rightCreatedAtMs) return rightCreatedAtMs - leftCreatedAtMs;

          return (left.studentName || '').localeCompare(right.studentName || '', 'ko');
        }),
    [attendanceRequests, selectedClass, targetMemberIds, todayKey]
  );
  const pendingScheduleChangeRequests = useMemo(
    () => pendingAttendanceRequests.filter((request) => request.type === 'schedule_change'),
    [pendingAttendanceRequests]
  );
  const pendingOtherAttendanceRequests = useMemo(
    () => pendingAttendanceRequests.filter((request) => request.type !== 'schedule_change'),
    [pendingAttendanceRequests]
  );

  const pointHistoryDateKeys = useMemo(
    () => ({
      today: todayKey ? [todayKey] : [],
      '7d': buildRecentDateKeys(today, 7),
      '30d': buildRecentDateKeys(today, 30),
    }),
    [today, todayKey]
  );

  const pointHistoryByWindow = useMemo(() => {
    const getMemberDailyPointBreakdown = (memberId: string, dateKey: string) => {
      const progress = progressById.get(memberId);
      const dailyPointStatus = (progress?.dailyPointStatus || {}) as Record<string, any>;
      return getDailyPointBreakdown((dailyPointStatus[dateKey] || {}) as Record<string, any>);
    };

    const buildRows = (dateKeys: string[]): PointHistoryRow[] => {
      if (dateKeys.length === 0) return [];

      return filteredStudentMembers
        .map((member) => {
          const totals = dateKeys.reduce(
            (acc, dateKey) => {
              const breakdown = getMemberDailyPointBreakdown(member.id, dateKey);
              return {
                totalPoints: acc.totalPoints + breakdown.totalPoints,
                studyBoxPoints: acc.studyBoxPoints + breakdown.studyBoxPoints,
                rankPoints: acc.rankPoints + breakdown.rankPoints,
                otherPoints: acc.otherPoints + breakdown.otherPoints,
              };
            },
            { totalPoints: 0, studyBoxPoints: 0, rankPoints: 0, otherPoints: 0 }
          );

          return {
            studentId: member.id,
            studentName: toSafeStudentName(member.displayName, member.id),
            className: member.className || '-',
            totalPoints: totals.totalPoints,
            studyBoxPoints: totals.studyBoxPoints,
            rankPoints: totals.rankPoints,
            otherPoints: totals.otherPoints,
          };
        })
        .sort((left, right) => {
          if (right.totalPoints !== left.totalPoints) return right.totalPoints - left.totalPoints;
          if (right.studyBoxPoints !== left.studyBoxPoints) return right.studyBoxPoints - left.studyBoxPoints;
          return left.studentName.localeCompare(right.studentName, 'ko');
        });
    };

    const buildDailyRows = (dateKeys: string[]): PointHistoryDailySummary[] =>
      dateKeys
        .map((dateKey) => {
          const grants = filteredStudentMembers
            .map((member): PointHistoryGrantRow | null => {
              const breakdown = getMemberDailyPointBreakdown(member.id, dateKey);
              if (breakdown.totalPoints <= 0) return null;

              return {
                key: `${dateKey}-${member.id}`,
                dateKey,
                studentId: member.id,
                studentName: toSafeStudentName(member.displayName, member.id),
                className: member.className || '-',
                totalPoints: breakdown.totalPoints,
                studyBoxPoints: breakdown.studyBoxPoints,
                rankPoints: breakdown.rankPoints,
                otherPoints: breakdown.otherPoints,
                detail: formatPointBreakdownDetail(breakdown),
              };
            })
            .filter((row): row is PointHistoryGrantRow => Boolean(row))
            .sort((left, right) => {
              if (right.totalPoints !== left.totalPoints) return right.totalPoints - left.totalPoints;
              return left.studentName.localeCompare(right.studentName, 'ko');
            });

          const summary = grants.reduce(
            (acc, row) => ({
              totalPoints: acc.totalPoints + row.totalPoints,
              studyBoxPoints: acc.studyBoxPoints + row.studyBoxPoints,
              rankPoints: acc.rankPoints + row.rankPoints,
              otherPoints: acc.otherPoints + row.otherPoints,
              earners: acc.earners + 1,
            }),
            EMPTY_POINT_HISTORY_SUMMARY
          );

          return { dateKey, grants, ...summary };
        })
        .filter((row) => row.totalPoints > 0);

    const todayRows = buildRows(pointHistoryDateKeys.today);
    const sevenDayRows = buildRows(pointHistoryDateKeys['7d']);
    const thirtyDayRows = buildRows(pointHistoryDateKeys['30d']);

    return {
      today: {
        key: 'today' as const,
        tabLabel: '오늘',
        headlineLabel: '오늘',
        leaderboardLabel: '오늘',
        rows: todayRows,
        summary: summarizePointHistoryRows(todayRows),
        dailyRows: buildDailyRows(pointHistoryDateKeys.today),
      },
      '7d': {
        key: '7d' as const,
        tabLabel: '최근 7일',
        headlineLabel: '최근 7일',
        leaderboardLabel: '7일',
        rows: sevenDayRows,
        summary: summarizePointHistoryRows(sevenDayRows),
        dailyRows: buildDailyRows(pointHistoryDateKeys['7d']),
      },
      '30d': {
        key: '30d' as const,
        tabLabel: '최근 30일',
        headlineLabel: '최근 30일',
        leaderboardLabel: '30일',
        rows: thirtyDayRows,
        summary: summarizePointHistoryRows(thirtyDayRows),
        dailyRows: buildDailyRows(pointHistoryDateKeys['30d']),
      },
    };
  }, [filteredStudentMembers, pointHistoryDateKeys, progressById]);

  const todayPointRows = pointHistoryByWindow.today.rows;
  const todayPointsSummary = pointHistoryByWindow.today.summary;
  const selectedPointHistoryData = pointHistoryByWindow[selectedPointHistoryWindow];

  const pointBoostOverview = useMemo(() => {
    const active: Array<PointBoostEvent & { startAtMs: number; endAtMs: number; cancelledAtMs: number; label: string; multiplierLabel: string }> = [];
    const upcoming: Array<PointBoostEvent & { startAtMs: number; endAtMs: number; cancelledAtMs: number; label: string; multiplierLabel: string }> = [];
    const history: Array<PointBoostEvent & { startAtMs: number; endAtMs: number; cancelledAtMs: number; label: string; multiplierLabel: string }> = [];
    const nowMs = now || Date.now();

    (pointBoostEvents || []).forEach((event) => {
      const startAtMs = toTimestampDateSafe(event.startAt)?.getTime() ?? 0;
      const endAtMs = toTimestampDateSafe(event.endAt)?.getTime() ?? 0;
      const cancelledAtMs = toTimestampDateSafe(event.cancelledAt)?.getTime() ?? 0;
      if (startAtMs <= 0 || endAtMs <= 0) return;

      const normalized = {
        ...event,
        startAtMs,
        endAtMs,
        cancelledAtMs,
        label: formatPointBoostWindowLabel(event),
        multiplierLabel: formatPointBoostMultiplier(event.multiplier),
        message: resolvePointBoostMessage(event.message, event.multiplier),
      };

      if (cancelledAtMs > 0 || endAtMs <= nowMs) {
        history.push(normalized);
        return;
      }

      if (startAtMs <= nowMs) {
        active.push(normalized);
        return;
      }

      upcoming.push(normalized);
    });

    active.sort((left, right) => left.startAtMs - right.startAtMs);
    upcoming.sort((left, right) => left.startAtMs - right.startAtMs);
    history.sort((left, right) => Math.max(right.cancelledAtMs, right.endAtMs) - Math.max(left.cancelledAtMs, left.endAtMs));

    return {
      active,
      upcoming,
      history,
      activeEvent: active[0] ?? null,
    };
  }, [now, pointBoostEvents]);

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

    const staffMemberById = new Map((teacherMembers || []).map((member) => [member.id, member]));
    const fallbackNameByStaffId = new Map<string, string>();
    (counselingLogs || []).forEach((log) => {
      const teacherId = typeof log.teacherId === 'string' ? log.teacherId.trim() : '';
      if (!teacherId || fallbackNameByStaffId.has(teacherId)) return;
      if (typeof log.teacherName === 'string' && log.teacherName.trim()) {
        fallbackNameByStaffId.set(teacherId, log.teacherName.trim());
      }
    });
    (allReports || []).forEach((report) => {
      const teacherId = typeof report.teacherId === 'string' ? report.teacherId.trim() : '';
      if (!teacherId || fallbackNameByStaffId.has(teacherId)) return;
      const teacherName = typeof (report as DailyReport & { teacherName?: string }).teacherName === 'string'
        ? (report as DailyReport & { teacherName?: string }).teacherName?.trim()
        : '';
      if (teacherName) {
        fallbackNameByStaffId.set(teacherId, teacherName);
      }
    });

    const staffIds = new Set<string>([
      ...staffMemberById.keys(),
      ...reportByTeacher.keys(),
      ...counselingByTeacher.keys(),
    ]);

    return Array.from(staffIds)
      .filter((staffId) => staffId.trim().length > 0)
      .map((staffId) => {
        const member = staffMemberById.get(staffId);
        const reports = [...(reportByTeacher.get(staffId) || [])].sort(
          (a, b) => ((b.createdAt as any)?.toMillis?.() || 0) - ((a.createdAt as any)?.toMillis?.() || 0)
        );
        const logs = [...(counselingByTeacher.get(staffId) || [])].sort(
          (a, b) => ((b.createdAt as any)?.toMillis?.() || 0) - ((a.createdAt as any)?.toMillis?.() || 0)
        );
        const role = member?.role || 'teacher';

        return {
          id: staffId,
          role,
          roleLabel: getStaffRoleLabel(role),
          status: member?.status || 'active',
          phoneNumber: member?.phoneNumber || '',
          teacherName:
            member?.displayName
            || fallbackNameByStaffId.get(staffId)
            || `${getStaffRoleLabel(role)}-${staffId.slice(0, 6)}`,
          reports,
          sentReports: reports.filter((report) => report?.status === 'sent'),
          logs,
          canDelete: member?.role === 'teacher',
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
      logHandledClientIssue('[center-admin] delete teacher failed', error);
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
      logHandledClientIssue('[center-admin] openclaw snapshot failed', error);
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

    normalizedParentCommunications.forEach((item: any) => {
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
  }, [isMounted, now, parentMembers, parentActivityEvents, normalizedParentCommunications, studentNameById, targetMemberIds]);

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
    return attendanceSeatSignals
      .filter((signal) => Boolean(
        signal
        && signal.seatStatus === 'studying'
        && signal.studentId
        && targetMemberIds.has(signal.studentId)
      ))
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
  }, [attendanceSeatSignals, roomNameById, roomOrderById, targetMemberIds]);

  useEffect(() => {
    if (!centerAnnouncements?.length || optimisticAnnouncements.length === 0) return;
    const resolvedIds = new Set(centerAnnouncements.map((item: any) => item.id));
    setOptimisticAnnouncements((current) => current.filter((item) => !resolvedIds.has(item.id)));
  }, [centerAnnouncements, optimisticAnnouncements.length]);

  const announcementFeed = useMemo(() => {
    const merged = [...optimisticAnnouncements, ...(centerAnnouncements || [])];
    const seen = new Set<string>();
    return merged.filter((item: any) => {
      const key = String(item.id || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [centerAnnouncements, optimisticAnnouncements]);

  const handleCreateAnnouncement = async () => {
    if (!firestore || !centerId || !activeMembership || !user) return;
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
      const announcementRef = await addDoc(collection(firestore, 'centers', centerId, 'centerAnnouncements'), {
        title,
        body,
        audience: noticeAudience,
        status: 'published',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdByUid: user.uid,
        createdByName: user.displayName || activeMembership.displayName || '센터관리자',
        createdByRole: activeMembership.role,
      });
      setOptimisticAnnouncements((current) => [
        {
          id: announcementRef.id,
          title,
          body,
          audience: noticeAudience,
          createdAt: new Date(),
          isPending: true,
        },
        ...current,
      ]);
      setNoticeTitle('');
      setNoticeBody('');
      toast({ title: '공지사항 등록 완료', description: '학부모 소통창에 즉시 반영됩니다.' });
    } catch (error) {
      logHandledClientIssue('[center-admin] create announcement failed', error);
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
      const signalMinutes = Math.max(0, Math.round(Number(attendanceSeatSignalsByStudentId.get(member.id)?.todayStudyMinutes || 0)));
      let cumulative = Math.max((studentStat?.totalStudyMinutes || 0) + liveSession, signalMinutes);

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
    const recentParentCommunications = normalizedParentCommunications.filter((item: any) => {
      if (!targetMemberIds.has(item.studentId)) return false;
      const createdAtMs = item?.createdAt?.toMillis?.() ?? item?.updatedAt?.toMillis?.() ?? 0;
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
      const signalMinutes = Math.max(0, Math.round(Number(attendanceSeatSignalsByStudentId.get(member.id)?.todayStudyMinutes || 0)));
      const todayMinutes = Math.max(0, Math.round((studentStat?.totalStudyMinutes || 0) + liveSession), signalMinutes);
      const weeklyMinutes = Math.max(
        0,
        Math.round((weeklyStudyMinutesByStudent[member.id] || 0) + liveSession),
        todayMinutes
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
  }, [activeMembers, attendanceList, todayStats, yesterdayStats, dailyReports, progressList, parentActivityEvents, normalizedParentCommunications, consultingLeads, websiteConsultRequests, targetMemberIds, filteredStudentMembers, now, isMounted, weeklyStudyMinutesByStudent, liveTickMs, attendanceSeatSignalsByStudentId]);

  const counselingTrackOverview = useMemo(
    () =>
      buildCounselingTrackOverview({
        communications: normalizedParentCommunications,
        reservations: counselingReservations || [],
        studentNameById,
        targetMemberIds,
      }),
    [normalizedParentCommunications, counselingReservations, studentNameById, targetMemberIds]
  );

  const recentAnnouncementsPreview = announcementFeed.slice(0, 3);
  const topFocusPreview = metrics.focusTop10.slice(0, 4);
  const bottomFocusPreview = metrics.focusBottom10.slice(0, 4);

  const selectedFocusStudent = useMemo(() => {
    if (!selectedFocusStudentId || !metrics) return null;
    return (
      metrics.focusRows.find((row) => row.studentId === selectedFocusStudentId)
      || metrics.focusBottom10.find((row) => row.studentId === selectedFocusStudentId)
      || (() => {
        const member = studentMembersById.get(selectedFocusStudentId);
        const studentProfile = studentsById.get(selectedFocusStudentId);
        const focusStat = (todayStats || []).find((row) => row.studentId === selectedFocusStudentId) || null;
        const focusProgress = (progressList || []).find((row) => row.id === selectedFocusStudentId) || null;
        const seat = (attendanceList || []).find((row) => row.studentId === selectedFocusStudentId);
        const liveSession = getLiveRoundedMinutes(seat);
        const signalMinutes = Math.max(0, Math.round(Number(attendanceSeatSignalsByStudentId.get(selectedFocusStudentId)?.todayStudyMinutes || 0)));
        const todayMinutes = Math.max(0, Math.round((focusStat?.totalStudyMinutes || 0) + liveSession), signalMinutes);
        if (!member && !studentProfile && !focusStat) return null;
        return {
          studentId: selectedFocusStudentId,
          name: toSafeStudentName(member?.displayName || studentProfile?.name, selectedFocusStudentId),
          className: member?.className || studentProfile?.className || '-',
          score: calculateStudentFocusScore(focusStat, focusProgress),
          completion: Math.round(focusStat?.todayPlanCompletionRate || 0),
          studyMinutes: Math.max(0, Math.round((weeklyStudyMinutesByStudent[selectedFocusStudentId] || 0) + liveSession), todayMinutes),
          todayMinutes,
        };
      })()
      || null
    );
  }, [metrics, selectedFocusStudentId, studentMembersById, studentsById, todayStats, progressList, weeklyStudyMinutesByStudent, attendanceList, attendanceSeatSignalsByStudentId]);

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

    if (!today) return [];
    const baseDate = today;
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
          key: 'attendance-request',
          title: `출결 요청 확인 ${pendingOtherAttendanceRequests.length}건`,
          detail: pendingOtherAttendanceRequests[0]
            ? `${pendingOtherAttendanceRequests[0].studentName || '학생'} · ${getAttendanceRequestTypeLabel(pendingOtherAttendanceRequests[0].type)} · ${buildAttendanceRequestTimingSummary(pendingOtherAttendanceRequests[0])}`
            : '학생이 올린 지각·결석 요청을 바로 검토하세요.',
          actionLabel: '요청 확인',
          href: '/dashboard/attendance?tab=requests',
          icon: ClipboardCheck,
          toneClass: 'bg-amber-100 text-amber-700',
        },
        {
          key: 'schedule-change',
          title: `학원 일정 확인 ${pendingScheduleChangeRequests.length}건`,
          detail: pendingScheduleChangeRequests[0]
            ? `${pendingScheduleChangeRequests[0].studentName || '학생'} · ${buildScheduleChangeOpsDetail(pendingScheduleChangeRequests[0])}`
            : '학생이 바꾼 학원/외출 일정이 실제 일정과 맞는지 학부모님께 확인하세요.',
          actionLabel: '일정 확인',
          href: '/dashboard/attendance?tab=requests',
          icon: CalendarClock,
          toneClass: 'bg-sky-100 text-sky-700',
        },
        {
          key: 'intervention',
          title: `즉시 개입 학생 ${urgentInterventionStudents.length}명`,
          detail:
            urgentInterventionStudents[0]
              ? `${urgentInterventionStudents[0].studentName} · ${urgentInterventionStudents[0].topReason}`
              : '비즈니스 분석에서 리스크 인텔리전스를 열어 우선 개입 학생을 먼저 확인하세요.',
          actionLabel: '비즈니스 분석',
          href: '/dashboard/revenue?showRisk=1#risk-analysis',
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
          detail: '웹 유입 확인 후 상담 리드 워크벤치와 입학 대기 흐름으로 이어서 관리할 수 있습니다.',
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
        if (item.key === 'attendance-request') return pendingOtherAttendanceRequests.length > 0;
        if (item.key === 'schedule-change') return pendingScheduleChangeRequests.length > 0;
        if (item.key === 'intervention') return urgentInterventionStudents.length > 0;
        if (item.key === 'attendance') return attendanceBoardSummary.lateOrAbsentCount > 0;
        if (item.key === 'away') return attendanceBoardSummary.longAwayCount > 0;
        if (item.key === 'guardian') return parentContactRecommendations.length > 0;
        if (item.key === 'lead') return (metrics?.leadPipelineCount30d ?? 0) > 0;
        return true;
      }),
    [attendanceBoardSummary, attendanceSeatSignalsByStudentId, metrics, parentContactRecommendations, pendingOtherAttendanceRequests, pendingScheduleChangeRequests, urgentInterventionStudents]
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

    return attendanceSeatSignals
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
      .map((signal) => {
        const issueLabel =
          signal.boardStatus === 'absent'
            ? '미입실'
            : signal.boardStatus === 'late'
              ? '지각'
              : signal.boardStatus === 'routine_missing' || signal.boardStatus === 'present_missing_routine'
                ? '루틴누락'
                : signal.attendanceRiskLabel;

        const checkInLabel = buildAdminCheckInTimeLabel(signal, '');
        const detailLabel =
          signal.routineExpectedArrivalTime
            ? `${signal.routineExpectedArrivalTime} 기준${checkInLabel ? ` · ${checkInLabel}` : ''}`
            : checkInLabel || signal.note;

        return {
          studentId: signal.studentId,
          studentName: signal.studentName,
          issueLabel,
          detailLabel,
          signal,
        };
      });
  }, [attendanceSeatSignals]);

  const lateOrAbsentAlertRows = useMemo(() => {
    return attendanceSeatSignals
      .filter((signal) => signal.attendanceDisplayStatus === 'confirmed_late' || signal.boardStatus === 'absent')
      .sort((left, right) => {
        const leftPriority = left.boardStatus === 'absent' ? 0 : 1;
        const rightPriority = right.boardStatus === 'absent' ? 0 : 1;
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;

        const roomOrderDelta =
          (roomOrderById.get(left.roomId || '') ?? Number.MAX_SAFE_INTEGER)
          - (roomOrderById.get(right.roomId || '') ?? Number.MAX_SAFE_INTEGER);
        if (roomOrderDelta !== 0) return roomOrderDelta;

        const seatDelta = (left.roomSeatNo ?? Number.MAX_SAFE_INTEGER) - (right.roomSeatNo ?? Number.MAX_SAFE_INTEGER);
        if (seatDelta !== 0) return seatDelta;

        return left.studentName.localeCompare(right.studentName, 'ko');
      })
      .map((signal) => {
        const roomName = signal.roomId ? roomNameById.get(signal.roomId) || signal.roomId : '좌석 미배정';
        const roomLabel = signal.roomSeatNo ? `${roomName} ${signal.roomSeatNo}번` : roomName;
        return {
          key: signal.seatId,
          studentId: signal.studentId,
          studentName: signal.studentName,
          className: signal.className,
          issueLabel: signal.boardStatus === 'absent' ? '미입실' : '지각',
          roomLabel,
          detailLabel: signal.note,
        };
      });
  }, [attendanceSeatSignals, roomNameById, roomOrderById]);

  const longAwayAlertRows = useMemo(() => {
    return attendanceSeatSignals
      .filter((signal) => signal.isLongAway)
      .sort((left, right) => {
        if (right.currentAwayMinutes !== left.currentAwayMinutes) {
          return right.currentAwayMinutes - left.currentAwayMinutes;
        }

        const roomOrderDelta =
          (roomOrderById.get(left.roomId || '') ?? Number.MAX_SAFE_INTEGER)
          - (roomOrderById.get(right.roomId || '') ?? Number.MAX_SAFE_INTEGER);
        if (roomOrderDelta !== 0) return roomOrderDelta;

        const seatDelta = (left.roomSeatNo ?? Number.MAX_SAFE_INTEGER) - (right.roomSeatNo ?? Number.MAX_SAFE_INTEGER);
        if (seatDelta !== 0) return seatDelta;

        return left.studentName.localeCompare(right.studentName, 'ko');
      })
      .map((signal) => {
        const roomName = signal.roomId ? roomNameById.get(signal.roomId) || signal.roomId : '좌석 미배정';
        const roomLabel = signal.roomSeatNo ? `${roomName} ${signal.roomSeatNo}번` : roomName;
        return {
          key: signal.seatId,
          studentId: signal.studentId,
          studentName: signal.studentName,
          className: signal.className,
          awayMinutes: signal.currentAwayMinutes,
          roomLabel,
          detailLabel: signal.note,
        };
      });
  }, [attendanceSeatSignals, roomNameById, roomOrderById]);

  function renderAttendanceDashboardSection() {
    return (
      <Dialog open={isAttendanceFullscreenOpen} onOpenChange={setIsAttendanceFullscreenOpen}>
        <DialogContent className="h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden rounded-[2.4rem] border-none bg-[linear-gradient(180deg,#F7FAFF_0%,#EFF4FF_100%)] p-0 shadow-[0_24px_80px_rgba(20,41,95,0.28)]">
          <div className={cn(studioDialogHeaderClassName, 'border-b border-white/10 px-5 py-5 sm:px-6')}>
            <DialogHeader className="gap-2 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="h-6 border-none bg-white/12 px-2.5 text-[10px] font-black text-white">
                  실시간 교실 상세
                </Badge>
                {selectedClass !== 'all' && (
                  <Badge className="h-6 border-none bg-white px-2.5 text-[10px] font-black text-[#14295F] shadow-[0_18px_28px_-24px_rgba(20,41,95,0.24)]">
                    {selectedClass}
                  </Badge>
                )}
              </div>
              <DialogTitle className="font-aggro-display text-[2rem] font-black tracking-tight text-white">
                등하원 관제 전체보기
              </DialogTitle>
              <DialogDescription className="text-xs font-bold text-white/76">
                홈에서는 요약만 보고, 상세 좌석 배치와 학생 상태는 여기서 바로 확인합니다.
              </DialogDescription>
              <div className={cn('mt-3 grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
                <div className="rounded-[1.35rem] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">착석</p>
                  <p className="dashboard-number mt-2 text-[1.6rem] text-white">{metrics.checkedInCount}</p>
                </div>
                <div className="rounded-[1.35rem] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">미입실·지각</p>
                  <p className="dashboard-number mt-2 text-[1.6rem] text-white">{attendanceBoardSummary.lateOrAbsentCount}</p>
                </div>
                <div className="rounded-[1.35rem] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">장기 외출</p>
                  <p className="dashboard-number mt-2 text-[1.6rem] text-white">{attendanceBoardSummary.longAwayCount}</p>
                </div>
                <div className="rounded-[1.35rem] border border-[#FFB677]/28 bg-[#FF7A16]/18 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/68">즉시 개입</p>
                  <p className="dashboard-number mt-2 text-[1.6rem] text-white">{urgentInterventionStudents.length}</p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="rounded-[2rem] border border-[#DCE7FF] bg-white p-3 shadow-[0_26px_40px_-32px_rgba(20,41,95,0.22)]">
              <CenterAdminAttendanceBoard
                roomConfigs={roomConfigs}
                selectedRoomView={selectedRoomView === 'all' ? 'all' : selectedRoomView}
                onRoomViewChange={setSelectedRoomView}
                selectedClass={selectedClass}
                isMobile={isMobile}
                seatDetailLevel="nameOnly"
                shellMode="embedded"
                showHeader={false}
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
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  useEffect(() => {
    if (adminHeatmapRows.length === 0) {
      if (selectedHomeAxisId !== null) {
        setSelectedHomeAxisId(null);
      }
      return;
    }

    if (selectedHomeAxisId && adminHeatmapRows.some((row) => row.id === selectedHomeAxisId)) {
      return;
    }

    const lowestRow = adminHeatmapRows.reduce((lowest, current) => {
      if (current.summaryScore < lowest.summaryScore) return current;
      if (current.summaryScore === lowest.summaryScore && current.label.localeCompare(lowest.label, 'ko') < 0) {
        return current;
      }
      return lowest;
    });

    setSelectedHomeAxisId(lowestRow.id);
  }, [adminHeatmapRows, selectedHomeAxisId]);

  const workbenchQuickActions = [
    { label: '실시간 교실', icon: <LayoutGrid className="h-4 w-4" />, href: '/dashboard/teacher' },
    { label: '학생 360', icon: <Users className="h-4 w-4" />, href: '/dashboard/teacher/students' },
    { label: '출결 KPI', icon: <ClipboardCheck className="h-4 w-4" />, href: '/dashboard/attendance' },
    { label: '리드 / 상담', icon: <Megaphone className="h-4 w-4" />, href: '/dashboard/leads' },
    { label: '수익 분석', icon: <TrendingUp className="h-4 w-4" />, href: '/dashboard/revenue' },
  ];

  const liveSyncLabel = format(liveTickMs || now || Date.now(), 'HH:mm');
  const liveDateLabel = format(today || new Date(), 'MM.dd');
  const topFocusCompactPreview = topFocusPreview.slice(0, 3);
  const bottomFocusCompactPreview = bottomFocusPreview.slice(0, 3);
  const parentContactCompactPreview = parentContactRecommendations.slice(0, 2);
  const topFocusLeader = topFocusCompactPreview[0] || null;
  const bottomFocusLeader = bottomFocusCompactPreview[0] || null;
  const leadAnnouncement = recentAnnouncementsPreview[0] || null;
  const leadTeacherActivity = teacherActivityPreviewRows[0] || null;
  const compactQuickActionLinks = quickActionLinks.slice(0, 3);
  const topAdminPriority = todayActionQueue[0] || null;
  const primaryUrgentIntervention = urgentInterventionStudents[0] || null;
  const secondaryUrgentInterventions = urgentInterventionStudents.slice(1, 4);
  const primaryUrgentRoomLabel =
    primaryUrgentIntervention?.roomId
      ? roomNameById.get(primaryUrgentIntervention.roomId) || primaryUrgentIntervention.roomId || '미배정'
      : '미배정';
  const primaryAttendanceContactTarget = todayAttendanceContactTargets[0] || null;
  const secondaryAttendanceContactTargets = todayAttendanceContactTargets.slice(1, 4);
  const totalControlAlerts =
    attendanceBoardSummary.lateOrAbsentCount
    + attendanceBoardSummary.longAwayCount
    + urgentInterventionStudents.length
    + pendingAttendanceRequests.length;
  const weakestAxis =
    centerHealthAxes.length > 0
      ? centerHealthAxes.reduce((lowest, axis) => (axis.summaryScore < lowest.summaryScore ? axis : lowest))
      : null;
  const weakestAxisScoreLabel = weakestAxis ? `${weakestAxis.summaryScore}점` : 'N/A';
  const weakestAxisHeadline = weakestAxis ? `${weakestAxis.label} ${weakestAxis.summaryScore}점` : '현재 운영 흐름은 안정적입니다.';
  const selectedHomeAxis =
    centerHealthAxes.find((axis) => axis.id === selectedHomeAxisId)
    || weakestAxis
    || centerHealthAxes[0]
    || null;
  const selectedHomeHeatmapRow =
    adminHeatmapRows.find((row) => row.id === selectedHomeAxis?.id)
    || adminHeatmapRows[0]
    || null;
  const roomOverviewRows = roomConfigs.map((room) => {
    let focusedCount = 0;
    let alertCount = 0;
    let awayCount = 0;

    for (let roomSeatNo = 1; roomSeatNo <= room.rows * room.cols; roomSeatNo += 1) {
      const seat = getSeatForRoom(room, roomSeatNo);
      if (seat.type === 'aisle' || !seat.studentId) continue;
      const signal = attendanceSeatSignalsBySeatId.get(seat.id);
      if (!signal) continue;

      if (signal.boardStatus === 'present' || signal.boardStatus === 'returned') focusedCount += 1;
      if (signal.boardStatus === 'away') awayCount += 1;
      if (
        signal.boardStatus === 'absent'
        || signal.boardStatus === 'late'
        || signal.boardStatus === 'routine_missing'
        || signal.boardStatus === 'present_missing_routine'
        || signal.attendanceRiskLevel === 'risk'
      ) {
        alertCount += 1;
      }
    }

    return {
      id: room.id,
      name: room.name,
      focusedCount,
      awayCount,
      alertCount,
      totalSeats: room.rows * room.cols,
    };
  });
  const homeStatusMeta =
    totalControlAlerts >= 5 || (weakestAxis?.summaryScore ?? 100) < 60
      ? {
          label: '즉시 점검',
          badgeClass: 'bg-[#FF7A16] text-white',
          toneClass: 'border-[#FFD7BA] bg-[#FFF8F2]',
          summary: `긴급 신호 ${totalControlAlerts}건이 올라와 있어 ${weakestAxis?.label || '운영 흐름'}부터 먼저 확인해야 합니다.`,
        }
      : totalControlAlerts > 0 || (weakestAxis?.summaryScore ?? 100) < 75
        ? {
            label: '주의',
            badgeClass: 'bg-[#FFF2E8] text-[#C95A08]',
            toneClass: 'border-[#DCE7FF] bg-white',
            summary: `${topAdminPriority?.title || '예외 학생'}만 정리하면 되고, ${weakestAxis?.label || '운영 흐름'}을 이어서 점검하면 됩니다.`,
          }
        : {
            label: '안정',
            badgeClass: 'bg-[#EEF4FF] text-[#2554D7]',
            toneClass: 'border-[#DCE7FF] bg-white',
            summary: '전반 운영은 안정적입니다. 예외 학생과 약한 축만 짧게 확인하면 충분합니다.',
          };
  const homeStatusHeadline =
    totalControlAlerts >= 5 || (weakestAxis?.summaryScore ?? 100) < 60
      ? '지금 바로 점검이 필요한 운영 흐름입니다.'
      : totalControlAlerts > 0 || (weakestAxis?.summaryScore ?? 100) < 75
        ? '우선순위만 정리하면 안정권으로 돌릴 수 있습니다.'
        : '전반 운영은 안정 구간입니다.';
  const homeStatusHeroBadgeClass =
    totalControlAlerts >= 5 || (weakestAxis?.summaryScore ?? 100) < 60
      ? 'border-[#FFB57A]/30 bg-[#FF7A16] text-white'
      : totalControlAlerts > 0 || (weakestAxis?.summaryScore ?? 100) < 75
        ? 'border-[#FFD7BA]/50 bg-[#FFF2E8] text-[#C95A08]'
        : 'border-white/12 bg-white/10 text-white';
  const homeStatusSignals = [
    {
      label: '동기화',
      value: liveSyncLabel,
      hint: '마지막 업데이트',
      toneClass: 'border-white/10 bg-white/10 text-white',
    },
    {
      label: '경고 신호',
      value: `${totalControlAlerts}건`,
      hint: totalControlAlerts > 0 ? '즉시 확인 필요' : '긴급 없음',
      toneClass:
        totalControlAlerts > 0
          ? 'border-[#FFB57A]/25 bg-[#FF7A16]/14 text-white'
          : 'border-white/10 bg-white/10 text-white',
    },
    {
      label: '운영 안정성',
      value: weakestAxis ? `${weakestAxis.label} ${weakestAxis.summaryScore}점` : '안정 구간',
      hint: weakestAxis ? weakestAxis.summaryLabel : '추가 점검 없음',
      toneClass:
        (weakestAxis?.summaryScore ?? 100) < 75
          ? 'border-[#FFB57A]/25 bg-[#FF7A16]/14 text-white'
          : 'border-white/10 bg-white/10 text-white',
    },
  ];
  const getTopPerformerHighlight = (row: typeof topFocusCompactPreview[number]) => {
    if (row.completion >= 95) {
      return `계획 완수 ${row.completion}%`;
    }
    if (row.todayMinutes >= 240) {
      return `오늘 공부 ${Math.floor(row.todayMinutes / 60)}h ${row.todayMinutes % 60}m`;
    }
    if (row.studyMinutes >= 1200) {
      return `주간 학습 ${Math.floor(row.studyMinutes / 60)}h ${row.studyMinutes % 60}m`;
    }
    return `집중 흐름 ${row.score}점`;
  };
  const studioWhiteCardClassName =
    'rounded-[2.1rem] border border-[#DCE7FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] shadow-[0_20px_48px_-38px_rgba(20,41,95,0.32)]';
  const studioInsetCardClassName =
    'rounded-[1.5rem] border border-[#DCE7FF] bg-white px-4 py-4 shadow-[0_18px_32px_-30px_rgba(20,41,95,0.2)]';
  const studioSoftPanelClassName =
    'rounded-[1.55rem] border border-[#DCE7FF] bg-[#F7FAFF] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.88)]';
  const studioGlassPanelClassName =
    'rounded-[1.75rem] border border-white/12 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]';
  const studioDialogContentClassName =
    'overflow-hidden rounded-[2.2rem] border-none p-0 shadow-[0_28px_80px_-36px_rgba(20,41,95,0.42)]';
  const studioDialogHeaderClassName =
    'bg-[radial-gradient(circle_at_top_left,rgba(255,122,22,0.16),transparent_28%),linear-gradient(135deg,#14295F_0%,#1B3D89_56%,#2554D7_100%)] px-6 py-6 text-white';
  const studioMetricCardClassName =
    'rounded-[1.55rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_34px_-30px_rgba(20,41,95,0.18)]';
  const studioChartCardClassName =
    'rounded-[1.7rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_36px_-32px_rgba(20,41,95,0.18)]';
  const studioSectionEyebrowClassName =
    'text-[10px] font-black uppercase tracking-[0.22em] text-[#5c6e97]';
  const heatmapGraphSection = (
    <CenterAdminHeatmapCharts
      title="대표 운영 차트"
      rows={adminHeatmapRows}
      interventionSignals={heatmapInterventionSignals}
      scopeLabel={selectedClass === 'all' ? '센터 전체' : selectedClass}
      isLoading={adminHeatmapLoading}
      actionHref="/dashboard/teacher"
      actionLabel="실시간 교실 이동"
      className="border-0 bg-white shadow-none"
      activeRowId={selectedHomeAxisId}
      onActiveRowChange={setSelectedHomeAxisId}
    />
  );
  const handleHomePriorityAction = (item: (typeof todayActionQueue)[number] | null | undefined) => {
    if (!item) return;

    if (item.key === 'attendance-request') {
      router.push('/dashboard/attendance?tab=requests');
      return;
    }

    if (item.key === 'intervention') {
      setIsImmediateInterventionSheetOpen(true);
      return;
    }

    if (item.key === 'attendance') {
      setIsAttendancePriorityDialogOpen(true);
      return;
    }

    if (item.key === 'away') {
      setSelectedRoomView('all');
      setIsAttendanceFullscreenOpen(true);
      return;
    }

    if (item.actionType === 'dialog' || item.key === 'guardian') {
      setIsParentTrustDialogOpen(true);
    }
  };
  const handleOpenAttendanceOverview = (roomId: 'all' | string = 'all') => {
    setSelectedRoomView(roomId);
    setIsAttendanceFullscreenOpen(true);
  };
  const handleImmediateStudentSelect = (studentId: string) => {
    setIsImmediateInterventionSheetOpen(false);
    setSelectedFocusStudentId(studentId);
  };
  const openCounselTrackDialog = (tab: DashboardCounselTrackTab = 'reservations') => {
    setCounselTrackDialogTab(tab);
    setIsCounselTrackDialogOpen(true);
  };
  const openAttendanceRequestsPage = () => {
    router.push('/dashboard/attendance?tab=requests');
  };
  const openPointHistoryDialog = (window: PointHistoryWindow = 'today') => {
    setSelectedPointHistoryWindow(window);
    setExpandedPointHistoryDateKey(null);
    setIsTodayPointsDialogOpen(true);
  };
  const openAdminAttendanceBoardFromSignal = (signal: {
    roomId?: string;
  }) => {
    handleOpenAttendanceOverview(signal.roomId || 'all');
  };
  const openAdminAttendanceSignal = (signal: CenterAdminAttendanceSeatSignal) => {
    setSelectedAttendanceDetailSignal(signal);
  };
  const adminNoShowSignals = useMemo(
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

          const roomOrderDelta =
            (roomOrderById.get(left.roomId || '') ?? Number.MAX_SAFE_INTEGER)
            - (roomOrderById.get(right.roomId || '') ?? Number.MAX_SAFE_INTEGER);
          if (roomOrderDelta !== 0) return roomOrderDelta;

          return (left.roomSeatNo ?? Number.MAX_SAFE_INTEGER) - (right.roomSeatNo ?? Number.MAX_SAFE_INTEGER);
        }),
    [attendanceSeatSignals, now, roomOrderById, todayKey]
  );
  const adminLateSignals = useMemo(
    () =>
      attendanceSeatSignals
        .filter((signal) => signal.attendanceDisplayStatus === 'confirmed_late' || signal.boardStatus === 'late')
        .sort((left, right) => {
          const roomOrderDelta =
            (roomOrderById.get(left.roomId || '') ?? Number.MAX_SAFE_INTEGER)
            - (roomOrderById.get(right.roomId || '') ?? Number.MAX_SAFE_INTEGER);
          if (roomOrderDelta !== 0) return roomOrderDelta;

          return (left.roomSeatNo ?? Number.MAX_SAFE_INTEGER) - (right.roomSeatNo ?? Number.MAX_SAFE_INTEGER);
        }),
    [attendanceSeatSignals, roomOrderById]
  );
  function buildScheduleChangeOpsDetail(request: AttendanceRequest) {
    const signal = attendanceSeatSignalsByStudentId.get(request.studentId);
    const detailParts = [
      signal?.scheduleMovementSummary ? `저장 일정 ${signal.scheduleMovementSummary}` : null,
      signal?.routineExpectedArrivalTime && signal?.plannedDepartureTime
        ? `등하원 ${signal.routineExpectedArrivalTime}~${signal.plannedDepartureTime}`
        : null,
      signal?.classScheduleName?.trim() ? toStudyRoomTrackScheduleName(signal.classScheduleName) : null,
      buildAttendanceRequestTimingSummary(request),
    ].filter(Boolean) as string[];

    return detailParts.join(' · ');
  }
  const adminOperationsInboxTotalOpenCount =
    adminNoShowSignals.length
    + adminLateSignals.length
    + pendingScheduleChangeRequests.length
    + pendingOtherAttendanceRequests.length
    + counselingTrackOverview.consultationCount
    + counselingTrackOverview.wifiCount
    + counselingTrackOverview.parentRequestCount;
  const adminOperationsInboxStatusTone =
    adminNoShowSignals.length > 0 || adminLateSignals.length > 0
      ? 'urgent'
      : adminOperationsInboxTotalOpenCount > 0
        ? 'caution'
        : 'stable';
  const adminOperationsInboxSummaryChips = useMemo<OperationsInboxSummaryChip[]>(
    () => [
      {
        key: 'no-show',
        label: '연락 필요 미입실',
        value: `${adminNoShowSignals.length}명`,
        caption: adminNoShowSignals.length > 0 ? '예정 등원 +15분 경과' : '현재 대상 없음',
        tone: adminNoShowSignals.length > 0 ? 'rose' : 'blue',
        onClick: adminNoShowSignals.length > 0 ? () => openAdminAttendanceSignal(adminNoShowSignals[0]) : undefined,
      },
      {
        key: 'late',
        label: '지각',
        value: `${adminLateSignals.length}명`,
        caption: adminLateSignals.length > 0 ? '입실 시간 확인 필요' : '현재 대상 없음',
        tone: adminLateSignals.length > 0 ? 'orange' : 'blue',
        onClick: adminLateSignals.length > 0 ? () => openAdminAttendanceSignal(adminLateSignals[0]) : undefined,
      },
      {
        key: 'attendance-request',
        label: '출결 요청 확인',
        value: `${pendingOtherAttendanceRequests.length}건`,
        caption: pendingOtherAttendanceRequests.length > 0
          ? `${pendingOtherAttendanceRequests[0].studentName || '학생'} · ${getAttendanceRequestTypeLabel(pendingOtherAttendanceRequests[0].type)}`
          : '처리 대기 없음',
        tone: pendingOtherAttendanceRequests.length > 0 ? 'amber' : 'blue',
        onClick: pendingOtherAttendanceRequests.length > 0 ? openAttendanceRequestsPage : undefined,
      },
      {
        key: 'schedule-change',
        label: '학원 일정 확인',
        value: `${pendingScheduleChangeRequests.length}건`,
        caption: pendingScheduleChangeRequests.length > 0
          ? `${pendingScheduleChangeRequests[0].studentName || '학생'} · 학부모 확인 권장`
          : '변경 접수 없음',
        tone: pendingScheduleChangeRequests.length > 0 ? 'teal' : 'blue',
        onClick: pendingScheduleChangeRequests.length > 0 ? openAttendanceRequestsPage : undefined,
      },
      {
        key: 'consultation',
        label: '상담 문의/예약',
        value: `${counselingTrackOverview.consultationCount}건`,
        caption: '요청과 예약 대기 흐름',
        tone: counselingTrackOverview.consultationCount > 0 ? 'violet' : 'blue',
        onClick:
          counselingTrackOverview.consultationCount > 0
            ? () => openCounselTrackDialog('reservations')
            : undefined,
      },
      {
        key: 'wifi',
        label: '방화벽 요청',
        value: `${counselingTrackOverview.wifiCount}건`,
        caption: '해제 요청 바로 확인',
        tone: counselingTrackOverview.wifiCount > 0 ? 'amber' : 'blue',
        onClick:
          counselingTrackOverview.wifiCount > 0
            ? () => openCounselTrackDialog('inquiries')
            : undefined,
      },
      {
        key: 'parent-request',
        label: '학부모 문의',
        value: `${counselingTrackOverview.parentRequestCount}건`,
        caption: '일반 요청·건의 기준',
        tone: counselingTrackOverview.parentRequestCount > 0 ? 'teal' : 'blue',
        onClick:
          counselingTrackOverview.parentRequestCount > 0
            ? () => openCounselTrackDialog('parent')
            : undefined,
      },
      {
        key: 'today-points',
        label: '오늘 포인트',
        value: `${todayPointsSummary.totalPoints.toLocaleString()}P`,
        caption: `지급 학생 ${todayPointsSummary.earners}명`,
        tone: todayPointsSummary.totalPoints > 0 ? 'emerald' : 'blue',
        onClick: () => openPointHistoryDialog('today'),
      },
    ],
    [
      adminLateSignals,
      adminNoShowSignals,
      counselingTrackOverview.consultationCount,
      counselingTrackOverview.parentRequestCount,
      counselingTrackOverview.wifiCount,
      pendingOtherAttendanceRequests,
      pendingScheduleChangeRequests,
      todayPointsSummary.earners,
      todayPointsSummary.totalPoints,
    ]
  );
  const adminOperationsInboxQueueItems = useMemo<OperationsInboxQueueItem[]>(
    () =>
      [
        adminNoShowSignals.length > 0
          ? {
              key: 'queue-no-show',
              label: '연락 필요 미입실',
              title: `연락이 필요한 미입실 학생 ${adminNoShowSignals.length}명`,
              detail: `${adminNoShowSignals[0].studentName} 학생부터 예정 등원시간이 지나도 입실 증거가 없어 바로 확인이 필요합니다.`,
              meta: adminNoShowSignals[0].routineExpectedArrivalTime
                ? `예정 등원 ${adminNoShowSignals[0].routineExpectedArrivalTime}`
                : '예정 시간 미등록',
              tone: 'rose' as const,
              onClick: () => openAdminAttendanceSignal(adminNoShowSignals[0]),
            }
          : null,
        pendingScheduleChangeRequests.length > 0
          ? {
              key: 'queue-schedule-change',
              label: '학원 일정 확인',
              title: `학원/외출 일정 변경 ${pendingScheduleChangeRequests.length}건`,
              detail: `${pendingScheduleChangeRequests[0].studentName || '학생'} 학생의 저장된 학원/외출 시간이 실제 일정과 맞는지 학부모 확인이 필요합니다.`,
              meta: buildScheduleChangeOpsDetail(pendingScheduleChangeRequests[0]),
              tone: 'teal' as const,
              onClick: openAttendanceRequestsPage,
            }
          : null,
        pendingOtherAttendanceRequests.length > 0
          ? {
              key: 'queue-attendance-request',
              label: '출결 요청 확인',
              title: `출결 요청 ${pendingOtherAttendanceRequests.length}건 확인 필요`,
              detail: `${pendingOtherAttendanceRequests[0].studentName || '학생'} 학생의 ${getAttendanceRequestTypeLabel(pendingOtherAttendanceRequests[0].type)} 요청부터 승인/반려를 검토하세요.`,
              meta: `${pendingOtherAttendanceRequests[0].date || '일자 미입력'} · ${getAttendanceRequestCreatedLabel(pendingOtherAttendanceRequests[0])}`,
              tone: 'amber' as const,
              onClick: openAttendanceRequestsPage,
            }
          : null,
        adminLateSignals.length > 0
          ? {
              key: 'queue-late',
              label: '지각',
              title: `지각 학생 ${adminLateSignals.length}명`,
              detail: `${adminLateSignals[0].studentName} 학생부터 오늘 지각 흐름을 확인하고 교실 진입 이후 상태를 살펴보세요.`,
              meta: buildAdminCheckInTimeLabel(adminLateSignals[0]),
              tone: 'orange' as const,
              onClick: () => openAdminAttendanceSignal(adminLateSignals[0]),
            }
          : null,
        counselingTrackOverview.consultationCount > 0
          ? {
              key: 'queue-consultation',
              label: '상담 문의/예약',
              title: `상담 문의·예약 대기 ${counselingTrackOverview.consultationCount}건`,
              detail: `${counselingTrackOverview.consultationInbox[0]?.studentName || '학생'} 상담 흐름부터 바로 열어 답변과 일정 조정을 이어갈 수 있습니다.`,
              meta: counselingTrackOverview.consultationInbox[0]?.timeLabel || '최근 접수 순',
              tone: 'violet' as const,
              onClick: () => openCounselTrackDialog('reservations'),
            }
          : null,
        counselingTrackOverview.wifiCount > 0
          ? {
              key: 'queue-wifi',
              label: '방화벽 요청',
              title: `방화벽 요청 ${counselingTrackOverview.wifiCount}건`,
              detail: `${counselingTrackOverview.wifiRequests[0]?.studentName || '학생'} 요청부터 접속 사유와 URL을 확인할 수 있습니다.`,
              meta: counselingTrackOverview.wifiRequests[0]?.timeLabel || '최근 요청 순',
              tone: 'amber' as const,
              onClick: () => openCounselTrackDialog('inquiries'),
            }
          : null,
        counselingTrackOverview.parentRequestCount > 0
          ? {
              key: 'queue-parent-request',
              label: '학부모 문의',
              title: `학부모 문의 ${counselingTrackOverview.parentRequestCount}건`,
              detail: `${counselingTrackOverview.parentRequests[0]?.studentName || '학생'} 관련 학부모 요청부터 확인해 바로 후속조치를 이어가세요.`,
              meta: counselingTrackOverview.parentRequests[0]?.timeLabel || '최근 접수 순',
              tone: 'teal' as const,
              onClick: () => openCounselTrackDialog('parent'),
            }
          : null,
      ].filter((item): item is NonNullable<typeof item> => Boolean(item)),
    [adminLateSignals, adminNoShowSignals, attendanceSeatSignalsByStudentId, counselingTrackOverview, pendingOtherAttendanceRequests, pendingScheduleChangeRequests]
  );
  const adminOperationsInboxPanels = useMemo<OperationsInboxPanel[]>(
    () => [
      {
        key: 'panel-no-show',
        label: '출결',
        title: '연락 필요 미입실',
        count: adminNoShowSignals.length,
        emptyLabel: '예정 등원시간을 넘긴 미입실 학생이 없습니다.',
        tone: 'rose' as const,
        rows: adminNoShowSignals.slice(0, 3).map((signal) => {
          const roomName = signal.roomId ? roomNameById.get(signal.roomId) || signal.roomId : '좌석 미배정';
          const roomLabel = signal.roomSeatNo ? `${roomName} ${signal.roomSeatNo}번` : roomName;
          return {
            key: `no-show-${signal.seatId}`,
            title: signal.studentName,
            detail: signal.note || '예정 등원시간이 지났지만 아직 입실 증거가 없습니다.',
            meta: signal.routineExpectedArrivalTime ? `예정 ${signal.routineExpectedArrivalTime}` : '예정 시간 미등록',
            badge: roomLabel,
            tone: 'rose' as const,
            onClick: () => openAdminAttendanceSignal(signal),
          };
        }),
        onOpenAll: adminNoShowSignals.length > 0 ? () => setIsAttendancePriorityDialogOpen(true) : undefined,
      },
      {
        key: 'panel-late',
        label: '출결',
        title: '지각',
        count: adminLateSignals.length,
        emptyLabel: '오늘 지각 학생이 없습니다.',
        tone: 'orange' as const,
        rows: adminLateSignals.slice(0, 3).map((signal) => {
          const roomName = signal.roomId ? roomNameById.get(signal.roomId) || signal.roomId : '좌석 미배정';
          const roomLabel = signal.roomSeatNo ? `${roomName} ${signal.roomSeatNo}번` : roomName;
          return {
            key: `late-${signal.seatId}`,
            title: signal.studentName,
            detail: signal.note || '지각 입실 이후 수업 흐름을 다시 확인할 필요가 있습니다.',
            meta: buildAdminCheckInTimeLabel(signal),
            badge: roomLabel,
            tone: 'orange' as const,
            onClick: () => openAdminAttendanceSignal(signal),
          };
        }),
        onOpenAll: adminLateSignals.length > 0 ? () => setIsAttendancePriorityDialogOpen(true) : undefined,
      },
      {
        key: 'panel-attendance-request',
        label: '출결',
        title: '출결 요청 확인',
        count: pendingOtherAttendanceRequests.length,
        emptyLabel: '처리 대기 중인 출결 요청이 없습니다.',
        tone: 'amber' as const,
        rows: pendingOtherAttendanceRequests.slice(0, 3).map((request) => ({
          key: `attendance-request-${request.id}`,
          title: `${request.studentName || '학생'} · ${getAttendanceRequestTypeLabel(request.type)}`,
          detail: buildAttendanceRequestTimingSummary(request),
          meta: request.date || '일자 미입력',
          badge: getAttendanceRequestCreatedLabel(request),
          tone: 'amber' as const,
          onClick: openAttendanceRequestsPage,
        })),
        onOpenAll: pendingOtherAttendanceRequests.length > 0 ? openAttendanceRequestsPage : undefined,
      },
      {
        key: 'panel-schedule-change',
        label: '일정',
        title: '학원 일정 변경 확인',
        count: pendingScheduleChangeRequests.length,
        emptyLabel: '학부모 확인이 필요한 학원/외출 변경 접수가 없습니다.',
        tone: 'teal' as const,
        rows: pendingScheduleChangeRequests.slice(0, 3).map((request) => ({
          key: `schedule-change-${request.id}`,
          title: `${request.studentName || '학생'} · 학원/외출 변경`,
          detail: buildScheduleChangeOpsDetail(request),
          meta: request.date || '일자 미입력',
          badge: '학부모 확인',
          tone: 'teal' as const,
          onClick: openAttendanceRequestsPage,
        })),
        onOpenAll: pendingScheduleChangeRequests.length > 0 ? openAttendanceRequestsPage : undefined,
      },
      {
        key: 'panel-consultation',
        label: '상담',
        title: '상담 문의/예약',
        count: counselingTrackOverview.consultationCount,
        emptyLabel: '열린 상담 문의나 예약 대기가 없습니다.',
        tone: 'violet' as const,
        rows: counselingTrackOverview.consultationInbox.map((item) => ({
          key: item.id,
          title: item.studentName,
          detail: item.preview,
          meta: item.timeLabel,
          badge: item.badge,
          tone: item.tone,
          onClick: () => openCounselTrackDialog(item.targetTab),
        })),
        onOpenAll:
          counselingTrackOverview.consultationCount > 0
            ? () => openCounselTrackDialog('reservations')
            : undefined,
      },
      {
        key: 'panel-wifi',
        label: '요청',
        title: '방화벽 요청',
        count: counselingTrackOverview.wifiCount,
        emptyLabel: '열린 방화벽 요청이 없습니다.',
        tone: 'amber' as const,
        rows: counselingTrackOverview.wifiRequests.map((item) => ({
          key: item.id,
          title: item.studentName,
          detail: item.requestedUrl ? `${item.requestedUrl} · ${item.preview}` : item.preview,
          meta: item.timeLabel,
          badge: item.badge,
          tone: item.tone,
          onClick: () => openCounselTrackDialog(item.targetTab),
        })),
        onOpenAll:
          counselingTrackOverview.wifiCount > 0
            ? () => openCounselTrackDialog('inquiries')
            : undefined,
      },
      {
        key: 'panel-parent-request',
        label: '학부모',
        title: '학부모 문의',
        count: counselingTrackOverview.parentRequestCount,
        emptyLabel: '열린 학부모 문의가 없습니다.',
        tone: 'teal' as const,
        rows: counselingTrackOverview.parentRequests.map((item) => ({
          key: item.id,
          title: item.parentName ? `${item.studentName} · ${item.parentName}` : item.studentName,
          detail: item.preview,
          meta: item.timeLabel,
          badge: item.badge,
          tone: item.tone,
          onClick: () => openCounselTrackDialog(item.targetTab),
        })),
        onOpenAll:
          counselingTrackOverview.parentRequestCount > 0
            ? () => openCounselTrackDialog('parent')
            : undefined,
      },
    ],
    [adminLateSignals, adminNoShowSignals, attendanceSeatSignalsByStudentId, counselingTrackOverview, pendingOtherAttendanceRequests, pendingScheduleChangeRequests, roomNameById]
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

  const handleCreatePointBoost = async () => {
    if (!centerId) return;

    const multiplier = Number(pointBoostMultiplierDraft);
    const pointBoostMessage = pointBoostMessageDraft.trim();
    if (!Number.isFinite(multiplier) || multiplier <= 1) {
      toast({
        variant: 'destructive',
        title: '배율 확인 필요',
        description: '배율은 1보다 큰 숫자로 입력해 주세요.',
      });
      return;
    }

    let startAtMs: number | null = null;
    let endAtMs: number | null = null;
    if (pointBoostModeDraft === 'day') {
      const dayRange = parseKstDayRange(pointBoostDateDraft);
      startAtMs = dayRange?.startAtMs ?? null;
      endAtMs = dayRange?.endAtMs ?? null;
    } else {
      startAtMs = parseKstDateTimeInput(pointBoostStartDraft);
      endAtMs = parseKstDateTimeInput(pointBoostEndDraft);
    }

    if (!startAtMs || !endAtMs || endAtMs <= startAtMs) {
      toast({
        variant: 'destructive',
        title: '시간 설정 확인 필요',
        description: '부스트 시작 시간과 종료 시간을 다시 확인해 주세요.',
      });
      return;
    }

    setIsCreatingPointBoost(true);
    try {
      await createPointBoostEventSecure({
        centerId,
        mode: pointBoostModeDraft,
        startAtMs,
        endAtMs,
        multiplier,
        message: pointBoostMessage || buildDefaultPointBoostMessage(multiplier),
      });
      setPointBoostMessageDraft('');
      toast({
        title: '포인트 부스트 생성 완료',
        description: `${formatPointBoostMultiplier(multiplier)} 이벤트를 저장했어요.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '포인트 부스트 생성 실패',
        description: getCallableErrorMessage(error, '잠시 후 다시 시도해 주세요.'),
      });
    } finally {
      setIsCreatingPointBoost(false);
    }
  };
  const handleCancelPointBoost = async (eventId: string) => {
    if (!centerId) return;
    setCancellingPointBoostId(eventId);
    try {
      await cancelPointBoostEventSecure({ centerId, eventId });
      toast({
        title: '포인트 부스트 취소 완료',
        description: '선택한 부스트 이벤트를 취소했어요.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: '포인트 부스트 취소 실패',
        description: getCallableErrorMessage(error, '잠시 후 다시 시도해 주세요.'),
      });
    } finally {
      setCancellingPointBoostId((current) => (current === eventId ? null : current));
    }
  };
  function renderHomeHeroSection() {
    return (
      <OperationsInbox
        headline={homeStatusHeadline}
        summary={homeStatusMeta.summary}
        statusLabel={homeStatusMeta.label}
        statusTone={adminOperationsInboxStatusTone}
        liveLabel={`${liveDateLabel} ${liveSyncLabel}`}
        totalOpenCount={adminOperationsInboxTotalOpenCount}
        summaryChips={adminOperationsInboxSummaryChips}
        queueItems={adminOperationsInboxQueueItems}
        panels={adminOperationsInboxPanels}
        headerActions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPointBoostDialogOpen(true)}
              className="h-10 rounded-xl border-2 border-[#DCE7FF] bg-white px-3 text-xs font-black text-[#14295F]"
            >
              포인트 부스트
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAnnouncementDialogOpen(true)}
              className="h-10 rounded-xl border-2 border-[#DCE7FF] bg-white px-3 text-xs font-black text-[#14295F]"
            >
              공지 보내기
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOperationsMemoOpen(true)}
              className="h-10 rounded-xl border-2 border-[#DCE7FF] bg-white px-3 text-xs font-black text-[#14295F]"
            >
              운영 메모
            </Button>
          </>
        }
        queueButtonLabel="긴급 흐름"
        onOpenQueue={() => setIsControlAlertsDialogOpen(true)}
      />
    );

    // ── KPI cards for the summary bar ──
    const kpiCards = [
      {
        key: 'total-students',
        label: '등원 예정',
        value: metrics.totalStudents,
        unit: '명',
        icon: Users,
        tone: 'blue' as const,
        delta: null,
        deltaLabel: selectedClass === 'all' ? '센터 전체' : selectedClass,
      },
      {
        key: 'checked-in',
        label: '현재 착석',
        value: metrics.checkedInCount,
        unit: '명',
        icon: Armchair,
        tone: 'navy' as const,
        delta: null,
        deltaLabel: `점유율 ${metrics.seatOccupancy}%`,
        onClick: () => setIsStudyingStudentsDialogOpen(true),
      },
      {
        key: 'late-absent',
        label: '미등원·지각',
        value: attendanceBoardSummary.lateOrAbsentCount,
        unit: '명',
        icon: Clock,
        tone: attendanceBoardSummary.lateOrAbsentCount > 0 ? 'orange' as const : 'default' as const,
        delta: null,
        onClick: () => setIsAttendancePriorityDialogOpen(true),
      },
      {
        key: 'urgent',
        label: '즉시 확인',
        value: urgentInterventionStudents.length,
        unit: '명',
        icon: ShieldAlert,
        tone: urgentInterventionStudents.length > 0 ? 'rose' as const : 'emerald' as const,
        delta: null,
        onClick: () => urgentInterventionStudents.length > 0 && setIsImmediateInterventionSheetOpen(true),
      },
      {
        key: 'focus-score',
        label: '집중 점수',
        value: metrics.focusKpi.score,
        unit: '점',
        icon: Activity,
        tone: 'default' as const,
        delta: metrics.focusKpi.delta,
        deltaLabel: metrics.focusKpi.delta !== 0
          ? `전일 대비 ${metrics.focusKpi.delta > 0 ? '+' : ''}${metrics.focusKpi.delta}`
          : metrics.focusKpi.levelLabel,
      },
      {
        key: 'today-points',
        label: '오늘 지급 포인트',
        value: todayPointsSummary.totalPoints.toLocaleString(),
        unit: 'pt',
        icon: Sparkles,
        tone: pointBoostOverview.activeEvent ? 'orange' as const : 'blue' as const,
        delta: null,
        deltaLabel: pointBoostOverview.activeEvent
          ? `${pointBoostOverview.activeEvent.multiplierLabel} 부스트 진행중`
          : `지급 학생 ${todayPointsSummary.earners}명`,
        onClick: () => openPointHistoryDialog('today'),
      },
      {
        key: 'lead-pipeline',
        label: '상담·리드',
        value: metrics.leadPipelineCount30d,
        unit: '건',
        icon: Megaphone,
        tone: 'default' as const,
        delta: null,
        deltaLabel: '최근 30일',
      },
    ];
    return (
      <motion.section className="space-y-5 px-1" {...getStudioMotionProps(0.04, 14)}>
        {/* ═══ A. Executive Status Header ═══ */}
        <motion.div
          className="relative overflow-hidden rounded-[2rem] border border-[#1C3A82] admin-exec-header text-white shadow-[0_32px_64px_-40px_rgba(20,41,95,0.6)]"
          {...getStudioMotionProps(0.06, 16)}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(37,84,215,0.15),transparent_50%)]" />
          <div className="relative px-6 py-5 sm:px-8 sm:py-6">
            <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-center justify-between')}>
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className={cn(
                    'rounded-full border px-3 py-1 text-[10px] font-black',
                    homeStatusMeta.label === '안정'
                      ? 'border-emerald-200/20 bg-emerald-500/10 text-emerald-200'
                      : homeStatusMeta.label === '주의'
                        ? 'border-amber-200/20 bg-amber-500/10 text-amber-200'
                        : 'border-[#FFB57A]/30 bg-[#FF7A16]/14 text-[#FFD7BA]'
                  )}>
                    <span className={cn(
                      'mr-1.5 inline-block h-1.5 w-1.5 rounded-full',
                      homeStatusMeta.label === '안정' ? 'bg-emerald-400'
                        : homeStatusMeta.label === '주의' ? 'bg-amber-400 admin-alert-dot'
                        : 'bg-[#FF7A16] admin-alert-dot'
                    )} />
                    {homeStatusMeta.label}
                  </Badge>
                  {totalControlAlerts > 0 && (
                    <Badge className="rounded-full border border-[#FFB57A]/30 bg-[#FF7A16]/14 px-2.5 py-1 text-[10px] font-black text-[#FFD7BA]">
                      경고 {totalControlAlerts}건
                    </Badge>
                  )}
                  {pointBoostOverview.activeEvent ? (
                    <Badge className="rounded-full border border-[#FFB57A]/30 bg-[#FF7A16]/14 px-2.5 py-1 text-[10px] font-black text-[#FFD7BA]">
                      포인트 {pointBoostOverview.activeEvent.multiplierLabel}
                    </Badge>
                  ) : null}
                </div>
                <h1 className="admin-section-title text-[1.75rem] tracking-tight text-white sm:text-[2rem]">
                  {homeStatusHeadline}
                </h1>
                <p className="max-w-[36rem] text-sm font-semibold leading-6 text-white/60">
                  {homeStatusMeta.summary}
                </p>
              </div>

              <div className={cn('flex gap-3', isMobile ? 'flex-wrap' : 'items-center')}>
                <div className="flex items-center gap-2 rounded-[1.2rem] border border-white/10 bg-white/8 px-4 py-2.5">
                  <Clock className="h-3.5 w-3.5 text-white/50" />
                  <span className="text-[10px] font-black text-white/60">{liveDateLabel}</span>
                  <span className="admin-kpi-number text-lg text-white">{liveSyncLabel}</span>
                </div>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => setIsPointBoostDialogOpen(true)} title="포인트 부스트" className={cn(
                    'group inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border text-white/70 transition-all duration-200 hover:-translate-y-0.5 hover:text-white',
                    pointBoostOverview.activeEvent
                      ? 'border-[#FFB57A]/40 bg-[#FF7A16]/18 text-[#FFD7BA] hover:bg-[#FF7A16]/24'
                      : 'border-white/10 bg-white/8 hover:border-[#FF7A16]/40 hover:bg-[#FF7A16]/14'
                  )}>
                    <Sparkles className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setIsAnnouncementDialogOpen(true)} title="공지 보내기" className="group inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/10 bg-white/8 text-white/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF7A16]/40 hover:bg-[#FF7A16]/14 hover:text-white">
                    <Megaphone className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setIsOperationsMemoOpen(true)} title="운영 메모" className="group inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/10 bg-white/8 text-white/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF7A16]/40 hover:bg-[#FF7A16]/14 hover:text-white">
                    <ClipboardCheck className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ═══ B. KPI Summary Bar ═══ */}
        <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-3 xl:grid-cols-7')}>
          {kpiCards.map((card, index) => {
            const KpiIcon = card.icon;
            const toneMap: Record<string, { card: string; label: string; value: string; iconBg: string; icon: string }> = {
              navy: { card: 'border-[#C8D8F8] bg-[linear-gradient(180deg,#14295F_0%,#1B3D89_100%)] text-white', label: 'text-white/55', value: 'text-white', iconBg: 'bg-white/10', icon: 'text-white/70' },
              orange: { card: 'border-[#FFD7BA] bg-[linear-gradient(180deg,#FFF6EE_0%,#FFFFFF_100%)] admin-glow-pulse', label: 'text-[#C95A08]', value: 'text-[#C95A08]', iconBg: 'bg-[#FF7A16]/10', icon: 'text-[#FF7A16]' },
              emerald: { card: 'border-emerald-100 bg-[linear-gradient(180deg,#F0FDF4_0%,#FFFFFF_100%)]', label: 'text-emerald-700/70', value: 'text-emerald-800', iconBg: 'bg-emerald-50', icon: 'text-emerald-600' },
              rose: { card: 'border-rose-100 bg-[linear-gradient(180deg,#FFF1F2_0%,#FFFFFF_100%)]', label: 'text-rose-700/70', value: 'text-rose-800', iconBg: 'bg-rose-50', icon: 'text-rose-600' },
              blue: { card: 'border-[#DCE7FF] bg-[linear-gradient(180deg,#F0F5FF_0%,#FFFFFF_100%)]', label: 'text-[#5c6e97]', value: 'text-[#14295F]', iconBg: 'bg-[#EEF4FF]', icon: 'text-[#2554D7]' },
              default: { card: 'border-[#DCE7FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)]', label: 'text-[#5c6e97]', value: 'text-[#14295F]', iconBg: 'bg-[#F7FAFF]', icon: 'text-[#5c6e97]' },
            };
            const t = toneMap[card.tone] || toneMap.default;
            const isClickable = !!card.onClick;
            return (
              <motion.div
                key={card.key}
                {...getStudioMotionProps(0.06 + index * 0.04, 14)}
              >
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={card.onClick}
                  className={cn(
                    'admin-card-lift group w-full rounded-[1.5rem] border p-4 text-left',
                    t.card,
                    isClickable ? 'cursor-pointer' : 'cursor-default'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-[10px] font-black uppercase tracking-[0.18em]', t.label)}>{card.label}</p>
                    <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-[0.7rem]', t.iconBg)}>
                      <KpiIcon className={cn('h-3.5 w-3.5', t.icon)} />
                    </span>
                  </div>
                  <div className="mt-3 flex items-end gap-1.5">
                    <span className={cn('admin-kpi-number text-[1.75rem]', t.value)}>{card.value}</span>
                    {card.unit && <span className={cn('mb-0.5 text-xs font-bold', t.label)}>{card.unit}</span>}
                  </div>
                  {card.delta !== null && card.delta !== undefined && card.delta !== 0 && (
                    <div className="mt-2 flex items-center gap-1">
                      {card.delta > 0 ? <ArrowUpRight className="h-3 w-3 text-emerald-600" /> : <ArrowDownRight className="h-3 w-3 text-rose-500" />}
                      <span className={cn('text-[11px] font-bold', card.delta > 0 ? 'text-emerald-600' : 'text-rose-500')}>
                        {card.deltaLabel}
                      </span>
                    </div>
                  )}
                  {(card.delta === null || card.delta === 0) && card.deltaLabel && (
                    <p className={cn('mt-2 text-[11px] font-bold', t.label)}>{card.deltaLabel}</p>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* ═══ C. Main Operation Cards Grid ═══ */}
        <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-12')}>

          {/* C1. 실시간 교실 요약 */}
          <motion.div className={cn(isMobile ? '' : 'xl:col-span-3')} {...getStudioMotionProps(0.12, 18)}>
            <Card className="admin-card-lift h-full overflow-hidden rounded-[2rem] border border-[#DCE7FF] admin-surface-primary shadow-[0_24px_50px_-36px_rgba(20,41,95,0.28)]">
              <CardHeader className="border-b border-[#E4ECFF] pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={studioSectionEyebrowClassName}>실시간 교실</p>
                    <CardTitle className="mt-1.5 text-lg font-black tracking-tight text-[#14295F]">교실 현황</CardTitle>
                  </div>
                  <Badge className="rounded-full border-none bg-[#14295F] px-2.5 py-1 text-[10px] font-black text-white">{metrics.checkedInCount}명 착석</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3.5 p-5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-[1.25rem] border border-[#DCE7FF] bg-white px-3.5 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">착석</p>
                    <p className="admin-kpi-number mt-1.5 text-[1.4rem] text-[#14295F]">{metrics.checkedInCount}</p>
                  </div>
                  <div className="rounded-[1.25rem] border border-[#DCE7FF] bg-[#F8FBFF] px-3.5 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">미입실·지각</p>
                    <p className="admin-kpi-number mt-1.5 text-[1.4rem] text-[#14295F]">{attendanceBoardSummary.lateOrAbsentCount}</p>
                  </div>
                  <div className={cn('rounded-[1.25rem] border px-3.5 py-3', attendanceBoardSummary.longAwayCount > 0 ? 'border-[#FFD7BA] bg-[#FFF8F2]' : 'border-[#DCE7FF] bg-white')}>
                    <p className={cn('text-[10px] font-black uppercase tracking-[0.16em]', attendanceBoardSummary.longAwayCount > 0 ? 'text-[#C95A08]' : 'text-[#5c6e97]')}>장기 외출</p>
                    <p className={cn('admin-kpi-number mt-1.5 text-[1.4rem]', attendanceBoardSummary.longAwayCount > 0 ? 'text-[#C95A08]' : 'text-[#14295F]')}>{attendanceBoardSummary.longAwayCount}</p>
                  </div>
                  <div className={cn('rounded-[1.25rem] border px-3.5 py-3', urgentInterventionStudents.length > 0 ? 'border-[#FFD7BA] bg-[#FFF2E8]' : 'border-[#DCE7FF] bg-white')}>
                    <p className={cn('text-[10px] font-black uppercase tracking-[0.16em]', urgentInterventionStudents.length > 0 ? 'text-[#C95A08]' : 'text-[#5c6e97]')}>즉시 개입</p>
                    <p className={cn('admin-kpi-number mt-1.5 text-[1.4rem]', urgentInterventionStudents.length > 0 ? 'text-[#C95A08]' : 'text-[#14295F]')}>{urgentInterventionStudents.length}</p>
                  </div>
                </div>
                <div className="grid gap-2">
                  {roomOverviewRows.slice(0, 3).map((room) => (
                    <button key={room.id} type="button" onClick={() => handleOpenAttendanceOverview(room.id)} className="admin-card-lift rounded-[1.35rem] border border-[#DCE7FF] bg-[#F7FAFF] px-4 py-3 text-left hover:border-[#FF7A16]/24 hover:bg-white">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-[#14295F]">{room.name}</p>
                          <p className="mt-0.5 text-[11px] font-bold text-[#5c6e97]">
                            착석 {room.focusedCount}/{room.totalSeats}
                            {room.alertCount > 0 && <span className="text-[#C95A08]"> · 경고 {room.alertCount}건</span>}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-[#5c6e97]" />
                      </div>
                    </button>
                  ))}
                </div>
                <Button type="button" variant="outline" className="h-10 w-full rounded-[1.25rem] border-[#DCE7FF] bg-white font-black text-[#14295F] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF7A16]/24 hover:text-[#C95A08]" onClick={() => handleOpenAttendanceOverview('all')}>
                  전체 좌석 보기
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* C2. 즉시 개입 학생 */}
          <motion.div className={cn(isMobile ? '' : 'xl:col-span-4')} {...getStudioMotionProps(0.16, 18)}>
            <Card className={cn('admin-card-lift h-full overflow-hidden rounded-[2rem] border shadow-[0_24px_50px_-36px_rgba(20,41,95,0.28)]', primaryUrgentIntervention ? 'border-[#FFD7BA] admin-surface-alert' : 'border-[#DCE7FF] admin-surface-primary')}>
              <CardHeader className="border-b border-[#E4ECFF] pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={studioSectionEyebrowClassName}>즉시 개입 학생</p>
                    <CardTitle className="mt-1.5 text-lg font-black tracking-tight text-[#14295F]">우선 조치 대상</CardTitle>
                    <CardDescription className="mt-1 text-xs font-bold leading-5 text-[#5c6e97]">
                      가장 위험한 학생부터 빠르게 확인합니다.
                    </CardDescription>
                  </div>
                  <Badge className={cn('rounded-full border-none px-2.5 py-1 text-[10px] font-black', urgentInterventionStudents.length > 0 ? 'bg-[#FF7A16] text-white' : 'bg-[#EEF4FF] text-[#2554D7]')}>
                    {urgentInterventionStudents.length}명
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                {urgentInterventionStudents.length === 0 ? (
                  <div className="rounded-[1.45rem] border border-dashed border-[#DCE7FF] bg-[#F7FAFF] px-4 py-8 text-center">
                    <ShieldAlert className="mx-auto h-6 w-6 text-emerald-400" />
                    <p className="mt-2 text-xs font-bold text-[#5c6e97]">현재 즉시 개입이 필요한 학생이 없습니다.</p>
                  </div>
                ) : (
                  <>
                    {primaryUrgentIntervention && (
                      <button type="button" onClick={() => setSelectedFocusStudentId(primaryUrgentIntervention.studentId)} className="admin-card-lift w-full rounded-[1.7rem] border border-[#FFD7BA] bg-[linear-gradient(180deg,#FFF4EA_0%,#FFFFFF_100%)] p-4 text-left shadow-[0_22px_36px_-30px_rgba(255,122,22,0.2)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="h-6 rounded-full border-none bg-[#FF7A16] px-2.5 text-[10px] font-black text-white">1순위</Badge>
                              {primaryUrgentIntervention.className && <Badge className="h-6 rounded-full border-none bg-white px-2.5 text-[10px] font-black text-[#14295F] shadow-sm">{primaryUrgentIntervention.className}</Badge>}
                            </div>
                            <p className="mt-2.5 text-base font-black text-[#14295F]">{primaryUrgentIntervention.studentName}</p>
                            <p className="mt-0.5 text-[11px] font-bold text-[#5c6e97]">{primaryUrgentRoomLabel} · {primaryUrgentIntervention.attendanceStatus}</p>
                            <p className="mt-1.5 text-sm font-black text-[#C95A08]">{primaryUrgentIntervention.topReason}</p>
                          </div>
                          <div className="rounded-[1.2rem] border border-[#FFD7BA] bg-white px-3 py-2 text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">위험</p>
                            <p className="admin-kpi-number mt-1 text-[1.3rem] text-[#14295F]">{primaryUrgentIntervention.compositeHealth}</p>
                          </div>
                        </div>
                      </button>
                    )}
                    <div className="grid gap-2">
                      {secondaryUrgentInterventions.slice(0, 2).map((signal, index) => {
                        const roomLabel = signal.roomId ? roomNameById.get(signal.roomId) || signal.roomId : '미배정';
                        return (
                          <button key={`${signal.studentId}-${signal.seatId}`} type="button" onClick={() => setSelectedFocusStudentId(signal.studentId)} className="admin-card-lift grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 rounded-[1.25rem] border border-[#DCE7FF] bg-[#F7FAFF] px-3 py-3 text-left hover:bg-white">
                            <span className="text-xs font-black text-[#C95A08]">{index + 2}</span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-[#14295F]">{signal.studentName}</p>
                              <p className="mt-0.5 truncate text-[11px] font-bold text-[#5c6e97]">{roomLabel} · {signal.topReason}</p>
                            </div>
                            <p className="text-sm font-black text-[#14295F]">{signal.compositeHealth}점</p>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                <Button type="button" variant="outline" className="h-10 w-full rounded-[1.25rem] border-[#DCE7FF] bg-white font-black text-[#14295F] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF7A16]/24 hover:text-[#C95A08]" onClick={() => setIsImmediateInterventionSheetOpen(true)}>
                  전체 우선순위 보기
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* C3. 오늘의 TOP 3 */}
          <motion.div className={cn(isMobile ? '' : 'xl:col-span-3')} {...getStudioMotionProps(0.20, 18)}>
            <Card className="admin-card-lift h-full overflow-hidden rounded-[2rem] border border-[#DCE7FF] admin-surface-primary shadow-[0_24px_50px_-36px_rgba(20,41,95,0.28)]">
              <CardHeader className="border-b border-[#E4ECFF] pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={studioSectionEyebrowClassName}>오늘의 TOP 3</p>
                    <CardTitle className="mt-1.5 text-lg font-black tracking-tight text-[#14295F]">학습 우수 학생</CardTitle>
                  </div>
                  <Badge className="rounded-full border-none bg-[#14295F] px-2.5 py-1 text-[10px] font-black text-white"><Trophy className="mr-1 inline h-3 w-3" />TOP 3</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                {topFocusCompactPreview.length === 0 ? (
                  <div className="rounded-[1.45rem] border border-dashed border-[#DCE7FF] bg-[#F7FAFF] px-4 py-8 text-center text-xs font-bold text-[#5c6e97]">오늘의 상위 학생 집계가 아직 준비되지 않았습니다.</div>
                ) : (
                  <>
                    {topFocusLeader && (
                      <button type="button" onClick={() => setSelectedFocusStudentId(topFocusLeader.studentId)} className="admin-card-lift w-full rounded-[1.65rem] border border-[#17326B] admin-surface-dark p-4 text-left text-white shadow-[0_24px_42px_-34px_rgba(20,41,95,0.48)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Badge className="h-6 rounded-full border-none bg-[#FF7A16] px-2.5 text-[10px] font-black text-white">1위</Badge>
                            <p className="mt-2.5 text-base font-black">{topFocusLeader.name}</p>
                            <p className="mt-0.5 text-[11px] font-bold text-white/72">{topFocusLeader.className} · {getTopPerformerHighlight(topFocusLeader)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50">집중</p>
                            <p className="admin-kpi-number mt-1 text-[1.4rem] text-white">{topFocusLeader.score}</p>
                          </div>
                        </div>
                      </button>
                    )}
                    <div className="grid gap-2">
                      {topFocusCompactPreview.slice(1).map((student, index) => (
                        <button key={student.studentId} type="button" onClick={() => setSelectedFocusStudentId(student.studentId)} className="admin-card-lift grid w-full grid-cols-[28px_1fr_auto] items-center gap-3 rounded-[1.2rem] border border-[#DCE7FF] bg-[#F7FAFF] px-3 py-3 text-left hover:border-[#2554D7]/24 hover:bg-white">
                          <span className="text-xs font-black text-[#2554D7]">{index + 2}위</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-[#14295F]">{student.name}</p>
                            <p className="mt-0.5 truncate text-[11px] font-bold text-[#5c6e97]">{student.className} · {getTopPerformerHighlight(student)}</p>
                          </div>
                          <p className="text-sm font-black text-[#14295F]">{student.score}점</p>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* C4. 보조 액션 (운영 메모 + 출결 연락 + 빠른 이동) */}
          <motion.div className={cn(isMobile ? '' : 'xl:col-span-2')} {...getStudioMotionProps(0.24, 18)}>
            <Card className="admin-card-lift h-full overflow-hidden rounded-[2rem] border border-[#DCE7FF] admin-surface-primary shadow-[0_24px_50px_-36px_rgba(20,41,95,0.28)]">
              <CardHeader className="border-b border-[#E4ECFF] pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={studioSectionEyebrowClassName}>빠른 액션</p>
                    <CardTitle className="mt-1.5 text-lg font-black tracking-tight text-[#14295F]">운영 도구</CardTitle>
                  </div>
                  <Badge className="rounded-full border-none bg-[#EEF4FF] px-2.5 py-1 text-[10px] font-black text-[#2554D7]">보조</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                <button type="button" onClick={() => setIsOperationsMemoOpen(true)} className="admin-card-lift w-full rounded-[1.45rem] border border-[#DCE7FF] bg-white px-4 py-3 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">운영 메모</p>
                      <p className="mt-1.5 text-sm font-black text-[#14295F]">{topAdminPriority?.title || '오늘 메모 없음'}</p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 text-[#5c6e97]" />
                  </div>
                </button>

                <button type="button" onClick={() => setIsAttendancePriorityDialogOpen(true)} className="admin-card-lift w-full rounded-[1.45rem] border border-[#DCE7FF] bg-[#F7FAFF] px-4 py-3 text-left hover:bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">출결 연락</p>
                      <p className="mt-1.5 text-sm font-black text-[#14295F]">
                        {primaryAttendanceContactTarget ? `${todayAttendanceContactTargets.length}명` : '없음'}
                      </p>
                    </div>
                    <Phone className="mt-1 h-4 w-4 text-[#C95A08]" />
                  </div>
                </button>

                <div className="grid gap-1.5">
                  {compactQuickActionLinks.map((item) => {
                    const QuickIcon = item.icon;
                    return (
                      <Link key={item.href} href={item.href} className="admin-card-lift flex items-center justify-between rounded-[1.2rem] border border-[#DCE7FF] bg-[#F7FAFF] px-3 py-2.5 hover:bg-white">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-[0.8rem] bg-[#14295F] text-white">
                            <QuickIcon className="h-3.5 w-3.5" />
                          </span>
                          <p className="text-sm font-black text-[#14295F]">{item.label}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-[#5c6e97]" />
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div {...getStudioMotionProps(0.26, 16)}>
          <Card className={cn('admin-card-lift overflow-hidden', studioWhiteCardClassName)}>
            <CardHeader className="border-b border-[#E4ECFF] pb-5">
              <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-full border border-[#DCE7FF] bg-white px-2.5 py-1 text-[10px] font-black text-[#14295F]">학생 상담트랙</Badge>
                    <Badge className="rounded-full border border-[#FFD7BA] bg-[#FFF4EA] px-2.5 py-1 text-[10px] font-black text-[#C95A08]">바로 확인</Badge>
                  </div>
                  <CardTitle className="mt-3 text-[1.5rem] font-black tracking-tight text-[#14295F]">
                    와이파이 요청, 1:1 연락, 상담문의를 한 번에 봅니다.
                  </CardTitle>
                  <CardDescription className="mt-2 max-w-[42rem] text-sm font-bold leading-6 text-[#5c6e97]">
                    학생·학부모와 오간 최근 연락과 예약 대기 흐름을 여기서 먼저 보고, 팝업 안에서 바로 처리합니다.
                  </CardDescription>
                </div>
                <button
                  type="button"
                  onClick={() => openCounselTrackDialog('reservations')}
                  className="inline-flex h-11 items-center justify-center rounded-[1.1rem] border border-[#DCE7FF] bg-white px-4 text-sm font-black text-[#14295F] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF7A16]/30 hover:text-[#C95A08]"
                >
                  상담트랙 열기
                </button>
              </div>

              <div className={cn('mt-5 grid gap-2.5', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
                <div className="rounded-[1.35rem] border border-[#FFD7BA] bg-[linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_100%)] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C95A08]">와이파이 요청</p>
                  <p className="admin-kpi-number mt-2 text-[1.5rem] text-[#14295F]">{counselingTrackOverview.wifiCount}</p>
                </div>
                <div className="rounded-[1.35rem] border border-[#DCE7FF] bg-[linear-gradient(180deg,#F7FAFF_0%,#FFFFFF_100%)] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2554D7]">학생 1:1</p>
                  <p className="admin-kpi-number mt-2 text-[1.5rem] text-[#14295F]">{counselingTrackOverview.studentContactCount}</p>
                </div>
                <div className="rounded-[1.35rem] border border-[#DCE7FF] bg-[linear-gradient(180deg,#F6FBFF_0%,#FFFFFF_100%)] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1D6F84]">학부모 1:1</p>
                  <p className="admin-kpi-number mt-2 text-[1.5rem] text-[#14295F]">{counselingTrackOverview.parentContactCount}</p>
                </div>
                <div className="rounded-[1.35rem] border border-[#D7DEFF] bg-[linear-gradient(180deg,#F4F6FF_0%,#FFFFFF_100%)] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#4B57C0]">상담 문의</p>
                  <p className="admin-kpi-number mt-2 text-[1.5rem] text-[#14295F]">{counselingTrackOverview.consultationCount}</p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5">
              <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'xl:grid-cols-3')}>
                <section className={cn(studioSoftPanelClassName, 'flex h-full flex-col gap-3')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Wifi className="h-4 w-4 text-[#FF7A16]" />
                        <p className={studioSectionEyebrowClassName}>와이파이 방화벽 해제 요청</p>
                      </div>
                      <p className="mt-1.5 text-sm font-black text-[#14295F]">열린 요청부터 바로 확인</p>
                    </div>
                    <button type="button" onClick={() => openCounselTrackDialog('inquiries')} className="inline-flex items-center gap-1 text-[11px] font-black text-[#C95A08] hover:text-[#FF7A16]">
                      전체 보기
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {counselingTrackOverview.wifiRequests.length === 0 ? (
                    <div className="flex h-full min-h-[148px] items-center justify-center rounded-[1.35rem] border border-dashed border-[#FFD7BA] bg-white/80 px-4 text-center text-xs font-bold leading-5 text-[#5c6e97]">
                      현재 열린 방화벽 해제 요청이 없습니다.
                    </div>
                  ) : (
                    <div className="grid gap-2.5">
                      {counselingTrackOverview.wifiRequests.map((item: any) => (
                        <button
                          key={`wifi-${item.id}`}
                          type="button"
                          onClick={() => openCounselTrackDialog('inquiries')}
                          className="admin-card-lift block rounded-[1.3rem] border border-[#FFD7BA] bg-[linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_100%)] px-4 py-3 hover:border-[#FF7A16]/40"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="h-6 rounded-full border-none bg-[#FF7A16] px-2.5 text-[10px] font-black text-white">{item.studentName}</Badge>
                                <span className="text-[11px] font-black text-[#C95A08]">{item.activityLabel}</span>
                              </div>
                              <p className="mt-2 flex items-center gap-1.5 truncate text-sm font-black text-[#14295F]">
                                <Link2 className="h-3.5 w-3.5 shrink-0 text-[#FF7A16]" />
                                {item.requestedUrl || '요청 URL 미입력'}
                              </p>
                              <p className="mt-1 text-[12px] font-bold leading-5 text-[#5c6e97] line-clamp-2">
                                {item.preview || '방화벽 해제 사유가 접수되었습니다.'}
                              </p>
                            </div>
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#5c6e97]" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className={cn(studioSoftPanelClassName, 'flex h-full flex-col gap-3')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-[#2554D7]" />
                        <p className={studioSectionEyebrowClassName}>학생·학부모 최근 1:1 연락</p>
                      </div>
                      <p className="mt-1.5 text-sm font-black text-[#14295F]">가장 최근 대화 흐름</p>
                    </div>
                    <button type="button" onClick={() => openCounselTrackDialog('parent')} className="inline-flex items-center gap-1 text-[11px] font-black text-[#2554D7] hover:text-[#14295F]">
                      전체 보기
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {counselingTrackOverview.recentContacts.length === 0 ? (
                    <div className="flex h-full min-h-[148px] items-center justify-center rounded-[1.35rem] border border-dashed border-[#DCE7FF] bg-white/80 px-4 text-center text-xs font-bold leading-5 text-[#5c6e97]">
                      최근 1:1 연락이 아직 없습니다.
                    </div>
                  ) : (
                    <div className="grid gap-2.5">
                      {counselingTrackOverview.recentContacts.map((item: any) => (
                        <button
                          key={`contact-${item.id}`}
                          type="button"
                          onClick={() => openCounselTrackDialog(item.targetTab)}
                          className="admin-card-lift block rounded-[1.3rem] border border-[#DCE7FF] bg-white px-4 py-3 hover:border-[#2554D7]/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={cn(
                                  'h-6 rounded-full border-none px-2.5 text-[10px] font-black',
                                  item.senderRole === 'student' ? 'bg-[#EEF4FF] text-[#2554D7]' : 'bg-[#EAFBFF] text-[#1D6F84]'
                                )}>
                                  {item.roleLabel}
                                </Badge>
                                <Badge className="h-6 rounded-full border-none bg-[#F7FAFF] px-2.5 text-[10px] font-black text-[#14295F]">
                                  {getCommunicationKindLabel(item)}
                                </Badge>
                                <span className="text-[11px] font-black text-[#5c6e97]">{item.activityLabel}</span>
                              </div>
                              <p className="mt-2 text-sm font-black text-[#14295F]">
                                {item.studentName}
                                {item.parentName ? <span className="text-[#5c6e97]"> · {item.parentName}</span> : null}
                              </p>
                              <p className="mt-1 text-[12px] font-bold leading-5 text-[#5c6e97] line-clamp-2">
                                {item.preview || '최근 연락 내용이 업데이트되었습니다.'}
                              </p>
                            </div>
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#5c6e97]" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className={cn(studioSoftPanelClassName, 'flex h-full flex-col gap-3')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <HeartHandshake className="h-4 w-4 text-[#4B57C0]" />
                        <p className={studioSectionEyebrowClassName}>상담 문의 / 예약 대기</p>
                      </div>
                      <p className="mt-1.5 text-sm font-black text-[#14295F]">바로 처리할 문의와 예약</p>
                    </div>
                    <button type="button" onClick={() => openCounselTrackDialog('reservations')} className="inline-flex items-center gap-1 text-[11px] font-black text-[#4B57C0] hover:text-[#14295F]">
                      전체 보기
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {counselingTrackOverview.consultationInbox.length === 0 ? (
                    <div className="flex h-full min-h-[148px] items-center justify-center rounded-[1.35rem] border border-dashed border-[#D7DEFF] bg-white/80 px-4 text-center text-xs font-bold leading-5 text-[#5c6e97]">
                      처리 대기 중인 상담 문의나 예약이 없습니다.
                    </div>
                  ) : (
                    <div className="grid gap-2.5">
                      {counselingTrackOverview.consultationInbox.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openCounselTrackDialog(item.targetTab)}
                          className={cn(
                            'admin-card-lift block rounded-[1.3rem] border px-4 py-3',
                            item.tone === 'navy'
                              ? 'border-[#D7DEFF] bg-[linear-gradient(180deg,#F4F6FF_0%,#FFFFFF_100%)] hover:border-[#4B57C0]/35'
                              : 'border-[#FFD7BA] bg-[linear-gradient(180deg,#FFF8F1_0%,#FFFFFF_100%)] hover:border-[#FF7A16]/35'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={cn(
                                  'h-6 rounded-full border-none px-2.5 text-[10px] font-black',
                                  item.tone === 'navy' ? 'bg-[#EEF1FF] text-[#4B57C0]' : 'bg-[#FFF1E6] text-[#C95A08]'
                                )}>
                                  {item.badge}
                                </Badge>
                                <span className="text-[11px] font-black text-[#5c6e97]">{item.timeLabel}</span>
                              </div>
                              <p className="mt-2 text-sm font-black text-[#14295F]">{item.title}</p>
                              <p className="mt-1 text-[12px] font-bold leading-5 text-[#5c6e97] line-clamp-2">{item.preview}</p>
                            </div>
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#5c6e97]" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ═══ D. Center Health Axes — 운영 5축 ═══ */}
        <motion.div {...getStudioMotionProps(0.28, 16)}>
          <Card className="overflow-hidden rounded-[2.25rem] border border-[#17326B] admin-surface-dark text-white shadow-[0_30px_70px_-44px_rgba(20,41,95,0.72)]">
            <CardHeader className="border-b border-[#DCE7FF] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(244,248,255,0.94)_100%)] pb-4">
              <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-full border border-[#DCE7FF] bg-white px-2.5 py-1 text-[10px] font-black text-[#14295F]">운영 5축</Badge>
                    <Badge className="rounded-full border border-[#FFD7BA] bg-[#FFF2E8] px-2.5 py-1 text-[10px] font-black text-[#14295F]">대표 차트</Badge>
                  </div>
                  <CardTitle className="mt-3 admin-section-title text-[1.55rem] tracking-tight text-[#14295F]">
                    {selectedHomeAxis ? `${selectedHomeAxis.label}부터 먼저 봅니다.` : '운영 5축에서 약한 축부터 봅니다.'}
                  </CardTitle>
                  <CardDescription className="mt-2 max-w-[42rem] text-sm font-bold leading-6 text-[#5c6e97]">
                    선택 축 추이와 개입 버튼만 이 영역에서 바로 봅니다.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-full border border-[#DCE7FF] bg-white px-3 py-1 text-[10px] font-black text-[#14295F]">{selectedClass === 'all' ? '센터 전체' : selectedClass}</Badge>
                  {selectedHomeAxis && <Badge className="rounded-full border border-[#FFD7BA] bg-[#FFF2E8] px-3 py-1 text-[10px] font-black text-[#14295F]">{selectedHomeAxis.summaryScore}점 · {selectedHomeAxis.summaryLabel}</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="rounded-[1.95rem] border border-white/12 bg-white/8 p-2 sm:p-3">
                {heatmapGraphSection}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.section>
    );
  }
  function renderHomeInsightsSection() {
    return (
      <motion.section className="space-y-4 px-1 pb-10" {...getStudioMotionProps(0.32, 14)}>
        <div className="admin-card-lift rounded-[1.85rem] border border-[#DCE7FF] bg-[linear-gradient(180deg,#F7FAFF_0%,#F0F4FC_100%)] px-5 py-5 shadow-[0_20px_40px_-34px_rgba(20,41,95,0.18)]">
          <div className={cn('flex gap-3', isMobile ? 'flex-col' : 'items-center justify-between')}>
            <div>
              <div className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-[#2554D7]" />
                <p className={studioSectionEyebrowClassName}>관리 도구</p>
              </div>
              <p className="mt-1 text-sm font-black text-[#14295F]">공지, 계정, 데이터 연동을 여기서 관리합니다.</p>
            </div>
            <Badge className="w-fit rounded-full border-none bg-white px-2.5 py-1 text-[10px] font-black text-[#2554D7] shadow-sm">
              보조 영역
            </Badge>
          </div>

          <div className={cn('mt-4 grid gap-3', isMobile ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1.05fr)]')}>
            {/* 공지 카드 */}
            <div className="admin-card-lift flex h-full flex-col gap-3 rounded-[1.5rem] border border-[#DCE7FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] px-4 py-4 shadow-[0_14px_24px_-26px_rgba(20,41,95,0.22)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-[0.7rem] bg-[#EEF4FF]">
                      <MessageSquare className="h-3.5 w-3.5 text-[#2554D7]" />
                    </span>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">공지</p>
                  </div>
                  <p className="mt-2 truncate text-sm font-black text-[#14295F]">{leadAnnouncement?.title || '최근 공지가 없습니다.'}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="h-8 rounded-full bg-[#FF7A16] px-3 text-[10px] font-black text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#E56D10]"
                  onClick={() => setIsAnnouncementDialogOpen(true)}
                >
                  공지 작성
                </Button>
              </div>
              <p className="line-clamp-2 flex-1 text-[11px] font-bold leading-5 text-[#5c6e97]">
                {leadAnnouncement?.body || '최근 등록 공지가 없어서 바로 새 공지를 작성할 수 있습니다.'}
              </p>
            </div>

            {/* 계정/활동 카드 */}
            <div className="admin-card-lift flex h-full flex-col gap-3 rounded-[1.5rem] border border-[#DCE7FF] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] px-4 py-4 shadow-[0_14px_24px_-26px_rgba(20,41,95,0.22)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-[0.7rem] bg-[#EEF4FF]">
                      <UserCog className="h-3.5 w-3.5 text-[#2554D7]" />
                    </span>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">계정 / 활동</p>
                  </div>
                  <p className="mt-2 truncate text-sm font-black text-[#14295F]">
                    {leadTeacherActivity ? leadTeacherActivity.teacherName : `운영 계정 ${teacherRows.length}명`}
                  </p>
                </div>
                <Badge className="h-6 rounded-full border-none bg-[#14295F] px-2.5 text-[10px] font-black text-white">
                  {teacherRows.length}명
                </Badge>
              </div>
              <p className="flex-1 text-[11px] font-bold leading-5 text-[#5c6e97]">
                {leadTeacherActivity
                  ? `${leadTeacherActivity.roleLabel} · 상담일지 ${leadTeacherActivity.logs.length}건 · 발송 리포트 ${leadTeacherActivity.sentReports.length}건`
                  : '최근 운영 활동 요약이 없습니다. 계정 관리에서 현재 계정을 바로 확인할 수 있습니다.'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-fit rounded-full border-[#D7E4FF] px-3 text-[10px] font-black text-[#14295F] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF7A16]/24 hover:text-[#C95A08]"
                onClick={() => setIsTeacherManagementDialogOpen(true)}
              >
                계정 관리
              </Button>
            </div>

            {/* OpenClaw 상태 카드 */}
            <div className="admin-card-lift flex h-full flex-col gap-3 rounded-[1.5rem] border border-[#FFD7BA] bg-[linear-gradient(180deg,#FFF8F2_0%,#FFFFFF_100%)] px-4 py-4 shadow-[0_14px_24px_-24px_rgba(255,122,22,0.2)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-[0.7rem] bg-[#FF7A16]/10">
                      <OpenClawStatusIcon className={cn('h-3.5 w-3.5', openClawStatusMeta.iconClassName)} />
                    </span>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#C95A08]">OpenClaw</p>
                  </div>
                  <p className="mt-2 text-sm font-black text-[#14295F]">{openClawStatusMeta.description}</p>
                </div>
                <Badge className={cn('rounded-full border px-2.5 py-1 text-[10px] font-black', openClawStatusMeta.badgeClass)}>
                  {openClawStatusMeta.label}
                </Badge>
              </div>
              <p className="flex-1 text-[11px] font-bold leading-5 text-[#5c6e97]">
                최근 성공 {openClawLastExportLabel} · 최근 요청 {openClawLastRequestedLabel}
              </p>
              <Button
                type="button"
                className="h-9 rounded-full bg-[#14295F] text-[11px] font-black text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#10224C]"
                disabled={isOpenClawActionDisabled}
                onClick={handleGenerateOpenClawSnapshot}
              >
                {isOpenClawBusy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    생성 중
                  </>
                ) : (
                  '스냅샷 생성'
                )}
              </Button>
            </div>
          </div>
        </div>
      </motion.section>
    );
  }

  return (
    <div className={cn('mx-auto flex w-full max-w-[1520px] flex-col gap-6', isMobile ? 'px-1 pb-8' : 'px-4 py-6')}>
      <AdminWorkbenchCommandBar
        eyebrow="센터 운영"
        title="센터관리자 운영실"
        variant="adminStudio"
        quickActions={workbenchQuickActions}
        selectValue={selectedClass}
        onSelectChange={setSelectedClass}
        selectOptions={classFilterOptions}
        selectLabel="운영 범위"
        className="top-3"
      >
        <Badge className="h-8 rounded-full border-none bg-white/12 px-3.5 text-[10px] font-black text-white">
          {selectedClass === 'all' ? '센터 전체' : selectedClass}
        </Badge>
        <Badge className="h-8 rounded-full border-none bg-white px-3.5 text-[10px] font-black text-[#14295F]">
          동기화 {liveSyncLabel}
        </Badge>
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsControlAlertsDialogOpen(true)}
          className="h-8 rounded-full border-none bg-[#FF7A16] px-3.5 text-[10px] font-black text-white shadow-none transition-[transform,background-color,box-shadow] hover:-translate-y-0.5 hover:bg-[#FF8A31] hover:shadow-[0_14px_24px_-20px_rgba(255,122,22,0.92)]"
        >
          긴급 흐름 {totalControlAlerts}건
        </Button>
      </AdminWorkbenchCommandBar>

      {hasMetricsReady ? (
        <>
          {renderHomeHeroSection()}
          {renderAttendanceDashboardSection()}
          {renderHomeInsightsSection()}

          <Dialog
            open={isTodayPointsDialogOpen}
            onOpenChange={(open) => {
              setIsTodayPointsDialogOpen(open);
              if (!open) setExpandedPointHistoryDateKey(null);
            }}
          >
            <DialogContent motionPreset="dashboard-premium" className={cn(studioDialogContentClassName, 'sm:max-w-3xl')}>
              <div className={studioDialogHeaderClassName}>
                <DialogHeader className="text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-none bg-white/18 px-2.5 py-1 text-[10px] font-black text-white">포인트 지급 현황</Badge>
                    <Badge className="border-none bg-white px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                      {selectedClass === 'all' ? '센터 전체' : selectedClass}
                    </Badge>
                    <Badge className="border-none bg-[#FF7A16] px-2.5 py-1 text-[10px] font-black text-white">
                      지급 학생 {selectedPointHistoryData.summary.earners}명
                    </Badge>
                  </div>
                  <DialogTitle className="text-2xl font-black tracking-tight">
                    {selectedPointHistoryData.headlineLabel} 총 {formatPointsInPt(selectedPointHistoryData.summary.totalPoints)} 지급
                  </DialogTitle>
                  <DialogDescription className="text-sm font-medium text-white/76">
                    상자 {formatPointsInPt(selectedPointHistoryData.summary.studyBoxPoints)} · 랭킹 {formatPointsInPt(selectedPointHistoryData.summary.rankPoints)}
                    {selectedPointHistoryData.summary.otherPoints > 0 ? ` · 이전 기록 ${formatPointsInPt(selectedPointHistoryData.summary.otherPoints)}` : ''}
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="max-h-[68vh] overflow-y-auto bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)] px-5 py-5">
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  {POINT_HISTORY_WINDOW_ORDER.map((windowKey) => {
                    const dataset = pointHistoryByWindow[windowKey];
                    const isSelected = selectedPointHistoryWindow === windowKey;

                    return (
                      <button
                        key={windowKey}
                        type="button"
                        onClick={() => {
                          setSelectedPointHistoryWindow(windowKey);
                          setExpandedPointHistoryDateKey(null);
                        }}
                        className={cn(
                          'rounded-[1.35rem] border px-4 py-4 text-left shadow-[0_18px_32px_-28px_rgba(20,41,95,0.16)] transition-colors',
                          isSelected ? 'border-[#FFD7BA] bg-[#FFF8F2]' : 'border-[#DCE7FF] bg-white hover:bg-[#F7FAFF]'
                        )}
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">{dataset.tabLabel}</p>
                        <p className="admin-kpi-number mt-2 text-[1.45rem] text-[#14295F]">{formatPointsInPt(dataset.summary.totalPoints)}</p>
                        <p className="mt-2 text-xs font-bold text-[#5c6e97]">지급 학생 {dataset.summary.earners}명</p>
                        <p className="mt-1 text-[11px] font-semibold text-[#7A88A8]">
                          상자 {formatPointsInPt(dataset.summary.studyBoxPoints)} · 랭킹 {formatPointsInPt(dataset.summary.rankPoints)}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="mb-4 rounded-[1.6rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_32px_-28px_rgba(20,41,95,0.16)]">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EEF4FF] pb-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#5c6e97]">일자별 배부 내역</p>
                      <p className="mt-1 text-sm font-black text-[#14295F]">
                        {selectedPointHistoryData.headlineLabel} 일자별 학생 포인트
                      </p>
                    </div>
                    <Badge className="border-none bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-700">
                      {selectedPointHistoryData.dailyRows.length}일 기록
                    </Badge>
                  </div>

                  {selectedPointHistoryData.dailyRows.length === 0 ? (
                    <div className="mt-3 rounded-[1.25rem] border border-dashed border-[#DCE7FF] bg-[#F8FBFF] px-4 py-6 text-center text-xs font-bold text-[#6E7EA3]">
                      선택한 기간에 학생별 포인트 배부 기록이 없습니다.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {selectedPointHistoryData.dailyRows.map((day) => {
                        const isExpanded = expandedPointHistoryDateKey === day.dateKey;
                        const topGrants = day.grants.slice(0, 3);

                        return (
                          <div key={day.dateKey} className="rounded-[1.3rem] border border-[#EEF4FF] bg-[#F8FBFF] p-3">
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              onClick={() => setExpandedPointHistoryDateKey((current) => (current === day.dateKey ? null : day.dateKey))}
                              className="flex w-full flex-wrap items-center justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2554D7] focus-visible:ring-offset-2"
                            >
                              <div>
                                <p className="text-sm font-black text-[#14295F]">{day.dateKey}</p>
                                <p className="mt-1 text-[11px] font-bold text-[#6E7EA3]">
                                  지급 학생 {day.earners}명 · 클릭하면 학생별 전체 내역
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <Badge className="border-none bg-[#14295F] px-3 py-1 text-[11px] font-black text-white">
                                  {formatPointsInPt(day.totalPoints)}
                                </Badge>
                                <ChevronRight className={cn('h-4 w-4 text-[#8FA5CF] transition-transform', isExpanded && 'rotate-90')} />
                              </div>
                            </button>

                            <div className="mt-3 grid gap-2">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6E7EA3]">그날 포인트 TOP 3</p>
                              {topGrants.map((grant, index) => (
                                <div
                                  key={`top-${grant.key}`}
                                  className="flex items-center justify-between gap-3 rounded-[1rem] border border-[#E4ECFF] bg-white px-3 py-2.5"
                                >
                                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <Badge className={cn('h-5 rounded-full border-none px-2 text-[10px] font-black', index === 0 ? 'bg-[#FF7A16] text-white' : 'bg-[#EEF4FF] text-[#2554D7]')}>
                                      {index + 1}위
                                    </Badge>
                                    <p className="truncate text-sm font-black text-[#14295F]">{grant.studentName}</p>
                                    <Badge className="h-5 rounded-full border-none bg-[#EEF4FF] px-2 text-[10px] font-black text-[#2554D7]">
                                      {grant.className}
                                    </Badge>
                                  </div>
                                  <p className="shrink-0 text-sm font-black text-emerald-700">{formatPointsInPt(grant.totalPoints)}</p>
                                </div>
                              ))}
                            </div>

                            {isExpanded ? (
                              <div className="mt-3 grid gap-2 border-t border-[#E4ECFF] pt-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6E7EA3]">학생별 전체 상세</p>
                                {day.grants.map((grant) => (
                                  <div
                                    key={grant.key}
                                    className="flex items-start justify-between gap-3 rounded-[1rem] border border-[#E4ECFF] bg-white px-3 py-2.5"
                                  >
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="truncate text-sm font-black text-[#14295F]">{grant.studentName}</p>
                                        <Badge className="h-5 rounded-full border-none bg-[#EEF4FF] px-2 text-[10px] font-black text-[#2554D7]">
                                          {grant.className}
                                        </Badge>
                                      </div>
                                      <p className="mt-1 truncate text-[11px] font-bold text-[#6E7EA3]">{grant.detail}</p>
                                    </div>
                                    <p className="shrink-0 text-sm font-black text-emerald-700">{formatPointsInPt(grant.totalPoints)}</p>
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

                <div className="rounded-[1.35rem] border border-[#DCE7FF] bg-white px-4 py-3 text-xs font-bold leading-5 text-[#5c6e97]">
                  학생별 전체 내역은 위 일자 카드를 눌렀을 때만 펼쳐집니다. 기본 화면에는 일자별 합계와 그날 포인트 TOP 3만 표시합니다.
                </div>
              </div>
              <DialogFooter className="border-t border-[#DCE7FF] bg-white px-5 py-4">
                <DialogClose asChild>
                  <Button type="button" className="h-11 rounded-xl bg-[#14295F] px-5 font-black text-white hover:bg-[#10224C]">
                    닫기
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isPointBoostDialogOpen} onOpenChange={setIsPointBoostDialogOpen}>
            <DialogContent motionPreset="dashboard-premium" className={cn(studioDialogContentClassName, 'sm:max-w-3xl')}>
              <div className={studioDialogHeaderClassName}>
                <DialogHeader className="text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-none bg-white/18 px-2.5 py-1 text-[10px] font-black text-white">포인트 부스트</Badge>
                    <Badge className="border-none bg-white px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                      진행중 {pointBoostOverview.active.length}개
                    </Badge>
                    <Badge className="border-none bg-white px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                      예정 {pointBoostOverview.upcoming.length}개
                    </Badge>
                  </div>
                  <DialogTitle className="text-2xl font-black tracking-tight">포인트 부스트 운영</DialogTitle>
                  <DialogDescription className="text-sm font-medium text-white/76">
                    하루형 또는 시간형 이벤트를 예약해 두고, 겹치지 않는 범위에서 생성하거나 취소할 수 있습니다.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="max-h-[72vh] overflow-y-auto bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)] px-5 py-5">
                <div className="rounded-[1.55rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_34px_-30px_rgba(20,41,95,0.18)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className={studioSectionEyebrowClassName}>새 부스트 생성</p>
                      <p className="mt-1 text-base font-black text-[#14295F]">예약 또는 당일 부스트 열기</p>
                    </div>
                    <Badge className="rounded-full border-none bg-[#FFF2E8] px-2.5 py-1 text-[10px] font-black text-[#C95A08]">
                      상자 달성 시각 기준 적용
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.14em] text-[#5c6e97]">유형</Label>
                      <Select value={pointBoostModeDraft} onValueChange={(value: 'day' | 'window') => setPointBoostModeDraft(value)}>
                        <SelectTrigger className="h-11 rounded-xl border-[#DCE7FF] font-bold text-[#14295F]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">하루 전체</SelectItem>
                          <SelectItem value="window">시간 구간</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.14em] text-[#5c6e97]">배율</Label>
                      <Input
                        type="number"
                        min="1.1"
                        step="0.1"
                        value={pointBoostMultiplierDraft}
                        onChange={(event) => setPointBoostMultiplierDraft(event.target.value)}
                        className="h-11 rounded-xl border-[#DCE7FF] font-bold text-[#14295F]"
                        placeholder="2"
                      />
                    </div>
                  </div>
                  {pointBoostModeDraft === 'day' ? (
                    <div className="mt-3 space-y-2">
                      <Label className="text-[11px] font-black uppercase tracking-[0.14em] text-[#5c6e97]">적용 날짜</Label>
                      <Input
                        type="date"
                        value={pointBoostDateDraft}
                        onChange={(event) => setPointBoostDateDraft(event.target.value)}
                        className="h-11 rounded-xl border-[#DCE7FF] font-bold text-[#14295F]"
                      />
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-[11px] font-black uppercase tracking-[0.14em] text-[#5c6e97]">시작</Label>
                        <Input
                          type="datetime-local"
                          value={pointBoostStartDraft}
                          onChange={(event) => setPointBoostStartDraft(event.target.value)}
                          className="h-11 rounded-xl border-[#DCE7FF] font-bold text-[#14295F]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] font-black uppercase tracking-[0.14em] text-[#5c6e97]">종료</Label>
                        <Input
                          type="datetime-local"
                          value={pointBoostEndDraft}
                          onChange={(event) => setPointBoostEndDraft(event.target.value)}
                          className="h-11 rounded-xl border-[#DCE7FF] font-bold text-[#14295F]"
                        />
                      </div>
                    </div>
                  )}
                  <div className="mt-3 space-y-2">
                    <Label className="text-[11px] font-black uppercase tracking-[0.14em] text-[#5c6e97]">학생 팝업 메시지</Label>
                    <Textarea
                      value={pointBoostMessageDraft}
                      onChange={(event) => setPointBoostMessageDraft(event.target.value.slice(0, 160))}
                      className="min-h-[110px] rounded-2xl border-[#DCE7FF] font-semibold text-[#14295F] placeholder:text-[#7A88A8]"
                      placeholder={buildDefaultPointBoostMessage(Number(pointBoostMultiplierDraft) || 2)}
                    />
                    <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-[#7A88A8]">
                      <p>비워두면 기본 안내 문구가 자동으로 나갑니다.</p>
                      <p>{pointBoostMessageDraft.trim().length}/160</p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      onClick={() => void handleCreatePointBoost()}
                      disabled={isCreatingPointBoost}
                      className="h-11 rounded-xl bg-[#14295F] px-5 font-black text-white hover:bg-[#10224C]"
                    >
                      {isCreatingPointBoost ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      부스트 생성
                    </Button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <section className="rounded-[1.55rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_34px_-30px_rgba(20,41,95,0.18)]">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className={studioSectionEyebrowClassName}>활성</p>
                        <p className="mt-1 text-sm font-black text-[#14295F]">진행중 이벤트</p>
                      </div>
                      <Badge className="rounded-full border-none bg-[#FFF2E8] px-2.5 py-1 text-[10px] font-black text-[#C95A08]">
                        {pointBoostOverview.active.length}개
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-3">
                      {pointBoostOverview.active.length === 0 ? (
                        <div className="rounded-[1.2rem] border border-dashed border-[#DCE7FF] bg-[#F7FAFF] px-4 py-8 text-center text-xs font-bold text-[#5c6e97]">
                          지금 진행중인 부스트가 없습니다.
                        </div>
                      ) : pointBoostOverview.active.map((event) => (
                        <div key={event.id} className="rounded-[1.2rem] border border-[#FFD7BA] bg-[#FFF8F2] px-3.5 py-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="h-6 rounded-full border-none bg-[#FF7A16] px-2.5 text-[10px] font-black text-white">진행중</Badge>
                                <Badge className="h-6 rounded-full border-none bg-white px-2.5 text-[10px] font-black text-[#C95A08]">{event.multiplierLabel}</Badge>
                              </div>
                              <p className="mt-3 text-sm font-black text-[#14295F]">{event.label}</p>
                              <p className="mt-2 whitespace-pre-line text-[11px] font-semibold leading-5 text-[#5c6e97]">{event.message}</p>
                              <p className="mt-1 text-[11px] font-bold text-[#5c6e97]">생성 {formatDashboardTrackTime(event.createdAt)}</p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={cancellingPointBoostId === event.id}
                              onClick={() => void handleCancelPointBoost(event.id)}
                              className="h-8 rounded-full border-[#FFD7BA] bg-white px-3 text-[10px] font-black text-[#C95A08] hover:bg-[#FFF2E8]"
                            >
                              {cancellingPointBoostId === event.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '취소'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-[1.55rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_34px_-30px_rgba(20,41,95,0.18)]">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className={studioSectionEyebrowClassName}>예정</p>
                        <p className="mt-1 text-sm font-black text-[#14295F]">예약 이벤트</p>
                      </div>
                      <Badge className="rounded-full border-none bg-[#EEF4FF] px-2.5 py-1 text-[10px] font-black text-[#2554D7]">
                        {pointBoostOverview.upcoming.length}개
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-3">
                      {pointBoostOverview.upcoming.length === 0 ? (
                        <div className="rounded-[1.2rem] border border-dashed border-[#DCE7FF] bg-[#F7FAFF] px-4 py-8 text-center text-xs font-bold text-[#5c6e97]">
                          예정된 부스트가 없습니다.
                        </div>
                      ) : pointBoostOverview.upcoming.map((event) => (
                        <div key={event.id} className="rounded-[1.2rem] border border-[#DCE7FF] bg-[#F7FAFF] px-3.5 py-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black text-[#2554D7]">예정</Badge>
                                <Badge className="h-6 rounded-full border-none bg-white px-2.5 text-[10px] font-black text-[#14295F]">{event.multiplierLabel}</Badge>
                              </div>
                              <p className="mt-3 text-sm font-black text-[#14295F]">{event.label}</p>
                              <p className="mt-2 whitespace-pre-line text-[11px] font-semibold leading-5 text-[#5c6e97]">{event.message}</p>
                              <p className="mt-1 text-[11px] font-bold text-[#5c6e97]">생성 {formatDashboardTrackTime(event.createdAt)}</p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={cancellingPointBoostId === event.id}
                              onClick={() => void handleCancelPointBoost(event.id)}
                              className="h-8 rounded-full border-[#DCE7FF] bg-white px-3 text-[10px] font-black text-[#14295F]"
                            >
                              {cancellingPointBoostId === event.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '취소'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-[1.55rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_34px_-30px_rgba(20,41,95,0.18)]">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className={studioSectionEyebrowClassName}>지난 기록</p>
                        <p className="mt-1 text-sm font-black text-[#14295F]">종료·취소 이벤트</p>
                      </div>
                      <Badge className="rounded-full border-none bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-700">
                        {pointBoostOverview.history.length}개
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-3">
                      {pointBoostOverview.history.length === 0 ? (
                        <div className="rounded-[1.2rem] border border-dashed border-[#DCE7FF] bg-[#F7FAFF] px-4 py-8 text-center text-xs font-bold text-[#5c6e97]">
                          아직 지난 이벤트 기록이 없습니다.
                        </div>
                      ) : pointBoostOverview.history.map((event) => (
                        <div key={event.id} className="rounded-[1.2rem] border border-[#DCE7FF] bg-white px-3.5 py-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={cn(
                                  'h-6 rounded-full border-none px-2.5 text-[10px] font-black',
                                  event.cancelledAtMs > 0 ? 'bg-slate-100 text-slate-700' : 'bg-[#EEF4FF] text-[#2554D7]'
                                )}>
                                  {event.cancelledAtMs > 0 ? '취소됨' : '종료'}
                                </Badge>
                                <Badge className="h-6 rounded-full border-none bg-white px-2.5 text-[10px] font-black text-[#14295F]">{event.multiplierLabel}</Badge>
                              </div>
                              <p className="mt-3 text-sm font-black text-[#14295F]">{event.label}</p>
                              <p className="mt-2 whitespace-pre-line text-[11px] font-semibold leading-5 text-[#5c6e97]">{event.message}</p>
                              <p className="mt-1 text-[11px] font-bold text-[#5c6e97]">
                                {event.cancelledAtMs > 0 ? `취소 ${formatDashboardTrackTime(event.cancelledAt)}` : `종료 ${formatDashboardTrackTime(event.endAt)}`}
                              </p>
                            </div>
                            <History className="mt-1 h-4 w-4 text-[#5c6e97]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
              <DialogFooter className="border-t border-[#DCE7FF] bg-white px-5 py-4">
                <DialogClose asChild>
                  <Button type="button" className="h-11 rounded-xl bg-[#14295F] px-5 font-black text-white hover:bg-[#10224C]">
                    닫기
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet open={isOperationsMemoOpen} onOpenChange={setIsOperationsMemoOpen}>
            <SheetContent
              side="right"
              motionPreset="dashboard-premium"
              className="w-[96vw] max-w-[96vw] border-none bg-[linear-gradient(180deg,#F7FAFF_0%,#FFFFFF_100%)] p-0 sm:max-w-xl"
            >
              <div className={cn(studioDialogHeaderClassName, 'border-b border-white/10 px-5 py-5')}>
                <SheetHeader className="gap-2 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-none bg-white/18 px-2.5 py-1 text-[10px] font-black text-white">운영 메모</Badge>
                    <Badge className="border-none bg-white px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                      {selectedClass === 'all' ? '센터 전체' : selectedClass}
                    </Badge>
                  </div>
                  <SheetTitle className="text-[1.8rem] font-black tracking-tight text-white">
                    오늘 바로 확인할 항목
                  </SheetTitle>
                  <SheetDescription className="text-sm font-bold leading-6 text-white/76">
                    홈에서는 한 줄만 보이고, 전체 우선순위와 자주 여는 화면은 이 드로어에서 확인합니다.
                  </SheetDescription>
                </SheetHeader>
              </div>
              <div className="flex h-[calc(100dvh-8.5rem)] flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-5">
                <div className="space-y-3">
                  {todayActionQueue.map((item) => {
                    const PriorityIcon = item.icon;
                    return (
                      <div key={item.key} className="rounded-[1.55rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_34px_-30px_rgba(20,41,95,0.18)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn('inline-flex size-8 items-center justify-center rounded-2xl', item.toneClass)}>
                                <PriorityIcon className="h-4 w-4" />
                              </span>
                              <p className="text-sm font-black text-[#14295F]">{item.title}</p>
                            </div>
                            <p className="mt-2 text-[12px] font-bold leading-6 text-[#5c6e97]">{item.detail}</p>
                          </div>
                          {item.href && !['intervention', 'attendance', 'away', 'guardian'].includes(item.key) ? (
                            <Button asChild type="button" size="sm" className="h-8 rounded-full bg-[#14295F] px-3 text-[10px] font-black text-white hover:bg-[#10224C]">
                              <Link href={item.href}>{item.actionLabel}</Link>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-full border-[#DCE7FF] bg-white px-3 text-[10px] font-black text-[#14295F] hover:border-[#FF7A16]/24 hover:text-[#C95A08]"
                              onClick={() => {
                                setIsOperationsMemoOpen(false);
                                handleHomePriorityAction(item);
                              }}
                            >
                              {item.actionLabel}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-[1.55rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_34px_-30px_rgba(20,41,95,0.18)]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={studioSectionEyebrowClassName}>빠른 이동</p>
                      <p className="mt-1 text-sm font-black text-[#14295F]">자주 여는 운영 화면</p>
                    </div>
                    <Badge className="rounded-full border-none bg-[#EEF4FF] px-2.5 py-1 text-[10px] font-black text-[#2554D7]">
                      {quickActionLinks.length}개
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {quickActionLinks.map((item) => {
                      const QuickIcon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex items-center justify-between rounded-[1.15rem] border border-[#DCE7FF] bg-[#F7FAFF] px-3 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF7A16]/24 hover:bg-white"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="inline-flex size-8 items-center justify-center rounded-[0.9rem] bg-[#14295F] text-white">
                              <QuickIcon className="h-4 w-4" />
                            </span>
                            <div>
                              <p className="text-sm font-black text-[#14295F]">{item.label}</p>
                              <p className="text-[10px] font-bold text-[#5c6e97]">{item.description}</p>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-[#5c6e97]" />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Sheet open={isImmediateInterventionSheetOpen} onOpenChange={setIsImmediateInterventionSheetOpen}>
            <SheetContent
              side="right"
              motionPreset="dashboard-premium"
              className="w-[96vw] max-w-[96vw] border-none bg-[linear-gradient(180deg,#FFF8F2_0%,#FFFFFF_100%)] p-0 sm:max-w-xl"
            >
              <div className={cn(studioDialogHeaderClassName, 'border-b border-white/10 px-5 py-5')}>
                <SheetHeader className="gap-2 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-none bg-white/18 px-2.5 py-1 text-[10px] font-black text-white">즉시 개입 학생</Badge>
                    <Badge className="border-none bg-[#FF7A16] px-2.5 py-1 text-[10px] font-black text-white">
                      {urgentInterventionStudents.length}명
                    </Badge>
                  </div>
                  <SheetTitle className="text-[1.8rem] font-black tracking-tight text-white">
                    우선순위 전체 보기
                  </SheetTitle>
                  <SheetDescription className="text-sm font-bold leading-6 text-white/76">
                    홈에서는 상위 3명만 보이고, 전체 개입 대상과 이유는 여기서 확인합니다.
                  </SheetDescription>
                </SheetHeader>
              </div>
              <div className="flex h-[calc(100dvh-8.5rem)] flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-5">
                {urgentInterventionStudents.length === 0 ? (
                  <div className="rounded-[1.7rem] border border-dashed border-[#DCE7FF] bg-white px-6 py-12 text-center text-sm font-bold text-[#5c6e97]">
                    현재 즉시 개입 대상이 없습니다.
                  </div>
                ) : (
                  urgentInterventionStudents.map((signal, index) => {
                    const roomLabel = signal.roomId ? roomNameById.get(signal.roomId) || signal.roomId : '미배정';
                    return (
                      <button
                        key={`${signal.studentId}-${signal.seatId}`}
                        type="button"
                        onClick={() => handleImmediateStudentSelect(signal.studentId)}
                        className={cn(
                          'rounded-[1.55rem] border px-4 py-4 text-left transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:bg-white',
                          index === 0 ? 'border-[#FFD7BA] bg-[#FFF8F2] hover:border-[#FF7A16]/28' : 'border-[#DCE7FF] bg-white hover:border-[#FF7A16]/20'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={cn(
                                'h-6 rounded-full border-none px-2.5 text-[10px] font-black',
                                index === 0 ? 'bg-[#FF7A16] text-white' : 'bg-[#EEF4FF] text-[#2554D7]'
                              )}>
                                {index + 1}순위
                              </Badge>
                              {signal.className ? (
                                <Badge className="h-6 rounded-full border-none bg-[#F7FAFF] px-2.5 text-[10px] font-black text-[#14295F]">
                                  {signal.className}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-3 text-base font-black text-[#14295F]">{signal.studentName}</p>
                            <p className="mt-1 text-[11px] font-bold leading-5 text-[#5c6e97]">
                              {roomLabel} · {signal.attendanceStatus}
                            </p>
                            <p className="mt-1 text-[12px] font-black leading-6 text-[#C95A08]">{signal.topReason}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">위험 점수</p>
                            <p className="dashboard-number mt-2 text-[1.45rem] text-[#14295F]">{signal.compositeHealth}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </SheetContent>
          </Sheet>

          <Dialog open={isControlAlertsDialogOpen} onOpenChange={setIsControlAlertsDialogOpen}>
            <DialogContent motionPreset="dashboard-premium" className={cn(studioDialogContentClassName, 'max-h-[92vh] flex flex-col sm:max-w-3xl')}>
              <div className={cn(studioDialogHeaderClassName, 'flex-shrink-0')}>
                <DialogHeader className="space-y-3 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-none bg-white/18 px-2.5 py-1 text-[10px] font-black text-white">긴급 흐름</Badge>
                    <Badge className="border-none bg-[#FF7A16] px-2.5 py-1 text-[10px] font-black text-white">
                      {totalControlAlerts}건
                    </Badge>
                    {selectedClass !== 'all' ? (
                      <Badge className="border-none bg-white px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                        {selectedClass}
                      </Badge>
                    ) : null}
                  </div>
                  <DialogTitle className="text-2xl font-black tracking-tight">긴급 흐름 상세</DialogTitle>
                  <DialogDescription className="text-sm font-medium text-white/75">
                    현재 집계된 미입실·지각, 장기 외출, 즉시 개입 학생을 한 번에 확인할 수 있습니다.
                  </DialogDescription>
                  <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                    <div className="rounded-[1.35rem] border border-white/10 bg-white/10 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">미입실·지각</p>
                      <p className="dashboard-number mt-2 text-[1.6rem] text-white">{lateOrAbsentAlertRows.length}</p>
                    </div>
                    <div className="rounded-[1.35rem] border border-white/10 bg-white/10 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">장기 외출</p>
                      <p className="dashboard-number mt-2 text-[1.6rem] text-white">{longAwayAlertRows.length}</p>
                    </div>
                    <div className="rounded-[1.35rem] border border-[#FFB677]/28 bg-[#FF7A16]/18 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/68">즉시 개입</p>
                      <p className="dashboard-number mt-2 text-[1.6rem] text-white">{urgentInterventionStudents.length}</p>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)] px-5 py-5">
                <div className="space-y-4">
                  <section className="rounded-[1.8rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_36px_-30px_rgba(20,41,95,0.18)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={studioSectionEyebrowClassName}>미입실·지각</p>
                        <h3 className="mt-2 text-lg font-black tracking-tight text-[#14295F]">출결 확인이 필요한 학생</h3>
                        <p className="mt-1 text-xs font-bold leading-5 text-[#5c6e97]">
                          오늘 입실 증거가 없거나 지각으로 기록된 학생입니다.
                        </p>
                      </div>
                      <Badge className="h-7 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black text-[#2554D7]">
                        {lateOrAbsentAlertRows.length}명
                      </Badge>
                    </div>

                    {lateOrAbsentAlertRows.length === 0 ? (
                      <div className="mt-4 rounded-[1.45rem] border border-dashed border-[#DCE7FF] bg-[#F7FAFF] px-5 py-8 text-center text-sm font-bold text-[#5c6e97]">
                        현재 미입실·지각 대상이 없습니다.
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3">
                        {lateOrAbsentAlertRows.map((item) => (
                          <div key={item.key} className="rounded-[1.4rem] border border-[#DCE7FF] bg-[#F7FAFF] px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className="h-6 rounded-full border-none bg-white px-2.5 text-[10px] font-black text-[#C95A08]">
                                    {item.issueLabel}
                                  </Badge>
                                  {item.className ? (
                                    <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black text-[#14295F]">
                                      {item.className}
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="mt-3 text-base font-black text-[#14295F]">{item.studentName}</p>
                                <p className="mt-1 text-[12px] font-bold leading-6 text-[#5c6e97]">{item.detailLabel}</p>
                              </div>
                              <p className="text-right text-[11px] font-black text-[#5c6e97]">{item.roomLabel}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-[1.8rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_36px_-30px_rgba(20,41,95,0.18)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={studioSectionEyebrowClassName}>장기 외출</p>
                        <h3 className="mt-2 text-lg font-black tracking-tight text-[#14295F]">복귀 확인이 필요한 학생</h3>
                        <p className="mt-1 text-xs font-bold leading-5 text-[#5c6e97]">
                          외출 또는 휴식이 20분 이상 이어진 학생입니다.
                        </p>
                      </div>
                      <Badge className="h-7 rounded-full border-none bg-[#FFF1E6] px-2.5 text-[10px] font-black text-[#C95A08]">
                        {longAwayAlertRows.length}명
                      </Badge>
                    </div>

                    {longAwayAlertRows.length === 0 ? (
                      <div className="mt-4 rounded-[1.45rem] border border-dashed border-[#DCE7FF] bg-[#F7FAFF] px-5 py-8 text-center text-sm font-bold text-[#5c6e97]">
                        현재 장기 외출 대상이 없습니다.
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3">
                        {longAwayAlertRows.map((item) => (
                          <div key={item.key} className="rounded-[1.4rem] border border-[#DCE7FF] bg-[#FFF8F2] px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className="h-6 rounded-full border-none bg-white px-2.5 text-[10px] font-black text-[#C95A08]">
                                    외출 {item.awayMinutes}분
                                  </Badge>
                                  {item.className ? (
                                    <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black text-[#14295F]">
                                      {item.className}
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="mt-3 text-base font-black text-[#14295F]">{item.studentName}</p>
                                <p className="mt-1 text-[12px] font-bold leading-6 text-[#5c6e97]">{item.detailLabel}</p>
                              </div>
                              <p className="text-right text-[11px] font-black text-[#5c6e97]">{item.roomLabel}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-[1.8rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_36px_-30px_rgba(20,41,95,0.18)]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={studioSectionEyebrowClassName}>즉시 개입</p>
                        <h3 className="mt-2 text-lg font-black tracking-tight text-[#14295F]">면담 또는 집중 개입 우선 학생</h3>
                        <p className="mt-1 text-xs font-bold leading-5 text-[#5c6e97]">
                          좌석 히트맵 기준으로 우선순위가 높은 학생입니다.
                        </p>
                      </div>
                      <Badge className="h-7 rounded-full border-none bg-[#FFE7D3] px-2.5 text-[10px] font-black text-[#C95A08]">
                        {urgentInterventionStudents.length}명
                      </Badge>
                    </div>

                    {urgentInterventionStudents.length === 0 ? (
                      <div className="mt-4 rounded-[1.45rem] border border-dashed border-[#DCE7FF] bg-[#F7FAFF] px-5 py-8 text-center text-sm font-bold text-[#5c6e97]">
                        현재 즉시 개입 대상이 없습니다.
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3">
                        {urgentInterventionStudents.map((signal, index) => {
                          const roomName = signal.roomId ? roomNameById.get(signal.roomId) || signal.roomId : '미배정';
                          const roomLabel = signal.roomSeatNo ? `${roomName} ${signal.roomSeatNo}번` : roomName;
                          return (
                            <div
                              key={`${signal.studentId}-${signal.seatId}`}
                              className={cn(
                                'rounded-[1.4rem] border px-4 py-4',
                                index === 0 ? 'border-[#FFD7BA] bg-[#FFF8F2]' : 'border-[#DCE7FF] bg-[#F7FAFF]'
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge className={cn(
                                      'h-6 rounded-full border-none px-2.5 text-[10px] font-black',
                                      index === 0 ? 'bg-[#FF7A16] text-white' : 'bg-[#EEF4FF] text-[#2554D7]'
                                    )}>
                                      {index + 1}순위
                                    </Badge>
                                    {signal.className ? (
                                      <Badge className="h-6 rounded-full border-none bg-white px-2.5 text-[10px] font-black text-[#14295F]">
                                        {signal.className}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="mt-3 text-base font-black text-[#14295F]">{signal.studentName}</p>
                                  <p className="mt-1 text-[11px] font-bold leading-5 text-[#5c6e97]">
                                    {roomLabel} · {signal.attendanceStatus}
                                  </p>
                                  <p className="mt-1 text-[12px] font-black leading-6 text-[#C95A08]">{signal.topReason}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">위험 점수</p>
                                  <p className="dashboard-number mt-2 text-[1.45rem] text-[#14295F]">{signal.compositeHealth}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              </div>

              <DialogFooter className="border-t border-[#DCE7FF] bg-white px-5 py-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="h-11 rounded-xl border-[#DCE7FF] px-5 font-black text-[#14295F]">
                    닫기
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isAttendancePriorityDialogOpen} onOpenChange={setIsAttendancePriorityDialogOpen}>
            <DialogContent motionPreset="dashboard-premium" className={cn(studioDialogContentClassName, 'sm:max-w-xl')}>
              <div className={studioDialogHeaderClassName}>
                <DialogHeader className="text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-none bg-white/18 px-2.5 py-1 text-[10px] font-black text-white">출결 연락 우선</Badge>
                    <Badge className="border-none bg-white px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                      {todayAttendanceContactTargets.length}명
                    </Badge>
                  </div>
                  <DialogTitle className="text-2xl font-black tracking-tight">연락이 필요한 학생</DialogTitle>
                </DialogHeader>
              </div>
              <div className="max-h-[68vh] overflow-y-auto bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)] px-5 py-5">
                {todayAttendanceContactTargets.length === 0 ? (
                  <div className="rounded-[1.6rem] border border-dashed border-[#DCE7FF] bg-white px-6 py-10 text-center text-sm font-bold text-[#5c6e97]">
                    현재 바로 연락이 필요한 출결 대상이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {todayAttendanceContactTargets.map((target, index) => (
                      <button
                        key={target.studentId}
                        type="button"
                        onClick={() => {
                          setIsAttendancePriorityDialogOpen(false);
                          openAdminAttendanceSignal(target.signal);
                        }}
                        className={cn(
                          'w-full rounded-[1.45rem] border px-4 py-4 text-left shadow-[0_18px_32px_-28px_rgba(20,41,95,0.16)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#FF7A16]/30 hover:shadow-[0_22px_36px_-28px_rgba(20,41,95,0.22)]',
                          index === 0 ? 'border-[#FFD7BA] bg-[#FFF8F2]' : 'border-[#DCE7FF] bg-white'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className={cn(
                                'h-6 rounded-full border-none px-2.5 text-[10px] font-black',
                                index === 0 ? 'bg-[#FF7A16] text-white' : 'bg-[#EEF4FF] text-[#2554D7]'
                              )}>
                                {index === 0 ? '연락 1순위' : `${index + 1}순위`}
                              </Badge>
                              <Badge className="h-6 rounded-full border-none bg-white px-2.5 text-[10px] font-black text-[#C95A08]">
                                {target.issueLabel}
                              </Badge>
                            </div>
                            <p className="mt-3 text-base font-black text-[#14295F]">{target.studentName}</p>
                            <p className="mt-1 text-[12px] font-bold leading-6 text-[#5c6e97]">{target.detailLabel}</p>
                          </div>
                          <Phone className="mt-1 h-4 w-4 text-[#C95A08]" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <DialogFooter className="border-t border-[#DCE7FF] bg-white px-5 py-4">
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="h-11 rounded-xl border-[#DCE7FF] px-5 font-black text-[#14295F]">
                    닫기
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={!!selectedAttendanceDetailSignal}
            onOpenChange={(open) => {
              if (!open) setSelectedAttendanceDetailSignal(null);
            }}
          >
            <DialogContent
              motionPreset="dashboard-premium"
              className={cn(
                studioDialogContentClassName,
                isMobile ? 'w-[calc(100vw-1rem)] rounded-[2rem]' : 'sm:max-w-xl'
              )}
            >
              {selectedAttendanceDetail ? (
                <>
                  <div className={studioDialogHeaderClassName}>
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
                        오늘 학생이 설정한 등원·하원·외출 시간과 연락처를 바로 확인합니다.
                      </DialogDescription>
                    </DialogHeader>
                  </div>

                  <div className="space-y-3 bg-[#F7FAFF] p-5">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-[#DCE7FF] bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5C6E97]">오늘 등원 예정</p>
                        <p className="mt-2 text-lg font-black text-[#14295F]">{selectedAttendanceDetail.plannedArrival}</p>
                      </div>
                      <div className="rounded-2xl border border-[#DCE7FF] bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5C6E97]">오늘 최초입실</p>
                        <p className="mt-2 text-lg font-black text-[#14295F]">{selectedAttendanceDetail.firstCheckInLabel}</p>
                      </div>
                      <div className="rounded-2xl border border-[#DCE7FF] bg-white p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5C6E97]">오늘 하원 예정</p>
                        <p className="mt-2 text-lg font-black text-[#14295F]">{selectedAttendanceDetail.plannedDeparture}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#FFD7BA] bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#C95A08]">오늘 외출/학원 시간</p>
                      <p className="mt-2 text-sm font-black leading-6 text-[#14295F]">{selectedAttendanceDetail.outingLabel}</p>
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
                        <p className="mt-1 text-[11px] font-bold text-[#6E7EA3]">
                          {selectedAttendanceDetail.studentMember?.className || selectedAttendanceDetail.student?.className || '반 정보 없음'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <DialogFooter className="border-t border-[#D7E4FF] bg-white px-5 py-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-xl border-[#DCE7FF] font-black text-[#14295F]"
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
                        openAdminAttendanceBoardFromSignal(signal);
                      }}
                    >
                      교실에서 보기
                    </Button>
                  </DialogFooter>
                </>
              ) : null}
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-40 gap-4 opacity-20">
          <Activity className="h-16 w-16 animate-pulse" />
          <p className="font-black text-xl tracking-tighter">분석 데이터를 집계하고 있습니다...</p>
        </div>
      )}
      <Dialog open={isStudyingStudentsDialogOpen} onOpenChange={setIsStudyingStudentsDialogOpen}>
        <DialogContent motionPreset="dashboard-premium" className={cn(studioDialogContentClassName, 'sm:max-w-2xl')}>
          <div className={studioDialogHeaderClassName}>
            <DialogHeader className="text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-none bg-white/18 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur">
                  실시간 공부 현황
                </Badge>
                <Badge className="border-none bg-white px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                  {selectedClass === 'all' ? '센터 전체' : selectedClass}
                </Badge>
              </div>
              <DialogTitle className="font-aggro-display text-[2rem] font-black tracking-tight">
                현재 공부중인 학생 {currentlyStudyingStudents.length}명
              </DialogTitle>
              <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
                <div className="rounded-[1.45rem] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">공부중 인원</p>
                  <p className="dashboard-number mt-2 text-[1.6rem] text-white">{currentlyStudyingStudents.length}</p>
                </div>
                <div className="rounded-[1.45rem] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">좌석 점유율</p>
                  <p className="dashboard-number mt-2 text-[1.6rem] text-white">{metrics.seatOccupancy}%</p>
                </div>
                <div className="rounded-[1.45rem] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">즉시 개입</p>
                  <p className="dashboard-number mt-2 text-[1.6rem] text-white">{urgentInterventionStudents.length}명</p>
                </div>
                <div className="rounded-[1.45rem] border border-[#FFB677]/28 bg-[#FF7A16]/18 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/68">연락 우선</p>
                  <p className="dashboard-number mt-2 text-[1.6rem] text-white">{todayAttendanceContactTargets.length}명</p>
                </div>
              </div>
            </DialogHeader>
          </div>
          <div className="max-h-[65vh] overflow-y-auto bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)] px-4 py-4 sm:px-5">
            {attendanceBoardLoading ? (
              <div className={cn(studioMetricCardClassName, 'flex min-h-[240px] items-center justify-center gap-3 text-[#5c6e97]')}>
                <Loader2 className="h-5 w-5 animate-spin text-[#14295F]" />
                <span className="text-sm font-bold">실시간 공부중 학생을 불러오는 중입니다.</span>
              </div>
            ) : currentlyStudyingStudents.length === 0 ? (
              <div className="rounded-[1.7rem] border border-dashed border-[#DCE7FF] bg-white px-6 py-10 text-center shadow-[0_16px_30px_-28px_rgba(20,41,95,0.18)]">
                <p className="text-base font-black text-[#14295F]">현재 공부중인 학생이 없습니다.</p>
                <p className="mt-2 text-sm font-medium text-[#5c6e97]">
                  잠시 후 다시 확인하거나 실시간 교실 도면에서 상태를 확인해 주세요.
                </p>
              </div>
            ) : (
              <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                {currentlyStudyingStudents.map((student) => (
                  <button
                    key={student.studentId}
                    type="button"
                    onClick={() => {
                      setIsStudyingStudentsDialogOpen(false);
                      setSelectedFocusStudentId(student.studentId);
                    }}
                    className="rounded-[1.6rem] border border-[#DCE7FF] bg-white px-4 py-4 text-left shadow-[0_18px_34px_-30px_rgba(20,41,95,0.2)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[#FF7A16]/24 hover:shadow-[0_24px_38px_-28px_rgba(20,41,95,0.24)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-black tracking-tight text-[#14295F]">
                            {student.studentName}
                          </p>
                          {student.className ? (
                            <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black text-[#2554D7]">
                              {student.className}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black text-[#2554D7]">
                            {student.roomLabel}
                          </Badge>
                          <Badge className="h-6 rounded-full border-none bg-emerald-50 px-2.5 text-[10px] font-black text-emerald-700">
                            {student.todayStudyLabel}
                          </Badge>
                          <Badge className="h-6 rounded-full border-none bg-[#FFF2E8] px-2.5 text-[10px] font-black text-[#C95A08]">
                            {student.boardLabel}
                          </Badge>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        {student.firstCheckInLabel || student.checkedAtLabel ? (
                          <p className="text-[11px] font-bold text-[#5c6e97]">
                            {buildAdminCheckInTimeLabel(student)}
                          </p>
                        ) : null}
                        <p className="mt-2 text-[11px] font-black text-[#2554D7]">학생 KPI 보기</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <DialogFooter className="border-t border-[#DCE7FF] bg-white px-5 py-4">
            <DialogClose asChild>
              <Button type="button" className="h-11 rounded-xl bg-[#14295F] px-5 font-black text-white hover:bg-[#10224C]">
                닫기
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isCounselTrackDialogOpen} onOpenChange={setIsCounselTrackDialogOpen}>
        <DialogContent
          motionPreset="dashboard-premium"
          className={cn(
            studioDialogContentClassName,
            'max-h-[94vh] flex flex-col gap-0 overflow-hidden bg-[linear-gradient(180deg,#F7FAFF_0%,#EFF4FF_100%)] p-0 sm:max-w-[1180px]'
          )}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
            <AppointmentsPageContent forceTab={counselTrackDialogTab} />
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isAnnouncementDialogOpen} onOpenChange={setIsAnnouncementDialogOpen}>
        <DialogContent motionPreset="dashboard-premium" className={cn(studioDialogContentClassName, 'sm:max-w-2xl')}>
          <div className={studioDialogHeaderClassName}>
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
          <div className="max-h-[72vh] overflow-y-auto bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)] px-5 py-5">
            <div className="grid gap-3 rounded-[1.6rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_34px_-30px_rgba(20,41,95,0.2)]">
              <Input
                value={noticeTitle}
                onChange={(event) => setNoticeTitle(event.target.value)}
                placeholder="공지 제목"
                className="h-11 rounded-xl border-[#DCE7FF] font-bold text-[#14295F] placeholder:text-[#9AA9C7]"
              />
              <Select value={noticeAudience} onValueChange={(value) => setNoticeAudience(value as 'parent' | 'student' | 'all')}>
                <SelectTrigger className="h-11 rounded-xl border-[#DCE7FF] font-bold text-[#14295F]">
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
                className="min-h-[130px] rounded-xl border-[#DCE7FF] font-bold text-[#14295F] placeholder:text-[#9AA9C7]"
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
              <p className="text-[10px] font-black uppercase tracking-widest text-[#5c6e97]">최근 등록 공지</p>
              {announcementFeed.length === 0 ? (
                <div className="rounded-[1.45rem] border border-dashed border-[#DCE7FF] bg-white px-4 py-8 text-center text-xs font-bold text-[#5c6e97]">
                  등록된 공지사항이 없습니다.
                </div>
              ) : (
                announcementFeed.slice(0, 5).map((item: any) => {
                  const createdAt = toTimestampDateSafe(item.createdAt);
                  return (
                    <div key={item.id} className="rounded-[1.35rem] border border-[#DCE7FF] bg-white px-4 py-3 shadow-[0_18px_30px_-28px_rgba(20,41,95,0.16)]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-[#14295F]">{item.title || '제목 없음'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {item.isPending ? (
                            <Badge className="h-5 rounded-full border-none bg-[#FFF2E8] px-2 text-[10px] font-black text-[#C95A08]">
                              동기화 중
                            </Badge>
                          ) : null}
                          <Badge className="h-5 rounded-full border-none bg-[#EEF4FF] px-2 text-[10px] font-black text-[#2554D7]">
                            {item.audience === 'student' ? '학생' : item.audience === 'all' ? '전체' : '학부모'}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs font-bold text-[#5c6e97]">{item.body || '내용 없음'}</p>
                      <p className="mt-1 text-[10px] font-black text-[#5c6e97]">
                        {createdAt ? format(createdAt, 'yyyy.MM.dd HH:mm') : '방금 전 등록'}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-[#DCE7FF] bg-white px-5 py-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-11 rounded-xl border-[#DCE7FF] px-5 font-black text-[#14295F]">
                닫기
              </Button>
            </DialogClose>
          </DialogFooter>
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
        <DialogContent motionPreset="dashboard-premium" className={cn(studioDialogContentClassName, 'sm:max-w-3xl')}>
          <div className={studioDialogHeaderClassName}>
            <DialogHeader className="space-y-2 text-left">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-none bg-white/18 px-2.5 py-1 text-[10px] font-black text-white">계정 관리</Badge>
                <Badge className="border-none bg-white px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                  운영 계정 {teacherRows.length}명
                </Badge>
              </div>
              <DialogTitle className="text-2xl font-black tracking-tight">운영 계정 관리</DialogTitle>
              <DialogDescription className="text-sm font-medium text-white/75">
                선생님, 센터관리자, 원장 계정의 활동을 함께 보고 선생님 계정만 삭제할 수 있습니다.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="max-h-[72vh] overflow-y-auto bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)] px-5 py-5">
            <div className="rounded-[1.6rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_34px_-30px_rgba(20,41,95,0.2)]">
              <div className={cn('grid gap-3', isMobile ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_120px_120px]')}>
                <Input
                  value={teacherSearch}
                  onChange={(event) => setTeacherSearch(event.target.value)}
                  placeholder="이름, 전화번호, 사용자번호로 검색"
                  className="h-11 rounded-xl border-[#DCE7FF] font-bold text-[#14295F] placeholder:text-[#9AA9C7]"
                />
                <div className="rounded-xl border border-[#DCE7FF] bg-[#F7FAFF] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">상담일지</p>
                  <p className="mt-1 text-lg font-black text-[#14295F]">
                    {teacherRows.reduce((sum, teacher) => sum + teacher.logs.length, 0)}건
                  </p>
                </div>
                <div className="rounded-xl border border-[#DCE7FF] bg-[#F7FAFF] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5c6e97]">발송 리포트</p>
                  <p className="mt-1 text-lg font-black text-[#14295F]">
                    {teacherRows.reduce((sum, teacher) => sum + teacher.sentReports.length, 0)}건
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[11px] font-bold text-[#5c6e97]">
                검색 결과 {filteredTeacherRows.length}명 / 전체 {teacherRows.length}명
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {filteredTeacherRows.length === 0 ? (
                <div className="rounded-[1.6rem] border border-dashed border-[#DCE7FF] bg-white px-6 py-10 text-center">
                  <p className="text-base font-black text-[#14295F]">검색 결과가 없습니다.</p>
                  <p className="mt-2 text-sm font-medium text-[#5c6e97]">이름이나 전화번호, 사용자번호를 다시 확인해 주세요.</p>
                </div>
              ) : (
                filteredTeacherRows.map((teacher) => (
                  <div key={teacher.id} className="rounded-[1.55rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_34px_-30px_rgba(20,41,95,0.18)]">
                    <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'items-start justify-between')}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-black tracking-tight text-[#14295F]">{teacher.teacherName}</p>
                          <Badge className="h-6 rounded-full border-none bg-[#14295F]/10 px-2.5 text-[10px] font-black text-[#14295F]">
                            {teacher.roleLabel}
                          </Badge>
                          <Badge className="h-6 rounded-full border-none bg-[#EEF4FF] px-2.5 text-[10px] font-black text-[#2554D7]">
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
                          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[#F7FAFF] px-2.5 text-[10px] font-black text-[#14295F]">
                            <Phone className="h-3 w-3" />
                            {teacher.phoneNumber || '전화번호 미등록'}
                          </span>
                        </div>
                        <p className="mt-3 text-[11px] font-bold text-[#5c6e97]">사용자번호 {teacher.id}</p>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-xl border-[#DCE7FF] px-3 text-xs font-black text-[#14295F]"
                          onClick={() => {
                            setIsTeacherManagementDialogOpen(false);
                            setSelectedTeacherId(teacher.id);
                          }}
                        >
                          상세 보기
                        </Button>
                        {teacher.canDelete && (
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
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-[#DCE7FF] bg-white px-5 py-4">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-11 rounded-xl border-[#DCE7FF] px-5 font-black text-[#14295F]">
                닫기
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!selectedFocusStudentId} onOpenChange={(open) => !open && setSelectedFocusStudentId(null)}>
        <DialogContent motionPreset="dashboard-premium" className={cn(studioDialogContentClassName, 'max-h-[92vh] flex flex-col sm:max-w-4xl')}>

          <div className={cn(studioDialogHeaderClassName, 'flex-shrink-0')}>
            <DialogHeader className="space-y-4 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-none bg-white/18 px-2.5 py-1 text-[10px] font-black text-white">
                      학생 집중도 KPI
                    </Badge>
                    {selectedFocusStudent?.className ? (
                      <Badge className="border-none bg-white px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                        {selectedFocusStudent.className}
                      </Badge>
                    ) : null}
                  </div>
                  <DialogTitle className="mt-3 font-aggro-display text-[2rem] font-black tracking-tight text-white">
                    {selectedFocusStudent ? `${selectedFocusStudent.name} 운영 집중도 보드` : '학생 집중도 KPI'}
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-sm font-bold leading-6 text-white/76">
                    {selectedFocusStudent
                      ? `${selectedFocusStudent.name} 학생의 집중도 추이, 계획 실행, 리듬 흐름을 한 화면에서 확인합니다.`
                      : '학생별 집중도 추이를 확인합니다.'}
                  </DialogDescription>
                </div>
                {selectedFocusKpi && (
                  <Badge className={cn('mt-1 flex-shrink-0 h-8 rounded-full px-3 text-xs font-black', selectedFocusKpi.riskStatus.badgeClass)}>
                    {selectedFocusKpi.riskStatus.label}
                  </Badge>
                )}
              </div>
              <div className={cn('grid gap-3', isMobile ? 'grid-cols-2' : 'grid-cols-4')}>
                <div className="rounded-[1.45rem] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">오늘 집중 점수</p>
                  <p className="dashboard-number mt-2 text-[1.55rem] text-white">{selectedFocusStudent?.score ?? 0}</p>
                </div>
                <div className="rounded-[1.45rem] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">오늘 성장도</p>
                  <p className="dashboard-number mt-2 text-[1.55rem] text-white">
                    {todayLearningGrowthPercent >= 0 ? '+' : ''}{todayLearningGrowthPercent}%
                  </p>
                </div>
                <div className="rounded-[1.45rem] border border-white/10 bg-white/10 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/60">7일 평균 학습</p>
                  <p className="dashboard-number mt-2 text-[1.55rem] text-white">
                    {Math.floor((selectedFocusKpi?.avgMinutes ?? 0) / 60)}h {(selectedFocusKpi?.avgMinutes ?? 0) % 60}m
                  </p>
                </div>
                <div className="rounded-[1.45rem] border border-[#FFB677]/28 bg-[#FF7A16]/18 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/68">주간 성장도</p>
                  <p className="dashboard-number mt-2 text-[1.55rem] text-white">
                    {latestWeeklyLearningGrowthPercent >= 0 ? '+' : ''}{latestWeeklyLearningGrowthPercent}%
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* ── SCROLLABLE BODY ── */}
          <div className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)]">
            <div className="bg-transparent p-5 space-y-5">

              {selectedFocusKpi && selectedFocusKpi.riskAlerts.length > 0 && (
                <div className="rounded-[1.7rem] border border-rose-200 bg-white p-4 shadow-[0_18px_34px_-30px_rgba(20,41,95,0.18)]">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <div>
                      <p className={studioSectionEyebrowClassName}>위험 신호 감지</p>
                      <p className="mt-1 text-sm font-black text-[#14295F]">오늘 먼저 확인할 리스크입니다.</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {selectedFocusKpi.riskAlerts.map((alert, idx) => (
                      <div key={idx} className="rounded-[1.2rem] border border-[#FFE1DE] bg-[#FFF8F7] px-3 py-2.5">
                        <p className="text-xs font-bold leading-5 text-[#14295F]">{alert}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <p className={studioSectionEyebrowClassName}>핵심 지표</p>
                  <p className="mt-2 text-lg font-black tracking-tight text-[#14295F]">오늘 먼저 확인할 운영 수치</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={studioMetricCardClassName}>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[1rem] bg-[#EEF4FF] text-[#2554D7]">
                        <Clock className="h-4 w-4" />
                      </span>
                      <p className={studioSectionEyebrowClassName}>오늘 학습시간</p>
                    </div>
                    <p className="dashboard-number mt-3 text-[1.8rem] text-[#14295F]">
                      {Math.floor(todayStudyMinutes / 60)}h {todayStudyMinutes % 60}m
                    </p>
                    <p className="mt-2 text-[11px] font-bold text-[#5c6e97]">
                      {selectedFocusKpi && selectedFocusKpi.avgMinutes > 0
                        ? `7일 평균 ${Math.floor(selectedFocusKpi.avgMinutes / 60)}h ${selectedFocusKpi.avgMinutes % 60}m`
                        : '학습시간 평균을 집계 중입니다.'}
                    </p>
                  </div>

                  <div className={studioMetricCardClassName}>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[1rem] bg-[#FFF2E8] text-[#C95A08]">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <p className={studioSectionEyebrowClassName}>계획 완료율</p>
                    </div>
                    <p className="dashboard-number mt-3 text-[1.8rem] text-[#14295F]">{selectedFocusStudent?.completion ?? 0}%</p>
                    <p className="mt-2 text-[11px] font-bold text-[#5c6e97]">
                      {(selectedFocusStudent?.completion ?? 0) >= 80 ? '오늘 목표를 안정적으로 따라가고 있습니다.'
                        : (selectedFocusStudent?.completion ?? 0) >= 60 ? '부분 달성 구간입니다. 마감 전 점검이 좋습니다.'
                        : '과제 수 조정과 체크인이 먼저 필요합니다.'}
                    </p>
                  </div>

                  <div className={studioMetricCardClassName}>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[1rem] bg-[#EEF4FF] text-[#2554D7]">
                        {(selectedFocusStat?.studyTimeGrowthRate ?? 0) >= 0 ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                      </span>
                      <p className={studioSectionEyebrowClassName}>오늘 학습 성장률</p>
                    </div>
                    <p className="dashboard-number mt-3 text-[1.8rem] text-[#14295F]">
                      {(selectedFocusStat?.studyTimeGrowthRate ?? 0) >= 0 ? '+' : ''}
                      {Math.round((selectedFocusStat?.studyTimeGrowthRate ?? 0) * 100)}%
                    </p>
                    <p className="mt-2 text-[11px] font-bold text-[#5c6e97]">전일 대비 학습시간 변화</p>
                  </div>

                  <div className={studioMetricCardClassName}>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[1rem] bg-[#FFF8F2] text-[#C95A08]">
                        <ShieldAlert className="h-4 w-4" />
                      </span>
                      <p className={studioSectionEyebrowClassName}>벌점 현황</p>
                    </div>
                    <p className="dashboard-number mt-3 text-[1.8rem] text-[#14295F]">{selectedFocusProgress?.penaltyPoints ?? 0}점</p>
                    <p className="mt-2 text-[11px] font-bold text-[#5c6e97]">
                      {(selectedFocusProgress?.penaltyPoints ?? 0) >= 10 ? '규정 기준치 초과로 즉시 점검이 필요합니다.'
                        : (selectedFocusProgress?.penaltyPoints ?? 0) >= 5 ? '주의 구간입니다. 오늘 누적 추이를 확인해 주세요.'
                        : '현재는 안정 구간입니다.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className={studioSectionEyebrowClassName}>집중도 KPI 그래프</p>
                  <p className="mt-2 text-lg font-black tracking-tight text-[#14295F]">학습 흐름과 리듬을 그래프로 읽는 운영 보드</p>
                </div>

                <div className={studioChartCardClassName}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className={studioSectionEyebrowClassName}>주간 학습시간 성장률</p>
                      <p className="mt-1 text-[11px] font-bold text-[#5c6e97]">막대: 주간 누적 학습분 · 선: 전주 대비 성장률</p>
                    </div>
                    {weeklyGrowthData.length > 0 && (
                      <Badge className="h-7 rounded-full border-none bg-[#EEF4FF] px-3 text-[10px] font-black text-[#14295F]">
                        이번 주 {(weeklyGrowthData[weeklyGrowthData.length - 1]?.growth ?? 0) >= 0 ? '+' : ''}{weeklyGrowthData[weeklyGrowthData.length - 1]?.growth ?? 0}%
                      </Badge>
                    )}
                  </div>
                  {trendLoading ? (
                    <div className="flex h-[160px] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#5c6e97]" /></div>
                  ) : !hasWeeklyGrowthData ? (
                    <div className="flex h-[160px] items-center justify-center text-xs font-bold text-[#5c6e97]">데이터를 수집 중입니다.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={160}>
                      <ComposedChart data={weeklyGrowthData} margin={{ top: 8, right: 44, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E4ECFA" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: 700, fill: '#5c6e97' }} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="min" tick={{ fontSize: 9, fontWeight: 700, fill: '#5c6e97' }} tickLine={false} axisLine={false} width={46} tickFormatter={(v) => formatChartMinutesAxisTick(Number(v))} />
                        <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 9, fontWeight: 700, fill: '#5c6e97' }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${Math.round(Number(v || 0))}%`} />
                        <Tooltip
                          formatter={(v: number, name: string) => name === 'totalMinutes' ? [`${Math.floor(v / 60)}h ${v % 60}m`, '주간 학습'] : [`${v >= 0 ? '+' : ''}${v}%`, '성장률']}
                          contentStyle={{ borderRadius: '14px', border: '1px solid #DCE7FF', boxShadow: '0 14px 30px rgba(20,41,95,0.12)', fontSize: '11px', fontWeight: 700, color: '#14295F' }}
                        />
                        <Bar yAxisId="min" dataKey="totalMinutes" fill="#C7D8FF" radius={[5, 5, 0, 0]} />
                        <Line yAxisId="pct" type="monotone" dataKey="growth" stroke="#FF7A16" strokeWidth={2.5} dot={{ r: 4, fill: '#FF7A16', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                  <div className="mt-2 flex items-center justify-end gap-4">
                    <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded bg-[#C7D8FF]" /><p className="text-[9px] font-bold text-[#5c6e97]">누적 학습시간</p></div>
                    <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-[#FF7A16]" /><p className="text-[9px] font-bold text-[#5c6e97]">성장률</p></div>
                  </div>
                </div>

                <div className={studioChartCardClassName}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className={studioSectionEyebrowClassName}>일자별 학습시간 성장률</p>
                      <p className="mt-1 text-[11px] font-bold text-[#5c6e97]">최근 42일 중 7일 단위로 확인합니다.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {dailyGrowthWindowData.length > 0 && (
                        <Badge className="h-7 rounded-full border-none bg-[#EEF4FF] px-3 text-[10px] font-black text-[#14295F]">
                          최근 7일 {(dailyGrowthWindowData[dailyGrowthWindowData.length - 1]?.growth ?? 0) >= 0 ? '+' : ''}{dailyGrowthWindowData[dailyGrowthWindowData.length - 1]?.growth ?? 0}%
                        </Badge>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-lg border-[#DCE7FF] px-2.5 text-[10px] font-black text-[#14295F]"
                        onClick={() => setDailyGrowthWindowIndex((prev) => Math.min(prev + 1, dailyGrowthWindowCount - 1))}
                        disabled={boundedDailyGrowthWindowIndex >= dailyGrowthWindowCount - 1}
                      >
                        이전 7일
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-lg border-[#DCE7FF] px-2.5 text-[10px] font-black text-[#14295F]"
                        onClick={() => setDailyGrowthWindowIndex((prev) => Math.max(prev - 1, 0))}
                        disabled={boundedDailyGrowthWindowIndex <= 0}
                      >
                        다음 7일
                      </Button>
                    </div>
                  </div>
                  {trendLoading ? (
                    <div className="flex h-[140px] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#5c6e97]" /></div>
                  ) : !hasDailyGrowthData ? (
                    <div className="flex h-[140px] items-center justify-center text-xs font-bold text-[#5c6e97]">데이터를 수집 중입니다.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={140}>
                      <ComposedChart data={dailyGrowthWindowData} margin={{ top: 8, right: 44, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E4ECFA" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fontWeight: 800, fill: '#5c6e97' }} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="min" tick={{ fontSize: 9, fontWeight: 700, fill: '#5c6e97' }} tickLine={false} axisLine={false} width={46} tickFormatter={(v) => formatChartMinutesAxisTick(Number(v))} />
                        <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 9, fontWeight: 700, fill: '#5c6e97' }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${Math.round(Number(v || 0))}%`} />
                        <Tooltip
                          formatter={(v: number, name: string) => name === 'avgMinutes' ? [`${Math.floor(v / 60)}h ${v % 60}m`, '일 평균'] : [`${v >= 0 ? '+' : ''}${v}%`, '전월 대비']}
                          contentStyle={{ borderRadius: '14px', border: '1px solid #DCE7FF', boxShadow: '0 14px 30px rgba(20,41,95,0.12)', fontSize: '11px', fontWeight: 700, color: '#14295F' }}
                        />
                        <Bar yAxisId="min" dataKey="avgMinutes" fill="#BEE4FF" radius={[5, 5, 0, 0]} barSize={40} />
                        <Line yAxisId="pct" type="monotone" dataKey="growth" stroke="#2554D7" strokeWidth={2.5} dot={{ r: 5, fill: '#2554D7', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                  <div className="mt-2 flex items-center justify-end gap-4">
                    <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded bg-[#BEE4FF]" /><p className="text-[9px] font-bold text-[#5c6e97]">일 평균 학습시간</p></div>
                    <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-[#2554D7]" /><p className="text-[9px] font-bold text-[#5c6e97]">전월 대비 성장률</p></div>
                  </div>
                </div>

                <div className={studioChartCardClassName}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className={studioSectionEyebrowClassName}>리듬점수 변화 그래프</p>
                      <p className="mt-1 text-[11px] font-bold text-[#5c6e97]">최근 14일 기준 리듬 점수 변화 추이</p>
                    </div>
                    <Badge className="h-7 rounded-full border-none bg-[#EEF4FF] px-3 text-[10px] font-black text-[#14295F]">
                      평균 {averageRhythmScore}점
                    </Badge>
                  </div>
                  {trendLoading ? (
                    <div className="flex h-[130px] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#5c6e97]" /></div>
                  ) : !hasRhythmScoreChangeData ? (
                    <div className="flex h-[130px] items-center justify-center text-xs font-bold text-[#5c6e97]">리듬 점수 데이터를 수집 중입니다.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={130}>
                      <LineChart data={rhythmScoreTrendData} margin={{ top: 6, right: 12, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E4ECFA" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 700, fill: '#5c6e97' }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fontWeight: 700, fill: '#5c6e97' }} tickLine={false} axisLine={false} width={40} />
                        <Tooltip
                          formatter={(v: number) => [`${Math.round(v)}점`, '리듬 점수']}
                          contentStyle={{ borderRadius: '14px', border: '1px solid #DCE7FF', boxShadow: '0 14px 30px rgba(20,41,95,0.12)', fontSize: '11px', fontWeight: 700, color: '#14295F' }}
                        />
                        <Line type="monotone" dataKey="score" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className={studioChartCardClassName}>
                  <div className="mb-3">
                    <p className={studioSectionEyebrowClassName}>학습 시간 분포 리듬</p>
                    <p className="mt-1 text-[11px] font-bold text-[#5c6e97]">최근 7일 기준 첫 공부 시작시간과 마지막 공부 종료시간</p>
                  </div>
                  {trendLoading ? (
                    <div className="flex h-[130px] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#5c6e97]" /></div>
                  ) : !hasRhythmData ? (
                    <div className="flex h-[130px] items-center justify-center text-xs font-bold text-[#5c6e97]">데이터를 수집 중입니다.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={130}>
                      <ComposedChart data={rhythmData} margin={{ top: 6, right: 12, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E4ECFA" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 800, fill: '#5c6e97' }} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 24]} tick={{ fontSize: 9, fontWeight: 700, fill: '#5c6e97' }} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => `${Math.round(Number(v || 0))}h`} />
                        <Tooltip
                          formatter={(v: number, name: string) => [`${Math.floor(v)}:${Math.round((v % 1) * 60).toString().padStart(2, '0')}`, name === 'startHour' ? '시작시간' : '종료시간']}
                          contentStyle={{ borderRadius: '14px', border: '1px solid #DCE7FF', boxShadow: '0 14px 30px rgba(20,41,95,0.12)', fontSize: '11px', fontWeight: 700, color: '#14295F' }}
                        />
                        <Line type="monotone" dataKey="startHour" stroke="#0EA5E9" strokeWidth={2.5} dot={{ r: 3, fill: '#0EA5E9', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                        <Line type="monotone" dataKey="endHour" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 3, fill: '#8B5CF6', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                  <div className="mt-2 flex items-center justify-end gap-4">
                    <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-sky-500" /><p className="text-[9px] font-bold text-[#5c6e97]">첫 시작시간</p></div>
                    <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-violet-500" /><p className="text-[9px] font-bold text-[#5c6e97]">마지막 종료시간</p></div>
                  </div>
                </div>

                <div className={studioChartCardClassName}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className={studioSectionEyebrowClassName}>학습 중간 외출시간 추이</p>
                      <p className="mt-1 text-[11px] font-bold text-[#5c6e97]">외출시간이 늘어날수록 집중 흐름 이탈을 점검해야 합니다.</p>
                    </div>
                    {dayDataLoading ? <Loader2 className="h-4 w-4 animate-spin text-[#5c6e97]" /> : null}
                  </div>
                  {awayTimeData.every((d) => d.awayMinutes === 0) ? (
                    <div className="flex h-[130px] flex-col items-center justify-center gap-1 text-xs font-bold text-[#5c6e97]">
                      <p>세션 기록이 없습니다.</p>
                      <p className="text-[9px] font-bold text-[#8EA0C4]">6시간 이상 연속 학습 세션부터 외출 데이터가 수집됩니다.</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={130}>
                      <ComposedChart data={awayTimeData} margin={{ top: 6, right: 12, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E4ECFA" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fontWeight: 700, fill: '#5c6e97' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 9, fontWeight: 700, fill: '#5c6e97' }} tickLine={false} axisLine={false} width={42} tickFormatter={(v) => `${Math.max(0, Math.round(Number(v || 0)))}m`} />
                        <Tooltip
                          formatter={(v: number) => [`${v}분`, '외출시간']}
                          contentStyle={{ borderRadius: '14px', border: '1px solid #DCE7FF', boxShadow: '0 14px 30px rgba(20,41,95,0.12)', fontSize: '11px', fontWeight: 700, color: '#14295F' }}
                        />
                        <Bar dataKey="awayMinutes" fill="#FFD0B0" radius={[4, 4, 0, 0]} />
                        <Line type="monotone" dataKey="awayMinutes" stroke="#FF7A16" strokeWidth={2} dot={{ r: 3, fill: '#FF7A16', strokeWidth: 0 }} activeDot={{ r: 4 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {selectedFocusKpi && selectedFocusKpi.insights.length > 0 && (
                <div className="rounded-[1.7rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_36px_-32px_rgba(20,41,95,0.18)]">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-[#EEF4FF] text-[#2554D7]">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div>
                      <p className={studioSectionEyebrowClassName}>관리자 인사이트</p>
                      <p className="mt-1 text-sm font-black text-[#14295F]">오늘 운영 판단에 바로 쓸 해석입니다.</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {selectedFocusKpi.insights.map((insight, idx) => (
                      <div key={idx} className="rounded-[1.2rem] border border-[#DCE7FF] bg-[#F7FAFF] px-3 py-2.5">
                        <p className="text-xs font-bold leading-5 text-[#14295F]">{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* ── FOOTER ── */}
          <DialogFooter className="border-t border-[#DCE7FF] bg-white p-4 flex-shrink-0">
            <DialogClose asChild>
              <Button type="button" className="h-10 rounded-xl bg-[#14295F] px-5 font-black text-white hover:bg-[#10224C]">닫기</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isParentTrustDialogOpen} onOpenChange={setIsParentTrustDialogOpen}>
        <DialogContent className={cn(studioDialogContentClassName, 'sm:max-w-4xl')}>
          <div className={studioDialogHeaderClassName}>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black tracking-tight">부모님별 신뢰 지표 상세</DialogTitle>
              <DialogDescription className="font-bold text-white/80">
                방문/리포트 열람/상담 신청을 합산해 우선 연락 대상을 추천합니다.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="max-h-[72vh] overflow-y-auto bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)] p-6 space-y-4">
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
              className="h-11 rounded-xl border-2 border-[#DCE7FF] bg-white font-bold text-[#14295F] placeholder:text-[#9AA9C7]"
            />

            {filteredParentTrustRows.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-[#DCE7FF] bg-white py-12 text-center text-sm font-bold text-[#5c6e97]">
                조회된 학부모 데이터가 없습니다.
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredParentTrustRows.map((row) => (
                  <div key={row.bucketKey} className="rounded-[1.5rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_32px_-28px_rgba(20,41,95,0.16)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-base font-black text-[#14295F]">{row.parentName}</p>
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
                        <p className="text-[11px] font-bold text-[#5c6e97]">
                          {row.parentPhone} · 학생: {row.linkedStudentNames.length > 0 ? row.linkedStudentNames.join(', ') : '-'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#5c6e97]">신뢰 점수</p>
                        <p className="dashboard-number text-2xl text-[#14295F]">{row.trustScore}점</p>
                        <p className="text-[10px] font-bold text-rose-500">리스크 {row.riskScore}점</p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-lg bg-[#F7FAFF] px-3 py-2 text-xs font-bold text-[#14295F]">앱 방문 {row.visitCount}회</div>
                      <div className="rounded-lg bg-[#F7FAFF] px-3 py-2 text-xs font-bold text-[#14295F]">리포트 열람 {row.reportReadCount}회</div>
                      <div className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-rose-700">상담 신청 {row.consultationRequestCount}건</div>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <p className="rounded-lg bg-[#F7FAFF] px-3 py-2 text-xs font-bold text-[#5c6e97]">최근 방문: {row.lastVisitLabel}</p>
                      <p className="rounded-lg bg-[#F7FAFF] px-3 py-2 text-xs font-bold text-[#5c6e97]">최근 상호작용: {row.lastInteractionLabel}</p>
                    </div>
                    <p className="mt-2 rounded-lg border border-rose-100 bg-rose-50/60 px-3 py-2 text-xs font-black text-rose-700">
                      연락 추천: {row.recommendedAction}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-[#DCE7FF] bg-white p-4">
            <DialogClose asChild>
              <Button className="h-11 rounded-xl bg-[#14295F] px-6 font-black text-white hover:bg-[#10224C]">닫기</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTeacher} onOpenChange={(open) => !open && setSelectedTeacherId(null)}>
        <DialogContent className={cn(studioDialogContentClassName, 'sm:max-w-3xl')}>
          {selectedTeacher && (
            <>
              <div className={studioDialogHeaderClassName}>
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black tracking-tight">{selectedTeacher.teacherName}</DialogTitle>
                  <DialogDescription className="font-bold text-white/80">
                    {selectedTeacher.roleLabel} · 상담일지 {selectedTeacher.logs.length}건 · 발송 리포트 {selectedTeacher.sentReports.length}건
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="max-h-[70vh] overflow-y-auto bg-[linear-gradient(180deg,#F7FAFF_0%,#EEF4FF_100%)] p-6 space-y-5">
                <div className="rounded-[1.5rem] border border-[#DCE7FF] bg-white p-4 shadow-[0_18px_32px_-28px_rgba(20,41,95,0.16)]">
                  <p className="text-[11px] font-black uppercase tracking-widest text-[#5c6e97]">계정 정보</p>
                  <div className="mt-2 grid gap-1 text-sm font-bold text-[#14295F]">
                    <p>계정 구분: {selectedTeacher.roleLabel}</p>
                    <p>사용자번호: {selectedTeacher.id}</p>
                    <p>전화번호: {selectedTeacher.phoneNumber || '미등록'}</p>
                    <p>상태: {selectedTeacher.status}</p>
                  </div>
                </div>

                <section className="space-y-2">
                  <h4 className="text-sm font-black tracking-tight text-[#14295F]">작성 상담일지</h4>
                  {selectedTeacher.logs.length === 0 ? (
                    <div className="rounded-[1.45rem] border border-dashed border-[#DCE7FF] bg-white py-8 text-center text-xs font-bold text-[#5c6e97]">
                      작성된 상담일지가 없습니다.
                    </div>
                  ) : (
                    selectedTeacher.logs.slice(0, 12).map((log) => (
                      <div key={log.id} className="rounded-[1.35rem] border border-[#DCE7FF] bg-white p-3 shadow-[0_18px_30px_-28px_rgba(20,41,95,0.14)]">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] font-black text-[#5c6e97]">
                          <Badge className="h-5 border-none bg-emerald-100 px-2 text-[10px] font-black text-emerald-700">
                            {log.type === 'academic' ? '학습 상담' : log.type === 'life' ? '생활 상담' : '진로 상담'}
                          </Badge>
                          <span>{log.createdAt ? format(log.createdAt.toDate(), 'yyyy.MM.dd HH:mm') : '-'}</span>
                          <span>·</span>
                          <span>{log.studentName || log.studentId}</span>
                        </div>
                        <p className="text-sm font-bold leading-relaxed text-[#14295F]">{log.content}</p>
                        {log.improvement && <p className="mt-1 text-xs font-semibold text-emerald-700">개선 포인트: {log.improvement}</p>}
                      </div>
                    ))
                  )}
                </section>

                <section className="space-y-2">
                  <h4 className="text-sm font-black tracking-tight text-[#14295F]">발송 리포트 내역</h4>
                  {selectedTeacher.sentReports.length === 0 ? (
                    <div className="rounded-[1.45rem] border border-dashed border-[#DCE7FF] bg-white py-8 text-center text-xs font-bold text-[#5c6e97]">
                      발송된 리포트가 없습니다.
                    </div>
                  ) : (
                    selectedTeacher.sentReports.slice(0, 12).map((report) => (
                      <div key={report.id} className="rounded-[1.35rem] border border-[#DCE7FF] bg-white p-3 shadow-[0_18px_30px_-28px_rgba(20,41,95,0.14)]">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] font-black text-[#5c6e97]">
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
                        <p className="line-clamp-2 text-sm font-bold text-[#14295F]">{report.content || '리포트 내용 없음'}</p>
                      </div>
                    ))
                  )}
                </section>
              </div>

              <DialogFooter className="border-t border-[#DCE7FF] bg-white p-4">
                <DialogClose asChild>
                  <Button className="h-11 rounded-xl bg-[#14295F] px-6 font-black text-white hover:bg-[#10224C]">닫기</Button>
                </DialogClose>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
