'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Send,
  Sparkles,
  TrendingUp,
  Activity,
  History,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  PieChart as PieChartIcon,
  BarChart3,
  Flame,
  Info,
  FileText,
  Clock,
  Zap,
  Coffee,
  AlertTriangle,
  UserCheck,
  Home,
  AlertCircle,
  CalendarX,
  MapPin,
  CalendarDays,
  Loader2,
  CreditCard,
  Megaphone,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart as RechartsLineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { 
  format, 
  subDays, 
  isAfter, 
  parse, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths 
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { useAppContext } from '@/contexts/app-context';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  type ParentPortalTab,
  type ParentQuickRequestKey,
  type ParentNotificationItem,
} from '@/lib/parent-dashboard-model';
import {
  type AttendanceCurrent,
  type AttendanceRequest,
  type DailyReport,
  type GrowthProgress,
  type Invoice,
  type PenaltyLog,
  type ParentActivityEvent,
  type StudyLogDay,
  type StudySession,
  type StudyPlanItem,
  type StudentProfile,
} from '@/lib/types';
import { ROUTINE_MISSING_PENALTY_POINTS } from '@/lib/attendance-auto';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

function toHm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간\u00A0${m}분`;
}

function toClockLabel(totalMinutes: number) {
  const safe = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
  const hours = Math.floor(safe / 60).toString().padStart(2, '0');
  const minutes = (safe % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function calculateRhythmScore(minutes: number[]): number {
  if (!minutes.length) return 0;
  const safeMinutes = minutes.map((value) => Math.max(0, Math.round(value)));
  const avg = safeMinutes.reduce((acc, value) => acc + value, 0) / safeMinutes.length;
  if (avg <= 0) return 0;
  const variance = safeMinutes.reduce((acc, value) => acc + (value - avg) ** 2, 0) / safeMinutes.length;
  const std = Math.sqrt(variance);
  return Math.max(0, Math.min(100, Math.round(100 - (std / avg) * 100)));
}

function toKoreanSubjectLabel(raw: string): string {
  const source = (raw || '').trim();
  if (!source) return '기타';
  const key = source.toLowerCase();

  if (key === 'math' || key.includes('수학')) return '수학';
  if (key === 'english' || key.includes('영어')) return '영어';
  if (key === 'korean' || key.includes('국어')) return '국어';
  if (key === 'science' || key.includes('과학')) return '과학';
  if (key === 'social' || key.includes('사회')) return '사회';
  if (key === 'history' || key.includes('한국사') || key.includes('역사')) return '한국사';
  if (key === 'essay' || key.includes('논술')) return '논술';
  if (key === 'coding' || key.includes('코딩')) return '코딩';
  if (key === 'etc' || key.includes('기타')) return '기타';

  return source;
}

type ParentCommunicationRecord = {
  id: string;
  studentId: string;
  parentUid?: string;
  parentName?: string;
  senderRole?: 'parent' | 'student';
  senderUid?: string;
  senderName?: string;
  type: 'consultation' | 'request' | 'suggestion';
  requestCategory?: 'question' | 'request' | 'suggestion';
  title?: string;
  body?: string;
  channel?: 'visit' | 'phone' | 'online' | null;
  status?: string;
  createdAt?: { toDate?: () => Date; toMillis?: () => number };
  updatedAt?: { toDate?: () => Date; toMillis?: () => number };
  replyBody?: string;
  repliedAt?: { toDate?: () => Date };
  repliedByName?: string;
};

type ParentAnnouncementRecord = {
  id: string;
  title?: string;
  body?: string;
  audience?: 'parent' | 'student' | 'all';
  status?: string;
  createdAt?: { toDate?: () => Date; toMillis?: () => number };
  updatedAt?: { toDate?: () => Date; toMillis?: () => number };
};

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function getFocusProgress(minutes: number) {
  return Math.min(100, Math.round((minutes / 360) * 100));
}

function formatWon(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return `₩${safe.toLocaleString()}`;
}

type InvoiceStatusMeta = {
  label: string;
  mobileLabel: string;
  className: string;
};

function getInvoiceStatusMeta(status: Invoice['status']): InvoiceStatusMeta | null {
  if (status === 'paid') {
    return {
      label: '수납 완료',
      mobileLabel: '완납',
      className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
  }
  if (status === 'overdue') {
    return {
      label: '미납',
      mobileLabel: '미납',
      className: 'bg-rose-100 text-rose-700 border-rose-200',
    };
  }
  if (status === 'issued') {
    return {
      label: '청구',
      mobileLabel: '미납',
      className: 'bg-amber-100 text-amber-700 border-amber-200',
    };
  }
  return null;
}

function getInvoiceTrackLabel(category?: Invoice['trackCategory']) {
  if (category === 'academy') return '학원 수납';
  if (category === 'studyRoom') return '독서실 수납';
  return '센터 수납';
}

const QUICK_REQUEST_TEMPLATES: Record<ParentQuickRequestKey, string> = {
  math_support: '수학 집중 관리 요청',
  english_support: '영어 보완 요청',
  habit_coaching: '학습 습관 코칭 요청',
  career_consulting: '진로/진학 상담 요청',
};

const SUBJECT_COLORS = ['#FF7A16', '#14295F', '#10B981', '#0EA5E9', '#A855F7'];
const REQUEST_PENALTY_POINTS: Record<'late' | 'absence', number> = { late: 1, absence: 2 };
const PENALTY_RECOVERY_INTERVAL_DAYS = 7;

type TimestampLike = { toDate?: () => Date } | Date | string | null | undefined;

function toDateSafe(value: TimestampLike): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function toRelativeLabel(value: TimestampLike, now = new Date()) {
  const date = toDateSafe(value);
  if (!date) return '최근';
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}일 전`;
  return format(date, 'MM/dd', { locale: ko });
}

function formatDateLabel(dateText?: string, fallbackTimestamp?: TimestampLike) {
  if (dateText && /^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    const parsed = parse(dateText, 'yyyy-MM-dd', new Date());
    if (!Number.isNaN(parsed.getTime())) {
      return format(parsed, 'MM/dd', { locale: ko });
    }
  }
  const fallbackDate = toDateSafe(fallbackTimestamp);
  if (fallbackDate) {
    return format(fallbackDate, 'MM/dd', { locale: ko });
  }
  return '최근';
}
export function ParentDashboard({ isActive }: { isActive: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { memberships, activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();

  const isMobile = activeMembership?.role === 'parent' || viewMode === 'mobile';
  const [today, setToday] = useState<Date | null>(null);
  const [tab, setTab] = useState<ParentPortalTab>('home');
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date());

  const [channel, setChannel] = useState<'visit' | 'phone' | 'online'>('visit');
  const [quickType, setQuickType] = useState<ParentQuickRequestKey>('math_support');
  const [requestText, setRequestText] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [parentInquiryType, setParentInquiryType] = useState<'question' | 'request' | 'suggestion'>('question');
  const [parentInquiryTitle, setParentInquiryTitle] = useState('');
  const [parentInquiryBody, setParentInquiryBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [readMap, setReadMap] = useState<Record<string, boolean>>({});
  const [selectedNotification, setSelectedNotification] = useState<ParentNotificationItem | null>(null);
  const [isReportArchiveOpen, setIsReportArchiveOpen] = useState(false);
  const [selectedChildReport, setSelectedChildReport] = useState<DailyReport | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [isPenaltyGuideOpen, setIsPenaltyGuideOpen] = useState(false);
  const [checkInByDateKey, setCheckInByDateKey] = useState<Record<string, Date | null>>({});
  const [studyStartByDateKey, setStudyStartByDateKey] = useState<Record<string, Date | null>>({});
  const [studyEndByDateKey, setStudyEndByDateKey] = useState<Record<string, Date | null>>({});
  const [awayMinutesByDateKey, setAwayMinutesByDateKey] = useState<Record<string, number>>({});
  const visitLoggedRef = useRef(false);
  const reportReadLoggedRef = useRef<Record<string, boolean>>({});

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => setToday(new Date()), []);

  useEffect(() => {
    const requestedTab = searchParams.get('parentTab');
    if (!requestedTab) return;

    if (requestedTab === 'life') {
      setTab('data');
      const params = new URLSearchParams(searchParams.toString());
      params.set('parentTab', 'data');
      router.replace(`${pathname}?${params.toString()}`);
      return;
    }

    const normalizedTab = requestedTab as ParentPortalTab;
    if (normalizedTab) {
      setTab(normalizedTab);
    }
  }, [searchParams, pathname, router]);

  const active센터Membership = useMemo(() => {
    if (activeMembership) {
      return memberships.find((membership) => membership.id === activeMembership.id) || activeMembership;
    }
    return memberships.find((membership) => membership.status === 'active') || memberships[0] || null;
  }, [activeMembership, memberships]);

  const centerId = active센터Membership?.id;
  const studentId = active센터Membership?.linkedStudentIds?.[0];
  const todayKey = today ? format(today, 'yyyy-MM-dd') : '';
  const yesterdayKey = today ? format(subDays(today, 1), 'yyyy-MM-dd') : '';
  const weekKey = today ? format(today, "yyyy-'W'II") : '';
  const logParentActivity = async (
    eventType: ParentActivityEvent['eventType'],
    metadata?: Record<string, any>
  ) => {
    if (!firestore || !centerId || !studentId || !user) return;

    try {
      await addDoc(collection(firestore, 'centers', centerId, 'parentActivityEvents'), {
        centerId,
        studentId,
        parentUid: user.uid,
        eventType,
        createdAt: serverTimestamp(),
        metadata: metadata || {},
      });
    } catch (error) {
      console.warn('[parent-activity] failed to log event', eventType, error);
    }
  };

  useEffect(() => {
    if (!isActive || !centerId || !studentId || !user || visitLoggedRef.current) return;

    visitLoggedRef.current = true;
    void logParentActivity('app_visit', { source: 'dashboard_open', tab });
  }, [isActive, centerId, studentId, user, tab]);

  const studentRef = useMemoFirebase(() => (!firestore || !centerId || !studentId ? null : doc(firestore, 'centers', centerId, 'students', studentId)), [firestore, centerId, studentId]);
  const { data: student } = useDoc<StudentProfile>(studentRef, { enabled: isActive && !!studentId });

  const todayLogRef = useMemoFirebase(() => (!firestore || !centerId || !studentId || !todayKey ? null : doc(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', todayKey)), [firestore, centerId, studentId, todayKey]);
  const { data: todayLog } = useDoc<StudyLogDay>(todayLogRef, { enabled: isActive && !!studentId });

  // 캘린더용 모든 로그 조회
  const allLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days'), orderBy('dateKey', 'desc'));
  }, [firestore, centerId, studentId]);
  const { data: allLogs, isLoading: logsLoading } = useCollection<StudyLogDay>(allLogsQuery, { enabled: isActive && !!studentId });

  const plansQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !todayKey || !weekKey) return null;
    return query(collection(firestore, 'centers', centerId, 'plans', studentId, 'weeks', weekKey, 'items'), where('dateKey', '==', todayKey));
  }, [firestore, centerId, studentId, todayKey, weekKey]);
  const { data: todayPlans } = useCollection<StudyPlanItem>(plansQuery, { enabled: isActive && !!studentId });

  const weeklyPlansQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !weekKey) return null;
    return query(collection(firestore, 'centers', centerId, 'plans', studentId, 'weeks', weekKey, 'items'));
  }, [firestore, centerId, studentId, weekKey]);
  const { data: weeklyPlans } = useCollection<StudyPlanItem>(weeklyPlansQuery, { enabled: isActive && !!studentId });

  const selectedDateKey = selectedCalendarDate ? format(selectedCalendarDate, 'yyyy-MM-dd') : '';
  const selectedDateWeekKey = selectedCalendarDate ? format(selectedCalendarDate, "yyyy-'W'II") : '';
  const selectedDatePlansQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !selectedDateKey || !selectedDateWeekKey) return null;
    return query(
      collection(firestore, 'centers', centerId, 'plans', studentId, 'weeks', selectedDateWeekKey, 'items'),
      where('dateKey', '==', selectedDateKey),
    );
  }, [firestore, centerId, studentId, selectedDateKey, selectedDateWeekKey]);
  const { data: selectedDatePlans, isLoading: isSelectedDatePlansLoading } = useCollection<StudyPlanItem>(selectedDatePlansQuery, {
    enabled: isActive && !!studentId && !!selectedDateKey,
  });

  const attendanceCurrentQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'attendanceCurrent'),
      where('studentId', '==', studentId),
      limit(1)
    );
  }, [firestore, centerId, studentId]);
  const { data: attendanceCurrentDocs } = useCollection<AttendanceCurrent>(attendanceCurrentQuery, { enabled: isActive && !!studentId });
  const attendanceCurrent = attendanceCurrentDocs?.[0];

  useEffect(() => {
    if (!isActive || !firestore || !centerId || !studentId || !today) {
      setCheckInByDateKey({});
      return;
    }

    let cancelled = false;
    const targetDateKeys = Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 6 - index);
      return format(day, 'yyyy-MM-dd');
    });

    const loadCheckInRecords = async () => {
      try {
        const pairs = await Promise.all(
          targetDateKeys.map(async (dateKey) => {
            const recordRef = doc(firestore, 'centers', centerId, 'attendanceRecords', dateKey, 'students', studentId);
            const snap = await getDoc(recordRef);
            if (!snap.exists()) return [dateKey, null] as const;
            const payload = snap.data() as Record<string, unknown>;
            const checkInAt = toDateSafe((payload?.checkInAt as TimestampLike) || (payload?.updatedAt as TimestampLike));
            return [dateKey, checkInAt] as const;
          })
        );

        if (!cancelled) {
          const next = Object.fromEntries(pairs) as Record<string, Date | null>;
          setCheckInByDateKey(next);
        }
      } catch (error) {
        console.warn('[parent-dashboard] failed to load check-in trend', error);
        if (!cancelled) setCheckInByDateKey({});
      }
    };

    void loadCheckInRecords();
    return () => {
      cancelled = true;
    };
  }, [isActive, firestore, centerId, studentId, today]);

  useEffect(() => {
    if (!isActive || !firestore || !centerId || !studentId || !today) {
      setStudyStartByDateKey({});
      setStudyEndByDateKey({});
      setAwayMinutesByDateKey({});
      return;
    }

    let cancelled = false;
    const targetDateKeys = Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 6 - index);
      return format(day, 'yyyy-MM-dd');
    });

    const loadStudyStartTrend = async () => {
      try {
        const pairs = await Promise.all(
          targetDateKeys.map(async (dateKey) => {
            const sessionsRef = collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', dateKey, 'sessions');
            const snapshot = await getDocs(query(sessionsRef, orderBy('startTime', 'asc')));
            const sessions = snapshot.docs
              .map((item) => item.data() as StudySession)
              .filter((item) => !!item.startTime)
              .map((item) => ({
                startTime: toDateSafe(item.startTime as TimestampLike),
                endTime: toDateSafe(item.endTime as TimestampLike),
              }))
              .filter((item) => item.startTime) as Array<{ startTime: Date; endTime: Date | null }>;
            const firstSession = sessions[0] || null;
            const lastSession = sessions[sessions.length - 1] || null;
            const sessionStart = firstSession?.startTime || null;
            const sessionEnd = lastSession?.endTime || lastSession?.startTime || null;
            let awayMinutes = 0;
            for (let i = 1; i < sessions.length; i += 1) {
              const prevEnd = sessions[i - 1].endTime;
              const currStart = sessions[i].startTime;
              if (!prevEnd || !currStart) continue;
              const gap = Math.round((currStart.getTime() - prevEnd.getTime()) / 60000);
              if (gap > 0 && gap < 180) awayMinutes += gap;
            }
            const todayFallback =
              dateKey === todayKey && attendanceCurrent?.status === 'studying' && attendanceCurrent?.lastCheckInAt
                ? toDateSafe(attendanceCurrent.lastCheckInAt as TimestampLike)
                : null;
            return [
              dateKey,
              {
                start: sessionStart || todayFallback,
                end: sessionEnd || todayFallback,
                awayMinutes,
              },
            ] as const;
          })
        );

        if (!cancelled) {
          const nextStart: Record<string, Date | null> = {};
          const nextEnd: Record<string, Date | null> = {};
          const nextAway: Record<string, number> = {};
          pairs.forEach(([dateKey, value]) => {
            nextStart[dateKey] = value.start || null;
            nextEnd[dateKey] = value.end || null;
            nextAway[dateKey] = Math.max(0, Math.round(value.awayMinutes || 0));
          });
          setStudyStartByDateKey(nextStart);
          setStudyEndByDateKey(nextEnd);
          setAwayMinutesByDateKey(nextAway);
        }
      } catch (error) {
        console.warn('[parent-dashboard] failed to load study rhythm trend', error);
        if (!cancelled) {
          setStudyStartByDateKey({});
          setStudyEndByDateKey({});
          setAwayMinutesByDateKey({});
        }
      }
    };

    void loadStudyStartTrend();
    return () => {
      cancelled = true;
    };
  }, [isActive, firestore, centerId, studentId, today, todayKey, attendanceCurrent?.lastCheckInAt, attendanceCurrent?.status]);

  const reportRef = useMemoFirebase(() => (!firestore || !centerId || !studentId || !yesterdayKey ? null : doc(firestore, 'centers', centerId, 'dailyReports', `${yesterdayKey}_${studentId}`)), [firestore, centerId, studentId, yesterdayKey]);
  const { data: report } = useDoc<DailyReport>(reportRef, { enabled: isActive && !!studentId });
  useEffect(() => {
    if (!isActive || !firestore || !centerId || !studentId || !report?.content) return;

    const reportDocId = report.id || `${yesterdayKey}_${studentId}`;
    if (reportReadLoggedRef.current[reportDocId]) return;
    reportReadLoggedRef.current[reportDocId] = true;

    if (!(report as any).viewedAt) {
      const targetRef = doc(firestore, 'centers', centerId, 'dailyReports', reportDocId);
      updateDoc(targetRef, {
        viewedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch((error) => {
        console.warn('[parent-report] viewedAt update failed', error);
      });
    }

    void logParentActivity('report_read', {
      reportId: reportDocId,
      dateKey: report.dateKey || yesterdayKey,
    });
  }, [isActive, firestore, centerId, studentId, report, yesterdayKey]);

  const reportsArchiveQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'dailyReports'),
      where('studentId', '==', studentId),
      where('status', '==', 'sent'),
      limit(50),
    );
  }, [firestore, centerId, studentId]);
  const { data: rawReportsArchive } = useCollection<DailyReport>(reportsArchiveQuery, { enabled: isActive && !!studentId });
  const reportsArchive = useMemo(
    () => [...(rawReportsArchive || [])].sort((a, b) => String(b.dateKey || '').localeCompare(String(a.dateKey || ''))),
    [rawReportsArchive]
  );

  const growthRef = useMemoFirebase(() => (!firestore || !centerId || !studentId ? null : doc(firestore, 'centers', centerId, 'growthProgress', studentId)), [firestore, centerId, studentId]);
  const { data: growth } = useDoc<GrowthProgress>(growthRef, { enabled: isActive && !!studentId });

  const remoteNotificationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId || !user) return null;
    return query(
      collection(firestore, 'centers', centerId, 'parentNotifications'),
      where('parentUid', '==', user.uid),
      where('studentId', '==', studentId),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
  }, [firestore, centerId, studentId, user?.uid]);
  const { data: remoteNotifications } = useCollection<any>(remoteNotificationsQuery, { enabled: isActive && !!studentId && !!user });

  const attendance요청Query = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(collection(firestore, 'centers', centerId, 'attendance요청'), where('studentId', '==', studentId), limit(30));
  }, [firestore, centerId, studentId]);
  const { data: attendance요청 } = useCollection<AttendanceRequest>(attendance요청Query, { enabled: isActive && !!studentId });

  const parentCommunicationsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !user) return null;
    return query(
      collection(firestore, 'centers', centerId, 'parentCommunications'),
      where('parentUid', '==', user.uid),
      limit(30),
    );
  }, [firestore, centerId, user]);
  const { data: rawParentCommunications, isLoading: parentCommunicationsLoading } = useCollection<ParentCommunicationRecord>(parentCommunicationsQuery, {
    enabled: isActive && !!centerId && !!user,
  });

  const centerAnnouncementsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'centerAnnouncements'),
      orderBy('createdAt', 'desc'),
      limit(30),
    );
  }, [firestore, centerId]);
  const { data: rawCenterAnnouncements, isLoading: centerAnnouncementsLoading } = useCollection<ParentAnnouncementRecord>(
    centerAnnouncementsQuery,
    { enabled: isActive && !!centerId }
  );

  const legacyParentAnnouncementsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'parentAnnouncements'),
      orderBy('createdAt', 'desc'),
      limit(30),
    );
  }, [firestore, centerId]);
  const { data: rawLegacyParentAnnouncements, isLoading: legacyParentAnnouncementsLoading } = useCollection<ParentAnnouncementRecord>(
    legacyParentAnnouncementsQuery,
    { enabled: isActive && !!centerId }
  );

  const penaltyLogsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(collection(firestore, 'centers', centerId, 'penaltyLogs'), where('studentId', '==', studentId), limit(120));
  }, [firestore, centerId, studentId]);
  const { data: penaltyLogs } = useCollection<PenaltyLog>(penaltyLogsQuery, { enabled: isActive && !!studentId });

  const invoicesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'invoices'),
      where('studentId', '==', studentId),
      limit(120)
    );
  }, [firestore, centerId, studentId]);
  const { data: studentInvoices } = useCollection<Invoice>(invoicesQuery, { enabled: isActive && !!studentId });

  const sortedInvoices = useMemo(() => {
    return [...(studentInvoices || [])].sort((a, b) => {
      const aDate =
        toDateSafe((a as any).cycleEndDate)?.getTime() ??
        toDateSafe((a as any).createdAt)?.getTime() ??
        0;
      const bDate =
        toDateSafe((b as any).cycleEndDate)?.getTime() ??
        toDateSafe((b as any).createdAt)?.getTime() ??
        0;
      return bDate - aDate;
    });
  }, [studentInvoices]);

  const displayInvoices = useMemo(
    () => sortedInvoices.filter((invoice) => invoice.status !== 'void' && invoice.status !== 'refunded'),
    [sortedInvoices]
  );
  const latestInvoice = displayInvoices[0];

  const billingSummary = useMemo(() => {
    return displayInvoices.reduce(
      (acc, invoice) => {
        const amount = Number(invoice.finalPrice || 0);
        if (!Number.isFinite(amount) || amount <= 0) return acc;

        acc.billed += amount;
        if (invoice.status === 'paid') {
          acc.paid += amount;
        }
        if (invoice.status === 'overdue') {
          acc.overdue += amount;
        }
        return acc;
      },
      { billed: 0, paid: 0, overdue: 0 }
    );
  }, [displayInvoices]);

  const mobileBillingStatusMeta = useMemo(() => {
    if (displayInvoices.length === 0) return null;
    const hasUnpaidInvoice = displayInvoices.some(
      (invoice) => invoice.status === 'issued' || invoice.status === 'overdue'
    );
    if (!hasUnpaidInvoice) {
      return {
        label: '완납',
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      };
    }
    return {
      label: '미납',
      className: 'bg-rose-100 text-rose-700 border-rose-200',
    };
  }, [displayInvoices]);

  const studyPlans = (todayPlans || []).filter((item) => item.category === 'study' || !item.category);
  const totalMinutes = todayLog?.totalMinutes || 0;
  
  const planTotal = studyPlans.length;
  const planDone = studyPlans.filter((item) => item.done).length;
  const planRate = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0;

  const logMinutesByDateKey = useMemo(() => {
    const map = new Map<string, number>();
    (allLogs || []).forEach((log) => {
      map.set(log.dateKey, log.totalMinutes || 0);
    });
    return map;
  }, [allLogs]);

  const dailyStudyTrend = useMemo(() => {
    if (!today) return [] as { date: string; minutes: number }[];
    return Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 6 - index);
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        date: format(day, 'MM/dd', { locale: ko }),
        minutes: logMinutesByDateKey.get(dateKey) || 0,
      };
    });
  }, [today, logMinutesByDateKey]);

  const dailyRhythmTrend = useMemo(() => {
    if (!today) return [] as { date: string; rhythmMinutes: number | null }[];

    return Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 6 - index);
      const dateKey = format(day, 'yyyy-MM-dd');
      const studyStart = studyStartByDateKey[dateKey] || null;

      return {
        date: format(day, 'MM/dd', { locale: ko }),
        rhythmMinutes: studyStart ? studyStart.getHours() * 60 + studyStart.getMinutes() : null,
      };
    });
  }, [today, studyStartByDateKey]);

  const rhythmScoreTrend = useMemo(() => {
    const values = dailyRhythmTrend.map((point) => point.rhythmMinutes);
    return dailyRhythmTrend.map((point, index) => {
      const windowValues = values
        .slice(0, index + 1)
        .filter((value): value is number => typeof value === 'number');
      const score = windowValues.length >= 2 ? calculateRhythmScore(windowValues) : windowValues.length === 1 ? 100 : 0;
      return { date: point.date, score };
    });
  }, [dailyRhythmTrend]);

  const rhythmScore = useMemo(() => {
    const validScores = rhythmScoreTrend.filter((item) => item.score > 0);
    if (!validScores.length) return 0;
    return Math.round(validScores.reduce((sum, item) => sum + item.score, 0) / validScores.length);
  }, [rhythmScoreTrend]);

  const rhythmYAxisDomain = useMemo(() => {
    const values = dailyRhythmTrend
      .map((point) => point.rhythmMinutes)
      .filter((value): value is number => typeof value === 'number');

    if (values.length === 0) return [420, 1320] as [number, number];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max(30, Math.round((max - min) * 0.25));
    const lower = Math.max(0, Math.floor((min - padding) / 30) * 30);
    const upper = Math.min(24 * 60, Math.ceil((max + padding) / 30) * 30);
    if (lower === upper) return [Math.max(0, lower - 60), Math.min(24 * 60, upper + 60)] as [number, number];
    return [lower, upper] as [number, number];
  }, [dailyRhythmTrend]);

  const weeklyTotalStudyMinutes = useMemo(
    () => dailyStudyTrend.reduce((sum, day) => sum + day.minutes, 0),
    [dailyStudyTrend]
  );

  const weeklyStudyTimeTrend = useMemo(() => {
    if (!today) return [] as Array<{ label: string; totalMinutes: number }>;
    return Array.from({ length: 6 }, (_, index) => {
      const weekEnd = subDays(today, (5 - index) * 7);
      const weekDays = Array.from({ length: 7 }, (_, d) => format(subDays(weekEnd, d), 'yyyy-MM-dd'));
      const totalMinutes = weekDays.reduce((sum, dateKey) => sum + (logMinutesByDateKey.get(dateKey) || 0), 0);
      return {
        label: `${format(subDays(weekEnd, 6), 'M/d', { locale: ko })}~`,
        totalMinutes,
      };
    });
  }, [today, logMinutesByDateKey]);

  const startEndTrend = useMemo(() => {
    if (!today) return [] as Array<{ date: string; startMinutes: number; endMinutes: number }>;
    return Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 6 - index);
      const dateKey = format(day, 'yyyy-MM-dd');
      const start = studyStartByDateKey[dateKey];
      const end = studyEndByDateKey[dateKey];
      return {
        date: format(day, 'MM/dd', { locale: ko }),
        startMinutes: start ? start.getHours() * 60 + start.getMinutes() : 0,
        endMinutes: end ? end.getHours() * 60 + end.getMinutes() : 0,
      };
    });
  }, [today, studyStartByDateKey, studyEndByDateKey]);

  const awayTimeTrend = useMemo(() => {
    if (!today) return [] as Array<{ date: string; awayMinutes: number }>;
    return Array.from({ length: 7 }, (_, index) => {
      const day = subDays(today, 6 - index);
      const dateKey = format(day, 'yyyy-MM-dd');
      return {
        date: format(day, 'MM/dd', { locale: ko }),
        awayMinutes: Math.max(0, awayMinutesByDateKey[dateKey] || 0),
      };
    });
  }, [today, awayMinutesByDateKey]);

  const hasWeeklyStudyTimeTrend = useMemo(
    () => weeklyStudyTimeTrend.some((item) => item.totalMinutes > 0),
    [weeklyStudyTimeTrend]
  );
  const hasDailyStudyTrend = useMemo(
    () => dailyStudyTrend.some((item) => item.minutes > 0),
    [dailyStudyTrend]
  );
  const hasRhythmScoreTrend = useMemo(
    () => rhythmScoreTrend.some((item) => item.score > 0),
    [rhythmScoreTrend]
  );
  const hasStartEndTrend = useMemo(
    () => startEndTrend.some((item) => item.startMinutes > 0 || item.endMinutes > 0),
    [startEndTrend]
  );
  const hasAwayTrend = useMemo(
    () => awayTimeTrend.some((item) => item.awayMinutes > 0),
    [awayTimeTrend]
  );

  const weeklyStudyPlans = (weeklyPlans || []).filter((item) => item.category === 'study' || !item.category);
  const weeklyPlanTotal = weeklyStudyPlans.length;
  const weeklyPlanDone = weeklyStudyPlans.filter((item) => item.done).length;
  const weeklyPlanCompletionRate = weeklyPlanTotal > 0 ? Math.round((weeklyPlanDone / weeklyPlanTotal) * 100) : 0;

  const subjectsData = useMemo(() => {
    const source = weeklyStudyPlans.length > 0 ? weeklyStudyPlans : studyPlans;
    const minutesBySubject = new Map<string, number>();

    source.forEach((item) => {
      const inferredSubject = item.subject?.trim() || (item.title.match(/수학|영어|국어|과학|사회|한국사|논술|코딩/)?.[0] ?? '기타');
      const weight = item.targetMinutes && item.targetMinutes > 0 ? item.targetMinutes : item.done ? 50 : 30;
      minutesBySubject.set(inferredSubject, (minutesBySubject.get(inferredSubject) || 0) + weight);
    });

    if (minutesBySubject.size === 0 && weeklyTotalStudyMinutes > 0) {
      minutesBySubject.set('전체 학습', weeklyTotalStudyMinutes);
    }

    return Array.from(minutesBySubject.entries())
      .map(([subject, minutes], index) => ({
        subject: toKoreanSubjectLabel(subject),
        minutes,
        color: SUBJECT_COLORS[index % SUBJECT_COLORS.length],
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [studyPlans, weeklyStudyPlans, weeklyTotalStudyMinutes]);

  const subjectTotalMinutes = subjectsData.reduce((sum, subject) => sum + subject.minutes, 0);

  const recentPenaltyReasons = useMemo(() => {
    const sorted요청 = [...(attendance요청 || [])].sort((a, b) => {
      const aDate = toDateSafe((a as any).createdAt)?.getTime() ?? 0;
      const bDate = toDateSafe((b as any).createdAt)?.getTime() ?? 0;
      return bDate - aDate;
    });

    return sorted요청
      .filter((request) => request.penaltyApplied)
      .slice(0, 5)
      .map((request) => ({
        id: request.id,
        reason: request.reason || (request.type === 'late' ? '지각 신청 처리' : '결석 신청 처리'),
        points: request.type === 'absence' ? REQUEST_PENALTY_POINTS.absence : REQUEST_PENALTY_POINTS.late,
        dateLabel: formatDateLabel(request.date, (request as any).createdAt),
      }));
  }, [attendance요청]);

  const penaltyRecovery = useMemo(() => {
    const basePoints = Math.max(0, Math.round(Number(growth?.penaltyPoints || 0)));
    const nowMs = Date.now();
    const latestPositiveLog = [...(penaltyLogs || [])]
      .filter((log) => Number(log.pointsDelta || 0) > 0)
      .sort((a, b) => {
        const aMs = toDateSafe((a as any).createdAt)?.getTime() || 0;
        const bMs = toDateSafe((b as any).createdAt)?.getTime() || 0;
        return bMs - aMs;
      })[0];

    const latestPositiveMs = latestPositiveLog ? toDateSafe((latestPositiveLog as any).createdAt)?.getTime() || 0 : 0;
    const daysSinceLatestPositive = latestPositiveMs > 0 ? Math.max(0, Math.floor((nowMs - latestPositiveMs) / (24 * 60 * 60 * 1000))) : 0;
    const recoveredPoints = latestPositiveMs > 0 ? Math.min(basePoints, Math.floor(daysSinceLatestPositive / PENALTY_RECOVERY_INTERVAL_DAYS)) : 0;
    const effectivePoints = Math.max(0, basePoints - recoveredPoints);

    return {
      basePoints,
      recoveredPoints,
      effectivePoints,
      daysSinceLatestPositive,
      latestPositiveDateLabel: latestPositiveMs > 0 ? format(new Date(latestPositiveMs), 'yyyy.MM.dd', { locale: ko }) : '-',
    };
  }, [growth?.penaltyPoints, penaltyLogs]);

  const aiInsights = useMemo(() => {
    const insights: string[] = [];
    const targetWeeklyMinutes = (student?.targetDailyMinutes || 360) * 5;

    if (weeklyTotalStudyMinutes > 0) {
      const progressRate = Math.round((weeklyTotalStudyMinutes / Math.max(targetWeeklyMinutes, 1)) * 100);
      if (progressRate >= 100) {
        insights.push(`이번 주 목표 학습시간을 달성했습니다. (${toHm(weeklyTotalStudyMinutes)})`);
      } else {
        insights.push(`이번 주 누적 학습은 ${toHm(weeklyTotalStudyMinutes)}으로 목표 대비 ${progressRate}%입니다.`);
      }
    } else {
      insights.push('학습 로그가 쌓이면 인공지능 인사이트가 자동으로 정교해집니다.');
    }

    insights.push(
      weeklyPlanTotal > 0
        ? `주간 계획 달성률은 ${weeklyPlanCompletionRate}%입니다. ${weeklyPlanCompletionRate >= 80 ? '아주 안정적입니다.' : '완료율을 조금만 더 끌어올려 보세요.'}`
        : '이번 주 계획 데이터가 아직 등록되지 않았습니다.'
    );

    if (subjectsData.length > 0) {
      const topSubject = subjectsData[0];
      insights.push(`가장 많이 투자한 과목은 ${topSubject.subject} (${topSubject.minutes}분)입니다.`);
    }

    if (penaltyRecovery.effectivePoints > 0) {
      insights.push(`생활 벌점이 ${penaltyRecovery.effectivePoints}점(회복 반영) 누적되어 있어 생활 관리가 필요합니다.`);
    }

    return insights.slice(0, 4);
  }, [student?.targetDailyMinutes, weeklyTotalStudyMinutes, weeklyPlanTotal, weeklyPlanCompletionRate, subjectsData, penaltyRecovery.effectivePoints]);

  const weeklyFeedback = report?.content?.trim() || aiInsights[0] || '선생님 피드백이 등록되면 이 영역에서 확인할 수 있습니다.';

  const attendanceStatus = useMemo(() => {
    if (!attendanceCurrent) return { label: '상태 미확인', color: 'bg-slate-100 text-slate-400', icon: Clock };

    const status = attendanceCurrent.status;
    const isStudying = ['studying', 'away', 'break'].includes(status);
    const hasRecord = (todayLog?.totalMinutes || 0) > 0;

    if (isStudying) {
      return { label: '등원 (학습 중)', color: 'bg-[#eaf2ff] text-[#14295F] border-blue-100', icon: UserCheck };
    }

    if (!isStudying && hasRecord) {
      return { label: '하원 (귀가 완료)', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: Home };
    }

    const routineItems = todayPlans?.filter(p => p.category === 'schedule') || [];
    const isAbsentDay = routineItems.some(p => p.title.includes('등원하지 않습니다'));
    
    if (isAbsentDay) {
      return { label: '결석 (휴무)', color: 'bg-rose-50 text-rose-600 border-rose-100', icon: CalendarX };
    }

    const inTimePlan = routineItems.find(p => p.title.includes('등원 예정'));
    if (inTimePlan) {
      const timeStr = inTimePlan.title.split(': ')[1];
      if (timeStr) {
        try {
          const now = new Date();
          const scheduledTime = parse(timeStr, 'HH:mm', now);
          if (isAfter(now, scheduledTime)) {
            return { label: '지각 주의', color: 'bg-orange-50 text-[#FF7A16] border-orange-100', icon: AlertCircle };
          }
        } catch (e) {}
      }
    }

    return { label: '미입실 (입실 전)', color: 'bg-slate-100 text-slate-400 border-slate-200', icon: Clock };
  }, [attendanceCurrent, todayLog, todayPlans]);

  // 캘린더 데이터 생성
  const calendarData = useMemo(() => {
    const start = startOfMonth(currentCalendarDate);
    const end = endOfMonth(currentCalendarDate);
    const calendarStart = startOfWeek(start, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(end, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentCalendarDate]);

  const getHeatmapColor = (minutes: number) => {
    if (minutes === 0) return 'bg-white text-slate-400';
    if (minutes < 60) return 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700';
    if (minutes < 180) return 'bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-800';
    if (minutes < 300) return 'bg-gradient-to-br from-emerald-200 to-emerald-300 text-emerald-900';
    if (minutes < 480) return 'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white';
    return 'bg-gradient-to-br from-emerald-600 to-emerald-700 text-white';
  };

  const notifications: ParentNotificationItem[] = useMemo(() => {
    if (remoteNotifications && remoteNotifications.length > 0) {
      return remoteNotifications.map((item: any) => ({
        id: item.id,
        type: item.type || 'weekly_report',
        title: item.title || '새 알림',
        body: item.body || '',
        createdAtLabel: item.createdAtLabel || toRelativeLabel(item.createdAt),
        createdAtMs: toDateSafe(item.createdAt)?.getTime() || 0,
        isRead: !!item.isRead,
        isImportant: !!item.isImportant,
      }));
    }

    const fallback: ParentNotificationItem[] = [];

    if (attendanceCurrent) {
      fallback.push({
        id: `attendance-${attendanceCurrent.id || 'current'}`,
        type: attendanceCurrent.status === 'studying' ? 'check_in' : 'check_out',
        title: attendanceCurrent.status === 'studying' ? '등원 상태 확인' : '출결 상태 업데이트',
        body: attendanceStatus.label,
        createdAtLabel: toRelativeLabel((attendanceCurrent as any).updatedAt),
        createdAtMs: toDateSafe((attendanceCurrent as any).updatedAt)?.getTime() || 0,
        isRead: false,
        isImportant: attendanceCurrent.status !== 'studying',
      });
    }

    if (report?.content) {
      fallback.push({
        id: report.id || `${yesterdayKey}-${studentId}`,
        type: 'weekly_report',
        title: '학습 리포트 도착',
        body: report.content,
        createdAtLabel: toRelativeLabel((report as any).updatedAt || (report as any).createdAt),
        createdAtMs: toDateSafe((report as any).updatedAt || (report as any).createdAt)?.getTime() || 0,
        isRead: !!report.viewedAt,
        isImportant: true,
      });
    }

    if (recentPenaltyReasons.length > 0) {
      const latest = recentPenaltyReasons[0];
      fallback.push({
        id: `penalty-${latest.id}`,
        type: 'penalty',
        title: '생활 기록 알림',
        body: `${latest.reason} (+${latest.points}점)`,
        createdAtLabel: latest.dateLabel,
        createdAtMs: 0,
        isRead: false,
        isImportant: true,
      });
    }

    return fallback;
  }, [remoteNotifications, attendanceCurrent, attendanceStatus.label, report, recentPenaltyReasons, studentId, yesterdayKey]);

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  }, [notifications]);

  const recentNotifications = useMemo(() => sortedNotifications.slice(0, 3), [sortedNotifications]);
  const unreadRecentCount = useMemo(
    () => recentNotifications.filter((notification) => !(notification.isRead || !!readMap[notification.id])).length,
    [recentNotifications, readMap]
  );

  const latestStudySnapshot = useMemo(() => {
    const sorted = [...(allLogs || [])]
      .filter((log) => (log.totalMinutes || 0) > 0)
      .sort((a, b) => (b.dateKey || '').localeCompare(a.dateKey || ''));
    const latest = sorted[0];
    if (!latest) return null;

    const parsed = parse(latest.dateKey, 'yyyy-MM-dd', new Date());
    const studyDateLabel = Number.isNaN(parsed.getTime())
      ? latest.dateKey
      : format(parsed, 'MM/dd (EEE)', { locale: ko });
    const studyStartAt = studyStartByDateKey[latest.dateKey] || null;
    const studyStartLabel = studyStartAt ? format(studyStartAt, 'HH:mm') : '기록 없음';

    return {
      dateKey: latest.dateKey,
      studyDateLabel,
      studyStartLabel,
    };
  }, [allLogs, studyStartByDateKey]);

  const latestAwayNotification = useMemo(
    () => sortedNotifications.find((notification) => notification.type === 'away_long' || notification.type === 'unauthorized_exit') || null,
    [sortedNotifications]
  );

  const latestCheckOutNotification = useMemo(
    () => sortedNotifications.find((notification) => notification.type === 'check_out') || null,
    [sortedNotifications]
  );

  const recentLifeAttendanceSummary = useMemo(() => {
    const isAwayNow = attendanceCurrent?.status === 'away' || attendanceCurrent?.status === 'break';
    const hasAwayRecord = isAwayNow || !!latestAwayNotification;
    const hasCheckOutRecord =
      !!latestCheckOutNotification ||
      (attendanceCurrent?.status !== 'studying' && (todayLog?.totalMinutes || 0) > 0);

    return {
      recentStudyDate: latestStudySnapshot?.studyDateLabel || '기록 없음',
      recentStudyStart: latestStudySnapshot?.studyStartLabel || '기록 없음',
      awayStatus: isAwayNow
        ? '현재 외출/휴식 중'
        : hasAwayRecord
          ? `최근 외출 기록 (${latestAwayNotification?.createdAtLabel || '확인됨'})`
          : '외출 기록 없음',
      checkOutStatus: hasCheckOutRecord
        ? `퇴실 기록 있음 (${latestCheckOutNotification?.createdAtLabel || '확인됨'})`
        : '퇴실 기록 없음',
    };
  }, [
    attendanceCurrent?.status,
    latestAwayNotification?.createdAtLabel,
    latestCheckOutNotification?.createdAtLabel,
    latestStudySnapshot?.studyDateLabel,
    latestStudySnapshot?.studyStartLabel,
    todayLog?.totalMinutes,
  ]);

  const penaltyMeta = useMemo(() => {
    const points = penaltyRecovery.effectivePoints;
    if (points >= 20) return { label: '퇴원', badge: 'bg-rose-200 text-rose-800 border-rose-300' };
    if (points >= 12) return { label: '학부모 상담', badge: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (points >= 7) return { label: '선생님과 상담', badge: 'bg-orange-100 text-orange-800 border-orange-300' };
    return { label: '정상', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }, [penaltyRecovery.effectivePoints]);

  const selectedDateLog = useMemo(() => {
    if (!selectedDateKey) return null;
    return (allLogs || []).find((log) => log.dateKey === selectedDateKey) || null;
  }, [allLogs, selectedDateKey]);

  const parentCommunications = useMemo(() => {
    if (!rawParentCommunications) return [];
    return [...rawParentCommunications].sort((a, b) => {
      const aMs = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
      const bMs = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
      return bMs - aMs;
    });
  }, [rawParentCommunications]);

  const parentAnnouncements = useMemo(() => {
    const centerItems = (rawCenterAnnouncements || []).filter((item) => {
      const audience = item.audience || 'parent';
      return audience === 'parent' || audience === 'all';
    });
    const legacyItems = rawLegacyParentAnnouncements || [];

    const merged = [...centerItems, ...legacyItems];
    const dedupedById = new Map<string, ParentAnnouncementRecord>();
    merged.forEach((item) => {
      if (item?.id) dedupedById.set(item.id, item);
    });

    return Array.from(dedupedById.values())
      .filter((item) => (item.status || 'published') === 'published')
      .sort((a, b) => {
        const aMs = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const bMs = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return bMs - aMs;
      });
  }, [rawCenterAnnouncements, rawLegacyParentAnnouncements]);

  const parentAnnouncementsLoading = centerAnnouncementsLoading || legacyParentAnnouncementsLoading;

  const selectedDateStudyPlans = useMemo(
    () => (selectedDatePlans || []).filter((item) => item.category === 'study' || !item.category),
    [selectedDatePlans]
  );
  const selectedDatePlanTotal = selectedDateStudyPlans.length;
  const selectedDatePlanDone = selectedDateStudyPlans.filter((item) => item.done).length;
  const selectedDatePlanRate = selectedDatePlanTotal > 0 ? Math.round((selectedDatePlanDone / selectedDatePlanTotal) * 100) : 0;
  const selectedDateLp = Number(growth?.dailyLpStatus?.[selectedDateKey]?.dailyLpAmount || 0);
  const selectedDateRequest = useMemo(
    () => (attendance요청 || []).find((request) => request.date === selectedDateKey),
    [attendance요청, selectedDateKey]
  );

  const readNotification = async (notification: ParentNotificationItem) => {
    setReadMap((prev) => ({ ...prev, [notification.id]: true }));
    void logParentActivity('app_visit', { source: 'notification_read', notificationId: notification.id, notificationType: notification.type });
  };

  const openNotificationDetail = async (notification: ParentNotificationItem) => {
    await readNotification(notification);
    setSelectedNotification(notification);
  };

  const handleTabChange = (value: string) => {
    const nextTab = (value === 'life' ? 'data' : value) as ParentPortalTab;
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('parentTab', nextTab);
    router.replace(`${pathname}?${params.toString()}`);
    void logParentActivity('app_visit', { source: 'tab_change', tab: nextTab });
  };

  const handleOpenReportsArchive = () => {
    setSelectedChildReport(reportsArchive[0] || null);
    setIsReportArchiveOpen(true);
  };

  const handleSelectChildReport = async (target: DailyReport) => {
    setSelectedChildReport(target);
    if (!firestore || !centerId || !target?.id || target.viewedAt) return;
    updateDoc(doc(firestore, 'centers', centerId, 'dailyReports', target.id), {
      viewedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).catch((error) => {
      console.warn('[parent-dashboard] report viewed update failed', error);
    });
  };

  async function submit(type: 'consultation' | 'request' | 'suggestion') {
    if (!firestore || !centerId || !studentId || !user) return;
    let title = '';
    let body = '';
    if (type === 'consultation') {
      title = `상담 신청 (${channel === 'visit' ? '방문' : channel === 'phone' ? '전화' : '온라인'})`;
      body = requestText.trim();
      if (!body) { toast({ variant: 'destructive', title: '입력 확인', description: '상담 요청 내용을 입력해주세요.' }); return; }
    }
    if (type === 'request') {
      title = QUICK_REQUEST_TEMPLATES[quickType];
      body = requestText.trim() || title;
    }
    if (type === 'suggestion') {
      title = '건의사항';
      body = suggestionText.trim();
      if (!body) { toast({ variant: 'destructive', title: '입력 확인', description: '건의사항을 입력해주세요.' }); return; }
    }
    setSubmitting(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'parentCommunications'), {
        studentId, parentUid: user.uid, parentName: user.displayName || '학부모',
        senderRole: 'parent', senderUid: user.uid, senderName: user.displayName || '학부모',
        type, title, body, channel: type === 'consultation' ? channel : null,
        requestCategory: type === 'suggestion' ? 'suggestion' : 'request',
        status: 'requested', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });

      const eventType: ParentActivityEvent['eventType'] =
        type === 'consultation' ? 'consultation_request' : type;
      await logParentActivity(eventType, {
        title,
        channel: type === 'consultation' ? channel : null,
        quickType: type === 'request' ? quickType : null,
      });

      toast({ title: '전송 완료', description: '선생님께 요청이 정상적으로 전달되었습니다.' });
      setRequestText(''); setSuggestionText('');
    } catch (error) {
      toast({ variant: 'destructive', title: '전송 실패', description: '통신 오류가 발생했습니다.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitParentInquiry() {
    if (!firestore || !centerId || !studentId || !user) return;
    const body = parentInquiryBody.trim();
    if (!body) {
      toast({ variant: 'destructive', title: '입력 확인', description: '문의 내용을 입력해 주세요.' });
      return;
    }

    const type: ParentCommunicationRecord['type'] = parentInquiryType === 'suggestion' ? 'suggestion' : 'request';
    const fallbackTitle =
      parentInquiryType === 'question'
        ? '학부모 질의'
        : parentInquiryType === 'request'
          ? '학부모 요청사항'
          : '학부모 건의사항';

    setSubmitting(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'parentCommunications'), {
        studentId,
        parentUid: user.uid,
        parentName: user.displayName || '학부모',
        senderRole: 'parent',
        senderUid: user.uid,
        senderName: user.displayName || '학부모',
        type,
        requestCategory: parentInquiryType,
        title: parentInquiryTitle.trim() || fallbackTitle,
        body,
        status: 'requested',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      void logParentActivity(parentInquiryType === 'suggestion' ? 'suggestion' : 'request', {
        title: parentInquiryTitle.trim() || fallbackTitle,
        requestCategory: parentInquiryType,
      });

      toast({ title: '등록 완료', description: '선생님 또는 센터관리자에게 전달되었습니다.' });
      setParentInquiryType('question');
      setParentInquiryTitle('');
      setParentInquiryBody('');
    } catch (error) {
      toast({ variant: 'destructive', title: '등록 실패', description: '통신 오류가 발생했습니다.' });
    } finally {
      setSubmitting(false);
    }
  }

  const getParentCommunicationTypeBadge = (item: ParentCommunicationRecord) => {
    if (item.type === 'consultation') {
      return <Badge variant="outline" className="border-none bg-blue-100 text-blue-700 font-black text-[10px]">상담 요청</Badge>;
    }
    if (item.requestCategory === 'question') {
      return <Badge variant="outline" className="border-none bg-sky-100 text-sky-700 font-black text-[10px]">질의사항</Badge>;
    }
    if (item.type === 'suggestion' || item.requestCategory === 'suggestion') {
      return <Badge variant="outline" className="border-none bg-violet-100 text-violet-700 font-black text-[10px]">건의사항</Badge>;
    }
    return <Badge variant="outline" className="border-none bg-amber-100 text-amber-700 font-black text-[10px]">요청사항</Badge>;
  };

  const getParentCommunicationStatusBadge = (status?: string) => {
    if (status === 'done') {
      return <Badge variant="outline" className="border-none bg-emerald-100 text-emerald-700 font-black text-[10px]">답변 완료</Badge>;
    }
    if (status === 'in_progress') {
      return <Badge variant="outline" className="border-none bg-blue-100 text-blue-700 font-black text-[10px]">처리 중</Badge>;
    }
    if (status === 'in_review') {
      return <Badge variant="outline" className="border-none bg-amber-100 text-amber-700 font-black text-[10px]">검토 중</Badge>;
    }
    return <Badge variant="secondary" className="font-black text-[10px]">접수됨</Badge>;
  };

  if (!isActive) return null;

  return (
    <div className={cn("space-y-4 pb-24", isMobile ? "px-0" : "max-w-4xl mx-auto px-4")}>
      <Card className="overflow-hidden rounded-[2.5rem] border-none bg-white shadow-2xl ring-1 ring-slate-200/60 transition-all duration-500">
        <CardContent className={cn('p-6 space-y-6')}>
          <div className="flex flex-col gap-1 px-1">
            <CardTitle className="font-aggro-display text-[1.85rem] font-black tracking-[-0.02em] text-[#14295F] leading-[1.1]">
              {student?.name || '자녀'} 학생 현황
            </CardTitle>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              {today && format(today, 'yyyy. MM. dd (EEEE)', {locale: ko})}
              <span className="opacity-30">|</span>
              <span className="text-[#FF7A16]">실시간 업데이트 중</span>
            </p>
          </div>

          <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
            <TabsContent value="home" className="mt-0 space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-2xl border border-[#cfdcf8] bg-[linear-gradient(135deg,#e8f1ff_0%,#f6f9ff_100%)] p-4 text-center space-y-1 shadow-sm group hover:shadow-md hover:ring-1 hover:ring-[#c4d5ff] transition-all">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">오늘 공부</span>
                  <p className="dashboard-number text-xl text-[#14295F] leading-tight whitespace-nowrap">{toHm(totalMinutes)}</p>
                </Card>
                <Card className="rounded-2xl border border-[#ffcfa0] bg-[linear-gradient(135deg,#fff2e4_0%,#fff9f2_100%)] p-4 text-center space-y-1 shadow-sm group hover:shadow-md hover:ring-1 hover:ring-[#ffbf8a] transition-all">
                  <span className="text-[10px] font-black text-[#FF7A16] uppercase tracking-widest">계획 달성</span>
                  <p className="dashboard-number text-2xl text-[#14295F] leading-tight">{planRate}%</p>
                </Card>
                <Card className={cn(
                  "rounded-2xl border border-[#d7e3fb] bg-[linear-gradient(135deg,#eef4ff_0%,#ffffff_100%)] p-4 text-center space-y-1 shadow-sm transition-all",
                  attendanceStatus.color
                )}>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">출결 상태</span>
                  <p className="text-lg font-black leading-tight">{attendanceStatus.label.split(' ')[0]}</p>
                </Card>
                <Card
                  className="rounded-2xl border border-[#ffcfa0] bg-[linear-gradient(135deg,#fff3e6_0%,#fff9f4_100%)] p-4 text-center space-y-1 shadow-sm transition-all hover:ring-1 hover:ring-[#ffc593] cursor-pointer"
                  role="button"
                  onClick={() => setIsPenaltyGuideOpen(true)}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">벌점 지수</span>
                  <div className="flex items-center justify-center gap-1">
                    <p className="dashboard-number text-xl text-rose-700 leading-tight">{penaltyRecovery.effectivePoints}</p>
                    <span className="text-xs font-black text-rose-500/70">점</span>
                  </div>
                  <Badge variant="outline" className={cn('h-5 border px-2 text-[10px] font-black', penaltyMeta.badge)}>{penaltyMeta.label}</Badge>
                  {penaltyRecovery.recoveredPoints > 0 && (
                    <p className="text-[10px] font-bold text-rose-500/80">자동 회복 -{penaltyRecovery.recoveredPoints}점 반영</p>
                  )}
                </Card>
              </div>

              <Card
                role="button"
                tabIndex={0}
                onClick={handleOpenReportsArchive}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleOpenReportsArchive();
                  }
                }}
                className="rounded-[2rem] border border-[#d7e3fb] bg-[linear-gradient(145deg,#eef4ff_0%,#f5f9ff_55%,#fff4e8_100%)] p-6 ring-1 ring-[#d7e3fb]/70 relative overflow-hidden group shadow-sm cursor-pointer active:scale-[0.99] transition-transform"
              >
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:rotate-12 transition-transform duration-700">
                  <MessageCircle className="h-20 w-20 text-[#14295F]" />
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#FF7A16] fill-current" />
                    <span className="text-[10px] font-black text-[#14295F] uppercase tracking-widest">우리아이 리포트 확인하기</span>
                  </div>
                  {report?.viewedAt && <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-none font-black text-[10px] h-4 px-1.5">읽음</Badge>}
                </div>
                <p className="text-sm font-bold text-slate-800 leading-relaxed break-keep relative z-10 line-clamp-2">
                    {report?.content || '카드를 누르면, 우리 아이가 받은 리포트를 확인할 수 있습니다.'}
                </p>
              </Card>

              <Card className="rounded-[2rem] border border-[#d7e3fb] bg-[linear-gradient(145deg,#f7faff_0%,#ffffff_70%,#fff7ef_100%)] p-5 shadow-sm">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[#14295F]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">최근 알림 3개</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadRecentCount > 0 && (
                      <Badge variant="outline" className="h-5 border-none bg-[#FF7A16]/15 px-2 text-[10px] font-black text-[#FF7A16] animate-pulse">
                        미읽음 {unreadRecentCount}
                      </Badge>
                    )}
                    <Badge variant="outline" className="h-5 border border-slate-200 bg-slate-50 px-2 text-[10px] font-black text-slate-500">
                      {recentNotifications.length}건
                    </Badge>
                  </div>
                </div>
                <p className="mb-3 text-[11px] font-bold text-slate-500">알림 카드를 누르면 상세 내용을 읽을 수 있어요.</p>
                {recentNotifications.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-[11px] font-bold text-slate-400">
                    최근 알림이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentNotifications.map((notification) => {
                      const isRead = notification.isRead || !!readMap[notification.id];
                      return (
                        <button
                          type="button"
                          key={notification.id}
                          className={cn(
                            'relative w-full overflow-hidden rounded-2xl border p-3 text-left transition-all',
                            isRead
                              ? 'border-[#dbe4f8] bg-[#f3f7ff]'
                              : 'border-[#ffcf9e] bg-[linear-gradient(135deg,#fff5ea_0%,#eef4ff_100%)] shadow-sm ring-1 ring-[#ffd29f]/80 hover:shadow-md'
                          )}
                          onClick={() => void openNotificationDetail(notification)}
                        >
                          {!isRead && (
                            <>
                              <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-[#FF7A16]/20 blur-xl animate-pulse" />
                              <Sparkles className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 text-[#FF7A16] animate-pulse" />
                            </>
                          )}
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="truncate pr-6 text-sm font-black tracking-tight text-[#14295F]">{notification.title}</p>
                            <div className="flex shrink-0 items-center gap-1">
                              {!isRead && (
                                <span className="relative inline-flex h-2.5 w-2.5">
                                  <span className="absolute inline-flex h-full w-full rounded-full bg-[#FF7A16] opacity-70 animate-ping" />
                                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#FF7A16]" />
                                </span>
                              )}
                              {notification.isImportant && (
                                <Badge variant="outline" className="h-5 shrink-0 border-none bg-orange-100 px-2 text-[10px] font-black text-[#FF7A16]">
                                  중요
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            {notification.createdAtLabel} · {isRead ? '읽음' : '미확인'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
              <div className="grid grid-cols-1 gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="w-full h-14 rounded-2xl bg-[#14295F] text-white hover:bg-[#14295F]/90 font-black gap-2 text-base shadow-xl active:scale-[0.98] transition-all">
                      <TrendingUp className="h-5 w-5" /> 인공지능 학습 인사이트 보기 <ChevronRight className="h-4 w-4 ml-auto opacity-40" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md">
                    <div className="bg-[#14295F] p-10 text-white relative">
                      <Sparkles className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20" />
                      <DialogTitle className="text-2xl font-black tracking-tighter text-white">인공지능 학습 인사이트</DialogTitle>
                      <DialogDescription className="text-white/70 font-bold mt-1 text-xs">자녀의 학습 패턴을 인공지능이 정밀 분석했습니다.</DialogDescription>
                    </div>
                    <div className="p-6 space-y-3 bg-[#fafafa]">
                      {aiInsights.map((insight, i) => (
                        <div key={i} className="flex items-start gap-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-orange-200">
                          <div className="h-2 w-2 rounded-full bg-[#FF7A16] mt-2 shrink-0" />
                          <p className="text-sm font-bold text-slate-700 leading-relaxed">{insight}</p>
                        </div>
                      ))}
                    </div>
                    <DialogFooter className="p-6 bg-white border-t">
                      <DialogClose asChild><Button className="w-full h-14 rounded-2xl font-black text-lg bg-[#14295F] text-white">확인했습니다</Button></DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            <TabsContent value="studyDetail" className="mt-0 space-y-6 animate-in fade-in duration-500">
              {/* 주간 성과 요약 (기존 리포트 내용 통합) */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-[1.5rem] border-none bg-white p-4 ring-1 ring-slate-100 text-center shadow-sm">
                  <span className="text-[10px] font-black text-slate-500 block mb-2 uppercase tracking-widest">주간 누적 트랙</span>
                  <div className="flex items-baseline justify-center gap-0.5 flex-wrap leading-tight">
                    {Math.floor(weeklyTotalStudyMinutes / 60) > 0 && (
                      <>
                        <span className="dashboard-number text-2xl text-[#14295F] tabular-nums leading-none">{Math.floor(weeklyTotalStudyMinutes / 60)}</span>
                        <span className="text-[11px] font-black text-[#14295F]/50 mr-0.5">시간</span>
                      </>
                    )}
                    <span className="dashboard-number text-2xl text-[#14295F] tabular-nums leading-none">{(weeklyTotalStudyMinutes % 60).toString().padStart(2, '0')}</span>
                    <span className="text-[11px] font-black text-[#14295F]/50">분</span>
                  </div>
                </Card>
                <Card className="rounded-[1.5rem] border-none bg-white p-6 ring-1 ring-slate-100 text-center shadow-sm">
                  <span className="text-[10px] font-black text-slate-500 block mb-2 uppercase tracking-widest">평균 목표 달성</span>
                  <p className="dashboard-number text-2xl text-[#FF7A16]">{weeklyPlanCompletionRate}%</p>
                </Card>
              </div>

              <div className="flex items-center justify-between px-1">
                <div className="flex flex-col">
                  <h3 className="text-xl font-black tracking-tighter text-[#14295F]">기록트랙</h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">학습 일관성 맵</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentCalendarDate(subMonths(currentCalendarDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-[11px] font-black min-w-[80px] text-center">{format(currentCalendarDate, 'yyyy년 M월')}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentCalendarDate(addMonths(currentCalendarDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>

              <Card className="rounded-[2.5rem] border-2 border-[#14295F]/5 bg-white shadow-xl ring-1 ring-black/[0.03] overflow-hidden">
                <div className={cn(
                  "grid grid-cols-7 border-b-2 border-[#14295F]/10",
                  isMobile ? "bg-slate-50" : "bg-gradient-to-r from-slate-50 via-white to-slate-50"
                )}>
                  {['월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
                    <div key={day} className={cn(
                      isMobile ? "py-3 text-[10px]" : "py-4 text-[11px]",
                      "text-center font-black uppercase tracking-widest",
                      i === 5 ? "text-blue-600" : i === 6 ? "text-rose-600" : "text-[#14295F]/75"
                    )}>{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 auto-rows-fr bg-[radial-gradient(circle_at_top_left,rgba(20,41,95,0.02),transparent_45%)]">
                  {logsLoading ? (
                    <div className="col-span-7 h-[300px] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#14295F] opacity-20" /></div>
                  ) : calendarData.map((day, idx) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const log = allLogs?.find(l => l.dateKey === dateKey);
                    const minutes = log?.totalMinutes || 0;
                    const isCurrentMonth = isSameMonth(day, currentCalendarDate);
                    const isTodayCalendar = isSameDay(day, new Date());
                    const hasPlans = (weeklyPlans || []).some((plan) => plan.dateKey === dateKey);
                    const progressPercent = getFocusProgress(minutes);
                    const hour = Math.floor(minutes / 60);
                    const minuteRemainder = minutes % 60;

                    return (
                      <button
                        type="button"
                        key={dateKey}
                        onClick={() => setSelectedCalendarDate(day)}
                        className={cn(
                          "relative text-left border-r-2 border-b-2 border-[#14295F]/5 transition-all cursor-pointer group overflow-hidden",
                          isMobile ? "aspect-square p-1.5" : "min-h-[156px] p-3.5",
                          !isCurrentMonth ? "opacity-[0.14] grayscale bg-slate-100" : getHeatmapColor(minutes),
                          isTodayCalendar && "ring-4 ring-inset ring-[#FF7A16]/35 z-10 shadow-lg scale-[1.01] rounded-xl"
                        )}
                      >
                        {!isMobile && isCurrentMonth && minutes > 0 && (
                          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/35 to-transparent pointer-events-none" />
                        )}
                        <div className={cn("flex justify-between items-start", isMobile ? "mb-1" : "mb-2.5")}>
                          <span
                            className={cn(
                              "font-black tracking-tighter tabular-nums rounded-full",
                              isMobile ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1",
                              idx % 7 === 5 && isCurrentMonth ? "text-blue-700 bg-blue-50/90" : idx % 7 === 6 && isCurrentMonth ? "text-rose-700 bg-rose-50/90" : "text-[#14295F]/80 bg-white/85",
                              isTodayCalendar && "text-[#14295F] scale-110"
                            )}
                          >
                            {format(day, 'd')}
                          </span>
                          <div className="flex flex-col items-end gap-1">
                            {minutes >= 180 && <Zap className={cn("text-orange-500 fill-orange-500", isMobile ? "h-2.5 w-2.5" : "h-3.5 w-3.5")} />}
                            {hasPlans && <div className={cn("rounded-full bg-[#14295F]/35", isMobile ? "h-1.5 w-1.5" : "h-2 w-2")} />}
                          </div>
                        </div>
                        {isMobile ? (
                          <div className="absolute inset-x-0.5 bottom-1">
                            <div
                              className={cn(
                                "rounded-md border text-center font-mono font-black tabular-nums py-0.5 leading-tight text-[10px] tracking-tighter whitespace-nowrap",
                                minutes > 0 ? "text-[#14295F] bg-white/90 border-white/80 shadow-sm" : "text-slate-500 bg-white/75 border-white/60"
                              )}
                            >
                              {isCurrentMonth ? formatMinutes(minutes) : '--'}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2.5 flex flex-col gap-2">
                            {isCurrentMonth && minutes > 0 ? (
                              <>
                                <span className="dashboard-number text-2xl text-[#14295F]">
                                  {formatMinutes(minutes)}
                                </span>
                                <div className="h-1.5 w-full rounded-full bg-white/55 overflow-hidden">
                                  <div className="h-full rounded-full bg-[#14295F]/80" style={{ width: progressPercent + '%' }} />
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-black text-[#14295F]/85">
                                  <span>{progressPercent}% 집중도</span>
                                  <span>{hour}시간 {minuteRemainder.toString().padStart(2, '0')}분</span>
                                </div>
                              </>
                            ) : (
                              <span className="mt-auto text-[11px] font-bold text-slate-500">기록 없음</span>
                            )}
                          </div>
                        )}
                        {isTodayCalendar && (
                          <div className="absolute bottom-1 right-1">
                            <div className="bg-[#14295F] text-white p-0.5 rounded-full shadow-lg">
                              <Activity className="h-1.5 w-1.5" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-[1.5rem] border-none shadow-sm bg-white p-5 ring-1 ring-slate-100">
                  <CardTitle className="text-[10px] font-black tracking-tight mb-4 flex items-center gap-2 text-slate-500 uppercase">
                    <PieChartIcon className="h-3.5 w-3.5 text-[#FF7A16]" /> 과목별 학습 비중
                  </CardTitle>
                  <div className="space-y-4">
                    {subjectsData.slice(0, 2).map((s) => {
                      const ratio = Math.min(100, Math.round((s.minutes / (subjectTotalMinutes || 1)) * 100));
                      return (
                        <div key={s.subject} className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                            <span>{s.subject}</span>
                            <span className="font-black">{ratio}%</span>
                          </div>
                          <Progress value={ratio} className="h-1 bg-slate-100" />
                        </div>
                      );
                    })}
                  </div>
                </Card>

                <Dialog>
                  <DialogTrigger asChild>
                    <Card className="rounded-[1.5rem] border border-orange-200 bg-orange-50 p-5 flex flex-col justify-center items-center text-center gap-2 cursor-pointer active:scale-95 transition-all">
                      <BarChart3 className="h-6 w-6 text-[#FF7A16]" />
                      <div className="grid gap-0.5 text-[#14295F]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#B85A00]">주간 상세</span>
                        <span className="text-xs font-black">성과 상세 분석</span>
                      </div>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-lg">
                    <div className="bg-[#14295F] p-10 text-white relative">
                      <DialogTitle className="text-3xl font-black tracking-tighter text-left text-white">주간 성과 데이터</DialogTitle>
                      <DialogDescription className="text-white/70 font-bold mt-1 text-sm">최근 7일간의 학습 지표 및 피드백입니다.</DialogDescription>
                    </div>
                    <div className="p-8 space-y-10 bg-white overflow-y-auto max-h-[60vh] custom-scrollbar">
                      <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase text-[#14295F] tracking-[0.2em] ml-1">일별 집중 시간 (분)</h4>
                        <div className="h-48 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsLineChart data={dailyStudyTrend}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                              <XAxis dataKey="date" fontSize={10} fontWeight="800" axisLine={false} tickLine={false} />
                              <YAxis fontSize={10} fontWeight="800" axisLine={false} tickLine={false} width={30} />
                              <Tooltip contentStyle={{borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)'}} />
                              <Line type="monotone" dataKey="minutes" stroke="#FF7A16" strokeWidth={4} dot={{ r: 4, fill: '#fff', stroke: '#FF7A16', strokeWidth: 2 }} />
                            </RechartsLineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="p-6 rounded-[2rem] bg-orange-50/50 border border-orange-100">
                        <p className="text-[10px] font-black text-[#FF7A16] uppercase mb-2 tracking-widest">선생님 종합 피드백</p>
                        <p className="text-base font-bold text-slate-700 leading-relaxed">"{weeklyFeedback}"</p>
                      </div>
                    </div>
                    <DialogFooter className="p-6 bg-white border-t">
                      <DialogClose asChild><Button className="w-full h-14 rounded-2xl font-black text-lg bg-[#14295F] text-white">확인 완료</Button></DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            <TabsContent value="data" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <Card
                className="rounded-[2rem] border border-rose-100 bg-rose-50/30 p-6 shadow-sm cursor-pointer"
                role="button"
                onClick={() => setIsPenaltyGuideOpen(true)}
              >
                <div className="flex items-center justify-between">
                  <div className="grid gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">누적 벌점 지수</span>
                    <h3 className="dashboard-number text-4xl text-rose-900">
                      {penaltyRecovery.effectivePoints}
                      <span className="ml-1 text-lg opacity-40">점</span>
                    </h3>
                    <p className="text-[11px] font-bold text-rose-700/80">
                      원점수 {penaltyRecovery.basePoints}점 · 회복 {penaltyRecovery.recoveredPoints}점
                    </p>
                  </div>
                  <Badge variant="outline" className={cn('h-8 rounded-full border px-4 text-xs font-black shadow-sm', penaltyMeta.badge)}>
                    {penaltyMeta.label}
                  </Badge>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">주간 학습시간</span>
                    <Badge variant="outline" className="text-[10px] font-black">최근 6주</Badge>
                  </div>
                  <div className="relative h-[190px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyStudyTimeTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
                        <XAxis dataKey="label" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis width={32} fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 60)}h`} />
                        <Tooltip formatter={(value) => [toHm(Number(value || 0)), '주간 누적']} />
                        <Bar dataKey="totalMinutes" fill="#14295F" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    {!hasWeeklyStudyTimeTrend && (
                      <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-lg border border-dashed bg-white/80 px-2 py-1.5 text-center text-[10px] font-bold text-slate-400">
                        주간 데이터 수집 중입니다.
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">일간 학습시간</span>
                    <Badge variant="outline" className="text-[10px] font-black">최근 7일</Badge>
                  </div>
                  <div className="relative h-[190px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={dailyStudyTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
                        <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis width={30} fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 60)}h`} />
                        <Tooltip formatter={(value) => [toHm(Number(value || 0)), '일간 학습']} />
                        <Line type="monotone" dataKey="minutes" stroke="#FF7A16" strokeWidth={3} dot={{ r: 3, fill: '#FF7A16' }} />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                    {!hasDailyStudyTrend && (
                      <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-lg border border-dashed bg-white/80 px-2 py-1.5 text-center text-[10px] font-bold text-slate-400">
                        일간 데이터 수집 중입니다.
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">학습 리듬 점수</span>
                    <Badge variant="outline" className="text-[10px] font-black">평균 {rhythmScore}점</Badge>
                  </div>
                  <div className="relative h-[190px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={rhythmScoreTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8edf5" />
                        <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis width={30} fontSize={10} axisLine={false} tickLine={false} domain={[0, 100]} />
                        <Tooltip formatter={(value) => [`${Number(value || 0)}점`, '리듬 점수']} />
                        <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#10b981' }} />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                    {!hasRhythmScoreTrend && (
                      <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-lg border border-dashed bg-white/80 px-2 py-1.5 text-center text-[10px] font-bold text-slate-400">
                        리듬 점수 데이터 수집 중입니다.
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">공부 시작/종료 시각</span>
                    <Badge variant="outline" className="text-[10px] font-black">최근 7일</Badge>
                  </div>
                  <div className="relative h-[190px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={startEndTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
                        <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis width={44} fontSize={10} axisLine={false} tickLine={false} domain={rhythmYAxisDomain} tickFormatter={(v) => toClockLabel(Number(v))} />
                        <Tooltip formatter={(value: number, name: string) => [toClockLabel(Number(value || 0)), name === 'startMinutes' ? '시작시각' : '종료시각']} />
                        <Line type="monotone" dataKey="startMinutes" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 2.5, fill: '#0ea5e9' }} />
                        <Line type="monotone" dataKey="endMinutes" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 2.5, fill: '#8b5cf6' }} />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                    {!hasStartEndTrend && (
                      <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-lg border border-dashed bg-white/80 px-2 py-1.5 text-center text-[10px] font-bold text-slate-400">
                        시작/종료 시각 데이터 수집 중입니다.
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">외출시간 그래프</span>
                    <Badge variant="outline" className="text-[10px] font-black">최근 7일</Badge>
                  </div>
                  <div className="relative h-[190px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={awayTimeTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
                        <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis width={30} fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}m`} />
                        <Tooltip formatter={(value) => [`${Math.round(Number(value || 0))}분`, '외출시간']} />
                        <Bar dataKey="awayMinutes" fill="#ef4444" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    {!hasAwayTrend && (
                      <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-lg border border-dashed bg-white/80 px-2 py-1.5 text-center text-[10px] font-bold text-slate-400">
                        외출시간 데이터 수집 중입니다.
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">과목별 학습시간</span>
                    <Badge variant="outline" className="text-[10px] font-black">{subjectsData.length}과목</Badge>
                  </div>
                  <div className="relative h-[190px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={subjectsData.slice(0, 6)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf2f7" />
                        <XAxis dataKey="subject" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis width={30} fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 60)}h`} />
                        <Tooltip formatter={(value) => [toHm(Number(value || 0)), '과목 학습시간']} />
                        <Bar dataKey="minutes" fill="#14295F" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    {subjectsData.length === 0 && (
                      <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-lg border border-dashed bg-white/80 px-2 py-1.5 text-center text-[10px] font-bold text-slate-400">
                        과목별 데이터가 없습니다.
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <div className="space-y-3 px-1">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-slate-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">최근 생활/출결 이슈</span>
                </div>
                <div className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">최근 공부일자</p>
                    <p className="mt-1 text-sm font-black text-slate-800">{recentLifeAttendanceSummary.recentStudyDate}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">공부 시작 시각</p>
                    <p className="mt-1 text-sm font-black text-slate-800">{recentLifeAttendanceSummary.recentStudyStart}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">외출 여부</p>
                    <p className="mt-1 text-sm font-black text-slate-800">{recentLifeAttendanceSummary.awayStatus}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">퇴실 여부</p>
                    <p className="mt-1 text-sm font-black text-slate-800">{recentLifeAttendanceSummary.checkOutStatus}</p>
                  </div>
                </div>
                {recentPenaltyReasons.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-center text-xs font-bold text-slate-400">
                    기록된 특이사항이 없습니다.
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {recentPenaltyReasons.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:border-rose-200">
                        <div className="grid gap-1">
                          <span className="text-sm font-bold text-slate-800">{r.reason}</span>
                          <span className="text-[10px] font-black text-slate-400">{r.dateLabel} · 규정 준수 안내</span>
                        </div>
                        <Badge variant="outline" className="border-none bg-rose-100 px-3 py-1 text-xs font-black text-rose-700">
                          <span className="font-numeric">+{r.points}</span>점
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="communication" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <Dialog>
                <DialogTrigger asChild>
                  <Card
                    className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-slate-100 cursor-pointer transition-all hover:shadow-2xl active:scale-[0.99]"
                    role="button"
                  >
                    <CardTitle className="text-lg font-black tracking-tighter mb-2 flex items-center gap-2 text-[#14295F]">
                      <Megaphone className="h-5 w-5 text-[#14295F]" />
                      센터 공지사항
                    </CardTitle>
                    <CardDescription className="mb-4 font-bold text-sm text-slate-500">
                      클릭하면 전체 공지사항을 팝업으로 확인할 수 있어요.
                    </CardDescription>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                      {parentAnnouncementsLoading ? (
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          불러오는 중...
                        </div>
                      ) : parentAnnouncements.length === 0 ? (
                        <p className="text-xs font-bold text-slate-400">등록된 공지사항이 없습니다.</p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs font-black text-[#14295F]">총 {parentAnnouncements.length}건</p>
                          <p className="line-clamp-1 text-xs font-bold text-slate-600">
                            최신 공지: {parentAnnouncements[0]?.title || '공지'}
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                </DialogTrigger>
                <DialogContent className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-3xl">
                  <div className="bg-[#14295F] p-6 text-white">
                    <DialogTitle className="text-xl font-black tracking-tight">센터 공지사항</DialogTitle>
                    <DialogDescription className="mt-1 text-xs font-bold text-white/70">
                      센터관리자가 등록한 공지를 시간순으로 확인할 수 있습니다.
                    </DialogDescription>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto bg-white p-5 sm:p-6">
                    {parentAnnouncementsLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                      </div>
                    ) : parentAnnouncements.length === 0 ? (
                      <div className="rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50/60 py-16 text-center">
                        <p className="text-sm font-black text-slate-400">등록된 공지사항이 없습니다.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {parentAnnouncements.map((item) => {
                          const createdAt = item.createdAt?.toDate?.() || item.updatedAt?.toDate?.();
                          return (
                            <div key={item.id} className="rounded-[1.75rem] border border-slate-100 bg-slate-50/50 p-5 shadow-sm">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="text-base font-black text-[#14295F]">{item.title || '공지'}</h3>
                                <Badge variant="outline" className="h-5 border-slate-200 bg-white px-2 text-[10px] font-black text-slate-600">
                                  공지
                                </Badge>
                              </div>
                              <p className="mt-1 text-[11px] font-bold text-slate-400">
                                {createdAt ? format(createdAt, 'yyyy.MM.dd HH:mm') : '시간 정보 없음'}
                              </p>
                              <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-4">
                                <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-700">
                                  {item.body?.trim() || '내용이 없습니다.'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-slate-100">
                <CardTitle className="text-lg font-black tracking-tighter mb-6 flex items-center gap-2 text-[#14295F]"><Send className="h-5 w-5 text-[#14295F]" /> 상담 및 지원 요청</CardTitle>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상담 채널</Label>
                    <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold text-sm shadow-sm"><SelectValue placeholder="상담 채널 선택" /></SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="visit" className="font-bold py-3 text-sm">🏫 센터 방문 상담</SelectItem>
                        <SelectItem value="phone" className="font-bold py-3 text-sm">📞 전화 상담</SelectItem>
                        <SelectItem value="online" className="font-bold py-3 text-sm">💻 온라인 상담</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">상담 내용</Label>
                    <Textarea className="min-h-[120px] rounded-[1.5rem] border-2 font-bold p-4 text-sm shadow-inner" value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="자녀의 학습이나 생활에 대해 궁금하신 점을 자유롭게 입력해 주세요." />
                  </div>
                  <Button className="w-full h-16 rounded-[1.5rem] bg-[#14295F] text-white font-black text-lg shadow-xl shadow-[#14295F]/20 active:scale-[0.98] transition-all" onClick={() => submit('consultation')} disabled={submitting}>요청 보내기</Button>
                </div>
              </Card>

              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-slate-100">
                <CardTitle className="text-lg font-black tracking-tighter mb-2 flex items-center gap-2 text-[#14295F]">
                  <MessageCircle className="h-5 w-5 text-[#FF7A16]" />
                  건의사항 · 질의 · 요청사항
                </CardTitle>
                <CardDescription className="mb-6 font-bold text-sm text-slate-500">
                  학부모님이 남긴 내용을 선생님 또는 센터관리자가 확인하고 답변드립니다.
                </CardDescription>
                <div className="space-y-4">
                  <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-[180px_minmax(0,1fr)]')}>
                    <div className="grid gap-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">유형 선택</Label>
                      <Select value={parentInquiryType} onValueChange={(value: 'question' | 'request' | 'suggestion') => setParentInquiryType(value)}>
                        <SelectTrigger className="h-12 rounded-xl border-2 font-bold text-sm shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-2xl">
                          <SelectItem value="question" className="font-bold py-3 text-sm">질의사항</SelectItem>
                          <SelectItem value="request" className="font-bold py-3 text-sm">요청사항</SelectItem>
                          <SelectItem value="suggestion" className="font-bold py-3 text-sm">건의사항</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid min-w-0 gap-2">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">제목</Label>
                      <Input
                        className="h-12 w-full rounded-xl border-2 font-bold text-sm shadow-sm"
                        value={parentInquiryTitle}
                        onChange={(e) => setParentInquiryTitle(e.target.value)}
                        placeholder={
                          parentInquiryType === 'question'
                            ? '예: 아이 숙제 진행 방식이 궁금합니다'
                            : parentInquiryType === 'request'
                              ? '예: 상담 일정 조정 요청'
                              : '예: 앱 알림 방식 개선 건의'
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">내용</Label>
                    <Textarea
                      className="min-h-[140px] rounded-[1.5rem] border-2 font-bold p-4 text-sm shadow-inner"
                      value={parentInquiryBody}
                      onChange={(e) => setParentInquiryBody(e.target.value)}
                      placeholder={
                        parentInquiryType === 'question'
                          ? '궁금하신 점을 자세히 남겨 주세요.'
                          : parentInquiryType === 'request'
                            ? '필요한 요청 내용을 구체적으로 적어 주세요.'
                            : '개선되면 좋을 점이나 건의사항을 남겨 주세요.'
                      }
                    />
                  </div>
                  <Button
                    className="w-full h-14 rounded-[1.5rem] bg-[#FF7A16] text-white font-black text-base shadow-xl shadow-[#FF7A16]/20 active:scale-[0.98] transition-all"
                    onClick={submitParentInquiry}
                    disabled={submitting || !parentInquiryBody.trim()}
                  >
                    전달하기
                  </Button>
                </div>
              </Card>

              <Dialog>
                <DialogTrigger asChild>
                  <Card
                    className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-slate-100 cursor-pointer transition-all hover:shadow-2xl active:scale-[0.99]"
                    role="button"
                  >
                    <CardTitle className="text-lg font-black tracking-tighter mb-2 flex items-center gap-2 text-[#14295F]">
                      <Bell className="h-5 w-5 text-[#14295F]" />
                      문의 내역과 답변
                    </CardTitle>
                    <CardDescription className="mb-4 font-bold text-sm text-slate-500">
                      클릭하면 지금까지 문의 내역과 답변을 팝업으로 확인할 수 있어요.
                    </CardDescription>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                      {parentCommunicationsLoading ? (
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          불러오는 중...
                        </div>
                      ) : parentCommunications.length === 0 ? (
                        <p className="text-xs font-bold text-slate-400">등록된 문의 내역이 없습니다.</p>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-xs font-black text-[#14295F]">
                            총 {parentCommunications.length}건
                          </p>
                          <p className="line-clamp-1 text-xs font-bold text-slate-600">
                            최근 문의: {parentCommunications[0]?.title || '학부모 문의'}
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                </DialogTrigger>
                <DialogContent className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-3xl">
                  <div className="bg-[#14295F] p-6 text-white">
                    <DialogTitle className="text-xl font-black tracking-tight">문의 내역과 답변</DialogTitle>
                    <DialogDescription className="mt-1 text-xs font-bold text-white/70">
                      지금까지 등록된 문의와 답변 내역입니다.
                    </DialogDescription>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto bg-white p-5 sm:p-6">
                    {parentCommunicationsLoading ? (
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                      </div>
                    ) : parentCommunications.length === 0 ? (
                      <div className="rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50/60 py-16 text-center">
                        <p className="text-sm font-black text-slate-400">등록된 문의 내역이 없습니다.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {parentCommunications.map((item) => {
                          const createdAt = item.createdAt?.toDate?.() || item.updatedAt?.toDate?.();
                          const repliedAt = item.repliedAt?.toDate?.();
                          return (
                            <div key={item.id} className="rounded-[1.75rem] border border-slate-100 bg-slate-50/50 p-5 shadow-sm">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {getParentCommunicationTypeBadge(item)}
                                    {getParentCommunicationStatusBadge(item.status)}
                                  </div>
                                  <h3 className="text-base font-black text-[#14295F]">{item.title || '학부모 문의'}</h3>
                                  <p className="text-[11px] font-bold text-slate-400">
                                    {createdAt ? format(createdAt, 'yyyy.MM.dd HH:mm') : '시간 정보 없음'}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
                                <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-700">
                                  {item.body?.trim() || '내용이 없습니다.'}
                                </p>
                              </div>

                              {item.replyBody ? (
                                <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                                  <p className="mb-1 text-[10px] font-black text-emerald-700">
                                    답변{item.repliedByName ? ` · ${item.repliedByName}` : ''}{repliedAt ? ` · ${format(repliedAt, 'yyyy.MM.dd HH:mm')}` : ''}
                                  </p>
                                  <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-emerald-900">
                                    {item.replyBody}
                                  </p>
                                </div>
                              ) : (
                                <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-[11px] font-bold text-slate-400">
                                  아직 답변이 등록되지 않았습니다.
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="billing" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <Card className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="text-4xl font-black tracking-tight text-[#14295F] leading-none">수납</h3>
                      <p className="text-[15px] font-bold text-slate-700 leading-snug">
                        <span className="block">센터수납요청건을 비대면으로</span>
                        <span className="block">결제할 수 있어요!</span>
                      </p>
                    </div>
                    <span className="shrink-0 text-[14px] font-black text-[#14295F]">실시간 연동</span>
                  </div>

                  {isMobile ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-black text-[#14295F]">청구금액</p>
                        {mobileBillingStatusMeta && (
                          <Badge variant="outline" className={cn('h-6 border px-2 text-[11px] font-black', mobileBillingStatusMeta.className)}>
                            {mobileBillingStatusMeta.label}
                          </Badge>
                        )}
                      </div>
                      <p className="dashboard-number mt-2 text-[1.05rem] leading-none text-[#14295F] whitespace-nowrap">
                        {formatWon(billingSummary.billed)}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3.5 text-center shadow-sm">
                        <p className="text-[12px] font-black text-[#14295F]">청구</p>
                        <p className="dashboard-number mt-1 text-[1.2rem] leading-none text-[#14295F] whitespace-nowrap">
                          {formatWon(billingSummary.billed)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 px-3 py-3.5 text-center shadow-sm">
                        <p className="text-[12px] font-black text-emerald-700">수납</p>
                        <p className="dashboard-number mt-1 text-[1.2rem] leading-none text-emerald-700 whitespace-nowrap">
                          {formatWon(billingSummary.paid)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-rose-200 bg-rose-50/40 px-3 py-3.5 text-center shadow-sm">
                        <p className="text-[12px] font-black text-rose-700">미납</p>
                        <p className="dashboard-number mt-1 text-[1.2rem] leading-none text-rose-700 whitespace-nowrap">
                          {formatWon(billingSummary.overdue)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {latestInvoice ? (
                <div className="space-y-3">
                  {displayInvoices.map((invoice) => {
                    const invoiceDueDate = toDateSafe((invoice as any).cycleEndDate);
                    const statusMeta = getInvoiceStatusMeta(invoice.status);

                    return (
                      <Card key={invoice.id} className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
                        <div className={cn("flex justify-between gap-3", isMobile ? "items-center" : "items-start")}>
                          <div className="space-y-2 min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <p className={cn("font-black tracking-tight text-[#14295F] min-w-0 truncate whitespace-nowrap", isMobile ? "text-[1.45rem] leading-none" : "text-[20px]")}>
                                {invoice.studentName || student?.name || '학생'}
                              </p>
                              <Badge variant="outline" className="h-6 border border-slate-200 bg-slate-50 px-2 text-[10px] font-black text-slate-600">
                                {getInvoiceTrackLabel(invoice.trackCategory)}
                              </Badge>
                              {statusMeta && (
                                <Badge variant="outline" className={cn('h-6 border px-2 text-[10px] font-black shrink-0', statusMeta.className)}>
                                  {isMobile ? statusMeta.mobileLabel : statusMeta.label}
                                </Badge>
                              )}
                            </div>
                            <p className="text-[15px] font-bold text-slate-600">
                              결제 마감일 {invoiceDueDate ? format(invoiceDueDate, 'yyyy.MM.dd', { locale: ko }) : '-'}
                            </p>
                          </div>
                          <p className={cn("dashboard-number leading-none text-[#14295F] whitespace-nowrap shrink-0", isMobile ? "text-[1.9rem]" : "text-[2.05rem]")}>
                            {formatWon(Number(invoice.finalPrice || 0))}
                          </p>
                        </div>

                        {(invoice.status === 'issued' || invoice.status === 'overdue') && (
                          <Link
                            href={`/payment/checkout/${invoice.id}`}
                            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#14295F] text-[15px] font-black text-white shadow-sm transition-colors hover:bg-[#10224f]"
                          >
                            <CreditCard className="h-4 w-4" />
                            결제하기
                          </Link>
                        )}
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[14px] font-bold text-slate-500">현재 발행된 인보이스가 없습니다.</p>
                </Card>
              )}

              <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50/50 px-4 py-3">
                <p className="text-[15px] font-black text-emerald-700">감사합니다! 최선을 다해 관리하겠습니다!</p>
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="mt-0 space-y-3 animate-in fade-in duration-500">
              {notifications.length === 0 ? (
                <div className="py-32 text-center opacity-20 italic font-black text-slate-400 flex flex-col items-center gap-4">
                  <Bell className="h-16 w-16" /> <span className="text-sm uppercase tracking-widest">새로운 알림이 없습니다.</span>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={cn(
                      'w-full rounded-2xl border bg-white p-5 text-left transition-all active:scale-[0.98]',
                      !(n.isRead || readMap[n.id]) ? 'border-[#14295F]/20 shadow-lg ring-1 ring-[#14295F]/5' : 'border-slate-100 opacity-60'
                    )}
                    onClick={() => void openNotificationDetail(n)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{n.createdAtLabel}</span>
                      {n.isImportant && <Badge variant="outline" className="bg-orange-100 text-[#FF7A16] border-none font-black text-[10px] h-5 px-2">중요</Badge>}
                    </div>
                    <p className="text-base font-black text-[#14295F] tracking-tight">{n.title}</p>
                  </button>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isReportArchiveOpen} onOpenChange={setIsReportArchiveOpen}>
        <DialogContent className={cn("overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl", isMobile ? "max-w-[95vw]" : "sm:max-w-4xl")}>
          <div className="bg-[#14295F] p-6 text-white">
            <DialogTitle className="text-xl font-black tracking-tight">우리 아이 학습 리포트</DialogTitle>
            <DialogDescription className="mt-1 text-xs font-bold text-white/70">받은 리포트를 날짜별로 확인할 수 있어요.</DialogDescription>
          </div>
          <div className={cn("bg-white", isMobile ? "space-y-3 p-4" : "grid grid-cols-[260px_1fr] gap-4 p-6")}>
            <div className={cn("space-y-2", isMobile ? "max-h-[220px] overflow-y-auto" : "max-h-[62vh] overflow-y-auto pr-1")}>
              {reportsArchive.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center text-xs font-bold text-slate-400">
                  아직 받은 리포트가 없습니다.
                </div>
              ) : (
                reportsArchive.map((item) => {
                  const isActiveItem = selectedChildReport?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void handleSelectChildReport(item)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-2.5 text-left transition-all",
                        isActiveItem ? "border-[#14295F] bg-[#EEF4FF]" : "border-slate-200 bg-white hover:bg-slate-50"
                      )}
                    >
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.dateKey || '-'}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-700">{item.content || '리포트 내용 없음'}</p>
                    </button>
                  );
                })
              )}
            </div>
            <div className={cn("rounded-xl border border-slate-200 bg-slate-50", isMobile ? "max-h-[42vh] overflow-y-auto p-4" : "max-h-[62vh] overflow-y-auto p-5")}>
              {selectedChildReport ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black uppercase tracking-widest text-[#14295F]/60">{selectedChildReport.dateKey}</p>
                    <Badge variant="outline" className="h-5 border-slate-200 bg-white px-2 text-[10px] font-black text-slate-600">
                      {selectedChildReport.viewedAt ? '읽음' : '새 리포트'}
                    </Badge>
                  </div>
                  <p className="whitespace-pre-wrap text-sm font-bold leading-relaxed text-slate-800">
                    {selectedChildReport.content || '리포트 내용이 없습니다.'}
                  </p>
                </div>
              ) : (
                <div className="flex h-full min-h-[180px] items-center justify-center text-center text-sm font-bold text-slate-400">
                  왼쪽에서 리포트를 선택해 주세요.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isPenaltyGuideOpen} onOpenChange={setIsPenaltyGuideOpen}>
        <DialogContent className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-lg">
          <div className="bg-gradient-to-r from-rose-600 to-rose-500 p-6 text-white">
            <DialogTitle className="text-xl font-black tracking-tight">벌점 현황 안내</DialogTitle>
            <DialogDescription className="mt-1 text-xs font-bold text-white/80">
              벌점 부여 기준, 누적 단계, 자동 회복 규칙
            </DialogDescription>
          </div>

          <div className="space-y-3 bg-white p-6">
            <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-rose-600">벌점 부여 기준</p>
              <div className="mt-2 space-y-1.5 text-sm font-bold text-slate-700">
                <p>지각 출석: +{REQUEST_PENALTY_POINTS.late}점</p>
                <p>결석: +{REQUEST_PENALTY_POINTS.absence}점</p>
                <p>루틴 미작성: +{ROUTINE_MISSING_PENALTY_POINTS}점</p>
                <p>센터 수동 부여: 관리자가 설정한 점수</p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-amber-700">누적 단계 기준</p>
              <div className="mt-2 space-y-1.5 text-sm font-bold text-slate-700">
                <p>7점 이상: 선생님과 상담</p>
                <p>12점 이상: 학부모 상담</p>
                <p>20점 이상: 퇴원</p>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">자동 회복 규칙</p>
              <div className="mt-2 space-y-1.5 text-sm font-bold text-slate-700">
                <p>최근 벌점 이후 {PENALTY_RECOVERY_INTERVAL_DAYS}일 동안 신규 벌점이 없으면 1점 회복</p>
                <p>현재 원점수 {penaltyRecovery.basePoints}점 · 회복 {penaltyRecovery.recoveredPoints}점 · 적용 {penaltyRecovery.effectivePoints}점</p>
                <p>최근 벌점 반영일: {penaltyRecovery.latestPositiveDateLabel}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">현재 조치 단계</p>
              <Badge variant="outline" className={cn('mt-2 h-7 rounded-full border px-3 text-xs font-black', penaltyMeta.badge)}>{penaltyMeta.label}</Badge>
            </div>
          </div>

          <DialogFooter className="border-t bg-white p-4">
            <DialogClose asChild>
              <Button className="h-11 w-full rounded-xl bg-[#14295F] text-sm font-black">확인</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedNotification} onOpenChange={(open) => { if (!open) setSelectedNotification(null); }}>
        <DialogContent className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-md">
          <div className="bg-[#14295F] p-6 text-white">
            <DialogTitle className="text-xl font-black tracking-tight">알림 상세</DialogTitle>
            <DialogDescription className="mt-1 text-xs font-bold text-white/70">
              {selectedNotification?.createdAtLabel || '최근'} · 읽음 확인 가능
            </DialogDescription>
          </div>
          <div className="space-y-4 bg-white p-6">
            <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-base font-black tracking-tight text-[#14295F]">{selectedNotification?.title}</p>
                {selectedNotification?.isImportant && (
                  <Badge variant="outline" className="h-5 border-none bg-orange-100 px-2 text-[10px] font-black text-[#FF7A16]">중요</Badge>
                )}
              </div>
              <p className="whitespace-pre-line text-sm font-bold leading-relaxed text-slate-700">{selectedNotification?.body}</p>
            </div>
            {selectedNotification && (
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600">
                {(selectedNotification.isRead || readMap[selectedNotification.id]) ? '읽음 확인됨' : '미확인 알림'}
              </p>
            )}
          </div>
          <DialogFooter className="border-t bg-white p-4">
            <DialogClose asChild>
              <Button className="h-11 w-full rounded-xl bg-[#14295F] text-sm font-black">닫기</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedCalendarDate} onOpenChange={(open) => { if (!open) setSelectedCalendarDate(null); }}>
        <DialogContent className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-lg">
          <div className="bg-gradient-to-r from-[#14295F] to-[#1f3e87] p-6 text-white">
            <DialogTitle className="text-xl font-black tracking-tight">
              {selectedCalendarDate ? format(selectedCalendarDate, 'yyyy.MM.dd (EEE)', { locale: ko }) : '날짜 상세'}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs font-bold text-white/70">해당 날짜의 학습 데이터 요약</DialogDescription>
          </div>
          <div className="space-y-4 bg-white p-6">
            <div className="grid grid-cols-2 gap-2">
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">공부 시간</p>
                <p className="dashboard-number mt-1 text-xl text-[#14295F]">{toHm(selectedDateLog?.totalMinutes || 0)}</p>
              </Card>
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">계획 달성</p>
                <p className="dashboard-number mt-1 text-xl text-[#FF7A16]">{selectedDatePlanRate}%</p>
              </Card>
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">획득 포인트</p>
                <p className="dashboard-number mt-1 text-xl text-emerald-600">{selectedDateLp.toLocaleString()}점</p>
              </Card>
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">출결 요청</p>
                <p className="mt-1 text-sm font-black text-[#14295F]">
                  {selectedDateRequest ? (selectedDateRequest.type === 'late' ? '지각 신청' : '결석 신청') : '기록 없음'}
                </p>
              </Card>
            </div>

            <Card className="rounded-xl border border-slate-100 p-4 shadow-none">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">학습 계획 내역</p>
                <Badge variant="outline" className="h-5 border border-slate-200 bg-slate-50 px-2 text-[10px] font-black text-slate-500">
                  {selectedDatePlanDone}/{selectedDatePlanTotal}
                </Badge>
              </div>
              {isSelectedDatePlansLoading ? (
                <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-300" /></div>
              ) : selectedDateStudyPlans.length === 0 ? (
                <p className="py-6 text-center text-xs font-bold text-slate-400">등록된 학습 계획이 없습니다.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedDateStudyPlans.slice(0, 6).map((plan) => (
                    <div key={plan.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <p className="line-clamp-1 text-xs font-bold text-slate-700">{plan.title}</p>
                      <Badge variant="outline" className={cn('h-5 border-none px-2 text-[10px] font-black', plan.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600')}>
                        {plan.done ? '완료' : '진행중'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
          <DialogFooter className="border-t bg-white p-4">
            <DialogClose asChild>
              <Button className="h-11 w-full rounded-xl bg-[#14295F] text-sm font-black">확인</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50/50 px-6 py-4 flex items-start gap-3 mx-1">
        <Info className="h-4 w-4 text-[#14295F] mt-0.5 shrink-0" />
        <p className="text-[10px] font-bold text-[#14295F]/70 leading-relaxed break-keep">
          학부모 모드는 실시간 조회 전용입니다. 정보 수정이나 상세 설정 변경은 센터 관리자 또는 자녀 계정을 통해 가능합니다.
        </p>
      </div>
    </div>
  );
}
