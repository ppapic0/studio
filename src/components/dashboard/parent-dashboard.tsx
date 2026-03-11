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
  Maximize2,
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
import { addDoc, collection, doc, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
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
  type ParentActivityEvent,
  type StudyLogDay,
  type StudyPlanItem,
  type StudentProfile,
} from '@/lib/types';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Progress } from '../ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
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
  if (h === 0) return `${m}遺?;
  if (m === 0) return `${h}?쒓컙`;
  return `${h}?쒓컙 ${m}遺?;
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function formatWon(value: number) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return `??{safe.toLocaleString()}`;
}

const QUICK_REQUEST_TEMPLATES: Record<ParentQuickRequestKey, string> = {
  math_support: '?섑븰 吏묒쨷 愿由??붿껌',
  english_support: '?곸뼱 蹂댁셿 ?붿껌',
  habit_coaching: '?숈뒿 ?듦? 肄붿묶 ?붿껌',
  career_consulting: '吏꾨줈/吏꾪븰 ?곷떞 ?붿껌',
};

const SUBJECT_COLORS = ['#FF7A16', '#14295F', '#10B981', '#0EA5E9', '#A855F7'];

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
  if (!date) return '理쒓렐';
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return '諛⑷툑 ??;
  if (diffMinutes < 60) return `${diffMinutes}遺???;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}?쒓컙 ??;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}????;
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
  return '理쒓렐';
}
export function ParentDashboard({ isActive }: { isActive: boolean }) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { memberships, activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();

  const isMobile = viewMode === 'mobile';
  const [today, setToday] = useState<Date | null>(null);
  const [tab, setTab] = useState<ParentPortalTab>('home');
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date());

  const [channel, setChannel] = useState<'visit' | 'phone' | 'online'>('visit');
  const [quickType, setQuickType] = useState<ParentQuickRequestKey>('math_support');
  const [requestText, setRequestText] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [readMap, setReadMap] = useState<Record<string, boolean>>({});
  const [selectedNotification, setSelectedNotification] = useState<ParentNotificationItem | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
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

  const activeCenterMembership = useMemo(() => {
    if (activeMembership) {
      return memberships.find((membership) => membership.id === activeMembership.id) || activeMembership;
    }
    return memberships.find((membership) => membership.status === 'active') || memberships[0] || null;
  }, [activeMembership, memberships]);

  const centerId = activeCenterMembership?.id;
  const studentId = activeCenterMembership?.linkedStudentIds?.[0];
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

  // 罹섎┛?붿슜 紐⑤뱺 濡쒓렇 議고쉶
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

  const attendanceRequestsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !studentId) return null;
    return query(collection(firestore, 'centers', centerId, 'attendanceRequests'), where('studentId', '==', studentId), limit(30));
  }, [firestore, centerId, studentId]);
  const { data: attendanceRequests } = useCollection<AttendanceRequest>(attendanceRequestsQuery, { enabled: isActive && !!studentId });

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

  const latestInvoice = sortedInvoices[0];
  const latestInvoiceDueDate = toDateSafe((latestInvoice as any)?.cycleEndDate);

  const billingSummary = useMemo(() => {
    return sortedInvoices.reduce(
      (acc, invoice) => {
        const amount = Number(invoice.finalPrice || 0);
        if (!Number.isFinite(amount) || amount <= 0) return acc;

        if (invoice.status !== 'void' && invoice.status !== 'refunded') {
          acc.billed += amount;
        }
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
  }, [sortedInvoices]);

  const latestInvoiceStatusMeta = useMemo(() => {
    if (!latestInvoice) return null;
    if (latestInvoice.status === 'paid') {
      return {
        label: '?섎궔 ?꾨즺',
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      };
    }
    if (latestInvoice.status === 'overdue') {
      return {
        label: '誘몃궔',
        className: 'bg-rose-100 text-rose-700 border-rose-200',
      };
    }
    return {
      label: '泥?뎄',
      className: 'bg-amber-100 text-amber-700 border-amber-200',
    };
  }, [latestInvoice]);

  const mobileBillingStatusMeta = useMemo(() => {
    if (!latestInvoice) return null;
    if (latestInvoice.status === 'paid') {
      return {
        label: '?꾨궔',
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      };
    }
    return {
      label: '誘몃궔',
      className: 'bg-rose-100 text-rose-700 border-rose-200',
    };
  }, [latestInvoice]);

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

  const weeklyTotalStudyMinutes = useMemo(
    () => dailyStudyTrend.reduce((sum, day) => sum + day.minutes, 0),
    [dailyStudyTrend]
  );

  const weeklyStudyPlans = (weeklyPlans || []).filter((item) => item.category === 'study' || !item.category);
  const weeklyPlanTotal = weeklyStudyPlans.length;
  const weeklyPlanDone = weeklyStudyPlans.filter((item) => item.done).length;
  const weeklyPlanCompletionRate = weeklyPlanTotal > 0 ? Math.round((weeklyPlanDone / weeklyPlanTotal) * 100) : 0;

  const subjectsData = useMemo(() => {
    const source = weeklyStudyPlans.length > 0 ? weeklyStudyPlans : studyPlans;
    const minutesBySubject = new Map<string, number>();

    source.forEach((item) => {
      const inferredSubject = item.subject?.trim() || (item.title.match(/?섑븰|?곸뼱|援?뼱|怨쇳븰|?ы쉶|?쒓뎅???쇱닠|肄붾뵫/)?.[0] ?? '湲고?');
      const weight = item.targetMinutes && item.targetMinutes > 0 ? item.targetMinutes : item.done ? 50 : 30;
      minutesBySubject.set(inferredSubject, (minutesBySubject.get(inferredSubject) || 0) + weight);
    });

    if (minutesBySubject.size === 0 && weeklyTotalStudyMinutes > 0) {
      minutesBySubject.set('?꾩껜 ?숈뒿', weeklyTotalStudyMinutes);
    }

    return Array.from(minutesBySubject.entries())
      .map(([subject, minutes], index) => ({
        subject,
        minutes,
        color: SUBJECT_COLORS[index % SUBJECT_COLORS.length],
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [studyPlans, weeklyStudyPlans, weeklyTotalStudyMinutes]);

  const subjectTotalMinutes = subjectsData.reduce((sum, subject) => sum + subject.minutes, 0);

  const recentPenaltyReasons = useMemo(() => {
    const sortedRequests = [...(attendanceRequests || [])].sort((a, b) => {
      const aDate = toDateSafe((a as any).createdAt)?.getTime() ?? 0;
      const bDate = toDateSafe((b as any).createdAt)?.getTime() ?? 0;
      return bDate - aDate;
    });

    return sortedRequests
      .filter((request) => request.penaltyApplied)
      .slice(0, 5)
      .map((request) => ({
        id: request.id,
        reason: request.reason || (request.type === 'late' ? '吏媛??좎껌 泥섎━' : '寃곗꽍 ?좎껌 泥섎━'),
        points: request.type === 'late' ? 3 : 5,
        dateLabel: formatDateLabel(request.date, (request as any).createdAt),
      }));
  }, [attendanceRequests]);

  const aiInsights = useMemo(() => {
    const insights: string[] = [];
    const targetWeeklyMinutes = (student?.targetDailyMinutes || 360) * 5;

    if (weeklyTotalStudyMinutes > 0) {
      const progressRate = Math.round((weeklyTotalStudyMinutes / Math.max(targetWeeklyMinutes, 1)) * 100);
      if (progressRate >= 100) {
        insights.push(`?대쾲 二?紐⑺몴 ?숈뒿?쒓컙???ъ꽦?덉뒿?덈떎. (${toHm(weeklyTotalStudyMinutes)})`);
      } else {
        insights.push(`?대쾲 二??꾩쟻 ?숈뒿? ${toHm(weeklyTotalStudyMinutes)}?쇰줈 紐⑺몴 ?鍮?${progressRate}%?낅땲??`);
      }
    } else {
      insights.push('?숈뒿 濡쒓렇媛 ?볦씠硫?AI ?몄궗?댄듃媛 ?먮룞?쇰줈 ?뺢탳?댁쭛?덈떎.');
    }

    insights.push(
      weeklyPlanTotal > 0
        ? `二쇨컙 怨꾪쉷 ?ъ꽦瑜좎? ${weeklyPlanCompletionRate}%?낅땲?? ${weeklyPlanCompletionRate >= 80 ? '?꾩＜ ?덉젙?곸엯?덈떎.' : '?꾨즺?⑥쓣 議곌툑留????뚯뼱?щ젮 蹂댁꽭??'}`
        : '?대쾲 二?怨꾪쉷 ?곗씠?곌? ?꾩쭅 ?깅줉?섏? ?딆븯?듬땲??'
    );

    if (subjectsData.length > 0) {
      const topSubject = subjectsData[0];
      insights.push(`媛??留롮씠 ?ъ옄??怨쇰ぉ? ${topSubject.subject} (${topSubject.minutes}遺??낅땲??`);
    }

    if ((growth?.penaltyPoints || 0) > 0) {
      insights.push(`?앺솢 踰뚯젏??${growth?.penaltyPoints || 0}???꾩쟻?섏뼱 ?덉뼱 ?앺솢 愿由ш? ?꾩슂?⑸땲??`);
    }

    return insights.slice(0, 4);
  }, [student?.targetDailyMinutes, weeklyTotalStudyMinutes, weeklyPlanTotal, weeklyPlanCompletionRate, subjectsData, growth?.penaltyPoints]);

  const weeklyFeedback = report?.content?.trim() || aiInsights[0] || '?좎깮???쇰뱶諛깆씠 ?깅줉?섎㈃ ???곸뿭?먯꽌 ?뺤씤?????덉뒿?덈떎.';

  const attendanceStatus = useMemo(() => {
    if (!attendanceCurrent) return { label: '?곹깭 誘명솗??, color: 'bg-slate-100 text-slate-400', icon: Clock };

    const status = attendanceCurrent.status;
    const isStudying = ['studying', 'away', 'break'].includes(status);
    const hasRecord = (todayLog?.totalMinutes || 0) > 0;

    if (isStudying) {
      return { label: '?깆썝 (?숈뒿 以?', color: 'bg-[#eaf2ff] text-[#14295F] border-blue-100', icon: UserCheck };
    }

    if (!isStudying && hasRecord) {
      return { label: '?섏썝 (洹媛 ?꾨즺)', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: Home };
    }

    const routineItems = todayPlans?.filter(p => p.category === 'schedule') || [];
    const isAbsentDay = routineItems.some(p => p.title.includes('?깆썝?섏? ?딆뒿?덈떎'));
    
    if (isAbsentDay) {
      return { label: '寃곗꽍 (?대Т)', color: 'bg-rose-50 text-rose-600 border-rose-100', icon: CalendarX };
    }

    const inTimePlan = routineItems.find(p => p.title.includes('?깆썝 ?덉젙'));
    if (inTimePlan) {
      const timeStr = inTimePlan.title.split(': ')[1];
      if (timeStr) {
        try {
          const now = new Date();
          const scheduledTime = parse(timeStr, 'HH:mm', now);
          if (isAfter(now, scheduledTime)) {
            return { label: '吏媛?二쇱쓽', color: 'bg-orange-50 text-[#FF7A16] border-orange-100', icon: AlertCircle };
          }
        } catch (e) {}
      }
    }

    return { label: '誘몄엯??(?낆떎 ??', color: 'bg-slate-100 text-slate-400 border-slate-200', icon: Clock };
  }, [attendanceCurrent, todayLog, todayPlans]);

  // 罹섎┛???곗씠???앹꽦
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
        title: item.title || '???뚮┝',
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
        title: attendanceCurrent.status === 'studying' ? '?깆썝 ?곹깭 ?뺤씤' : '異쒓껐 ?곹깭 ?낅뜲?댄듃',
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
        title: '?숈뒿 由ы룷???꾩갑',
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
        title: '?앺솢 湲곕줉 ?뚮┝',
        body: `${latest.reason} (+${latest.points}??`,
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

  const penaltyMeta = useMemo(() => {
    const points = growth?.penaltyPoints || 0;
    if (points >= 15) return { label: '二쇱쓽', badge: 'bg-rose-100 text-rose-700 border-rose-200' };
    if (points >= 5) return { label: '愿??, badge: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: '?뺤긽', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  }, [growth?.penaltyPoints]);

  const selectedDateLog = useMemo(() => {
    if (!selectedDateKey) return null;
    return (allLogs || []).find((log) => log.dateKey === selectedDateKey) || null;
  }, [allLogs, selectedDateKey]);

  const selectedDateStudyPlans = useMemo(
    () => (selectedDatePlans || []).filter((item) => item.category === 'study' || !item.category),
    [selectedDatePlans]
  );
  const selectedDatePlanTotal = selectedDateStudyPlans.length;
  const selectedDatePlanDone = selectedDateStudyPlans.filter((item) => item.done).length;
  const selectedDatePlanRate = selectedDatePlanTotal > 0 ? Math.round((selectedDatePlanDone / selectedDatePlanTotal) * 100) : 0;
  const selectedDateLp = Number(growth?.dailyLpStatus?.[selectedDateKey]?.dailyLpAmount || 0);
  const selectedDateRequest = useMemo(
    () => (attendanceRequests || []).find((request) => request.date === selectedDateKey),
    [attendanceRequests, selectedDateKey]
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

  async function submit(type: 'consultation' | 'request' | 'suggestion') {
    if (!firestore || !centerId || !studentId || !user) return;
    let title = '';
    let body = '';
    if (type === 'consultation') {
      title = `?곷떞 ?좎껌 (${channel === 'visit' ? '諛⑸Ц' : channel === 'phone' ? '?꾪솕' : '?⑤씪??})`;
      body = requestText.trim();
      if (!body) { toast({ variant: 'destructive', title: '?낅젰 ?뺤씤', description: '?곷떞 ?붿껌 ?댁슜???낅젰?댁＜?몄슂.' }); return; }
    }
    if (type === 'request') {
      title = QUICK_REQUEST_TEMPLATES[quickType];
      body = requestText.trim() || title;
    }
    if (type === 'suggestion') {
      title = '嫄댁쓽?ы빆';
      body = suggestionText.trim();
      if (!body) { toast({ variant: 'destructive', title: '?낅젰 ?뺤씤', description: '嫄댁쓽?ы빆???낅젰?댁＜?몄슂.' }); return; }
    }
    setSubmitting(true);
    try {
      await addDoc(collection(firestore, 'centers', centerId, 'parentCommunications'), {
        studentId, parentUid: user.uid, parentName: user.displayName || '?숇?紐?,
        type, title, body, channel: type === 'consultation' ? channel : null,
        status: 'requested', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });

      const eventType: ParentActivityEvent['eventType'] =
        type === 'consultation' ? 'consultation_request' : type;
      await logParentActivity(eventType, {
        title,
        channel: type === 'consultation' ? channel : null,
        quickType: type === 'request' ? quickType : null,
      });

      toast({ title: '?꾩넚 ?꾨즺', description: '?좎깮?섍퍡 ?붿껌???뺤긽?곸쑝濡??꾨떖?섏뿀?듬땲??' });
      setRequestText(''); setSuggestionText('');
    } catch (error) {
      toast({ variant: 'destructive', title: '?꾩넚 ?ㅽ뙣', description: '?듭떊 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isActive) return null;

  return (
    <div className={cn("space-y-4 pb-24", isMobile ? "px-0" : "max-w-4xl mx-auto px-4")}>
      <Card className="overflow-hidden rounded-[2.5rem] border-none bg-white shadow-2xl ring-1 ring-slate-200/60 transition-all duration-500">
        <CardContent className={cn('p-6 space-y-6')}>
          <div className="flex flex-col gap-1 px-1">
            <CardTitle className="text-2xl font-black tracking-tighter text-[#14295F] leading-none">
              {student?.name || '?먮?'} ?숈깮 ?꾪솴
            </CardTitle>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              {today && format(today, 'yyyy. MM. dd (EEEE)', {locale: ko})}
              <span className="opacity-20">|</span>
              <span className="text-[#FF7A16]">?ㅼ떆媛??낅뜲?댄듃 以?/span>
            </p>
          </div>

          <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
            <TabsContent value="home" className="mt-0 space-y-6 animate-in fade-in duration-500">
              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-2xl border-none bg-slate-50 p-4 text-center space-y-1 shadow-sm group hover:bg-white hover:ring-1 hover:ring-slate-200 transition-all">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">?ㅻ뒛 怨듬?</span>
                  <p className="text-xl font-black text-[#14295F] leading-tight">{toHm(totalMinutes)}</p>
                </Card>
                <Card className="rounded-2xl border-none bg-[#fff7ed] p-4 text-center space-y-1 shadow-sm border border-orange-100 group hover:bg-white hover:ring-1 hover:ring-orange-200 transition-all">
                  <span className="text-[8px] font-black text-[#FF7A16] uppercase tracking-widest">怨꾪쉷 ?ъ꽦</span>
                  <p className="text-xl font-black text-[#14295F] leading-tight">{planRate}%</p>
                </Card>
                <Card className={cn(
                  "rounded-2xl border-none p-4 text-center space-y-1 shadow-sm border transition-all",
                  attendanceStatus.color
                )}>
                  <span className="text-[8px] font-black uppercase tracking-widest opacity-60">異쒓껐 ?곹깭</span>
                  <p className="text-lg font-black leading-tight truncate">{attendanceStatus.label.split(' ')[0]}</p>
                </Card>
                <Card className="rounded-2xl border border-rose-100 bg-rose-50/40 p-4 text-center space-y-1 shadow-sm transition-all hover:bg-white hover:ring-1 hover:ring-rose-200">
                  <span className="text-[8px] font-black uppercase tracking-widest text-rose-600">踰뚯젏 吏??/span>
                  <div className="flex items-center justify-center gap-1">
                    <p className="text-xl font-black text-rose-700 leading-tight">{growth?.penaltyPoints || 0}</p>
                    <span className="text-xs font-black text-rose-500/70">??/span>
                  </div>
                  <Badge className={cn('h-5 border px-2 text-[9px] font-black', penaltyMeta.badge)}>{penaltyMeta.label}</Badge>
                </Card>
              </div>

              <Card className="rounded-[2rem] border-none bg-slate-50 p-6 ring-1 ring-slate-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:rotate-12 transition-transform duration-700">
                  <MessageCircle className="h-20 w-20 text-[#14295F]" />
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#FF7A16] fill-current" />
                    <span className="text-[10px] font-black text-[#14295F] uppercase tracking-widest">?댁젣??遺꾩꽍 寃곌낵</span>
                  </div>
                  {report?.viewedAt && <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[8px] h-4 px-1.5">?쎌쓬</Badge>}
                </div>
                <p className="text-sm font-bold text-slate-700 leading-relaxed break-keep relative z-10 line-clamp-2">
                  {report?.content || '?좎깮?섍낵 AI媛 ?댁젣???숈뒿 ?곗씠?곕? 遺꾩꽍 以묒엯?덈떎.'}
                </p>
              </Card>

              <Card className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-[#14295F]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">理쒓렐 ?뚮┝ 3媛?/span>
                  </div>
                  <Badge className="h-5 border border-slate-200 bg-slate-50 px-2 text-[9px] font-black text-slate-500">
                    {recentNotifications.length}嫄?
                  </Badge>
                </div>
                {recentNotifications.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-[11px] font-bold text-slate-400">
                    理쒓렐 ?뚮┝???놁뒿?덈떎.
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
                            'w-full rounded-2xl border p-3 text-left transition-all',
                            isRead ? 'border-slate-200 bg-slate-50/60' : 'border-[#14295F]/15 bg-[#f8fbff] shadow-sm'
                          )}
                          onClick={() => void openNotificationDetail(notification)}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-black tracking-tight text-[#14295F]">{notification.title}</p>
                            {notification.isImportant && (
                              <Badge className="h-5 shrink-0 border-none bg-orange-100 px-2 text-[9px] font-black text-[#FF7A16]">
                                以묒슂
                              </Badge>
                            )}
                          </div>
                          <p className="line-clamp-1 text-[12px] font-bold text-slate-600">{notification.body}</p>
                          <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {notification.createdAtLabel} 쨌 {isRead ? '?쎌쓬' : '誘명솗??}
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
                      <TrendingUp className="h-5 w-5" /> AI ?숈뒿 ?몄궗?댄듃 蹂닿린 <ChevronRight className="h-4 w-4 ml-auto opacity-40" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md">
                    <div className="bg-[#14295F] p-10 text-white relative">
                      <Sparkles className="absolute top-0 right-0 p-8 h-32 w-32 opacity-20" />
                      <DialogTitle className="text-2xl font-black tracking-tighter text-white">AI ?숈뒿 ?몄궗?댄듃</DialogTitle>
                      <DialogDescription className="text-white/70 font-bold mt-1 text-xs">?먮????숈뒿 ?⑦꽩???멸났吏?μ씠 ?뺣? 遺꾩꽍?덉뒿?덈떎.</DialogDescription>
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
                      <DialogClose asChild><Button className="w-full h-14 rounded-2xl font-black text-lg bg-[#14295F]">?뺤씤?덉뒿?덈떎</Button></DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            <TabsContent value="studyDetail" className="mt-0 space-y-6 animate-in fade-in duration-500">
              {/* 二쇨컙 ?깃낵 ?붿빟 (湲곗〈 由ы룷???댁슜 ?듯빀) */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-[1.5rem] border-none bg-white p-6 ring-1 ring-slate-100 text-center shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 block mb-2 uppercase tracking-widest">二쇨컙 ?꾩쟻 紐곗엯</span>
                  <p className="text-2xl font-black text-[#14295F]">{toHm(weeklyTotalStudyMinutes)}</p>
                </Card>
                <Card className="rounded-[1.5rem] border-none bg-white p-6 ring-1 ring-slate-100 text-center shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 block mb-2 uppercase tracking-widest">?됯퇏 紐⑺몴 ?ъ꽦</span>
                  <p className="text-2xl font-black text-[#FF7A16]">{weeklyPlanCompletionRate}%</p>
                </Card>
              </div>

              <div className="flex items-center justify-between px-1">
                <div className="flex flex-col">
                  <h3 className="text-xl font-black tracking-tighter text-[#14295F]">湲곕줉?몃옓</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Study Consistency Map</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentCalendarDate(subMonths(currentCalendarDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="text-[11px] font-black min-w-[80px] text-center">{format(currentCalendarDate, 'yyyy??M??)}</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setCurrentCalendarDate(addMonths(currentCalendarDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>

              <Card className="rounded-[2rem] border-none bg-white shadow-sm ring-1 ring-slate-100 overflow-hidden">
                <div className="grid grid-cols-7 border-b bg-gradient-to-r from-slate-50 via-white to-slate-50">
                  {['??, '??, '??, '紐?, '湲?, '??, '??].map((day, i) => (
                    <div key={day} className={cn(
                      "py-3 text-center text-[10px] font-black uppercase tracking-widest",
                      i === 5 ? "text-blue-600" : i === 6 ? "text-rose-600" : "text-slate-400"
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

                    return (
                      <button
                        type="button"
                        key={dateKey}
                        onClick={() => setSelectedCalendarDate(day)}
                        className={cn(
                          "p-1.5 aspect-square border-r border-b relative flex flex-col items-center justify-between text-left group transition-all hover:z-10 hover:scale-[1.02] hover:shadow-md active:scale-100",
                          !isCurrentMonth ? "opacity-[0.05] grayscale" : getHeatmapColor(minutes),
                          isTodayCalendar && "ring-2 ring-inset ring-[#FF7A16]/40 z-10"
                        )}
                      >
                        <span className={cn(
                          "text-[9px] font-black tracking-tighter tabular-nums self-start",
                          idx % 7 === 5 && isCurrentMonth ? "text-blue-600" : idx % 7 === 6 && isCurrentMonth ? "text-rose-600" : "opacity-40"
                        )}>
                          {format(day, 'd')}
                        </span>
                        {minutes > 0 && (
                          <div className="flex flex-col items-center gap-0.5 mb-1">
                            <span className="text-[9px] font-mono font-black tracking-tighter tabular-nums leading-none">
                              {formatMinutes(minutes)}
                            </span>
                            {minutes >= 180 && <Zap className="h-2 w-2 text-orange-500 fill-orange-500" />}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-[1.5rem] border-none shadow-sm bg-white p-5 ring-1 ring-slate-100">
                  <CardTitle className="text-[10px] font-black tracking-tight mb-4 flex items-center gap-2 text-slate-400 uppercase">
                    <PieChartIcon className="h-3.5 w-3.5 text-[#FF7A16]" /> 怨쇰ぉ蹂??숈뒿 鍮꾩쨷
                  </CardTitle>
                  <div className="space-y-4">
                    {subjectsData.slice(0, 3).map((s, i) => (
                      <div key={s.subject} className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                          <span>{s.subject}</span>
                          <span className="font-black">{s.minutes}遺?/span>
                        </div>
                        <Progress value={Math.min(100, Math.round((s.minutes / (subjectTotalMinutes || 1)) * 100))} className="h-1 bg-slate-100" />
                      </div>
                    ))}
                  </div>
                </Card>

                <Dialog>
                  <DialogTrigger asChild>
                    <Card className="rounded-[1.5rem] border-none shadow-sm bg-[#14295F] p-5 flex flex-col justify-center items-center text-center gap-2 cursor-pointer active:scale-95 transition-all">
                      <BarChart3 className="h-6 w-6 text-white/40" />
                      <div className="grid gap-0.5 text-white">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Weekly Detail</span>
                        <span className="text-xs font-black">?깃낵 ?곸꽭 遺꾩꽍</span>
                      </div>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-lg">
                    <div className="bg-[#14295F] p-10 text-white relative">
                      <DialogTitle className="text-3xl font-black tracking-tighter text-left text-white">二쇨컙 ?깃낵 ?곗씠??/DialogTitle>
                      <DialogDescription className="text-white/70 font-bold mt-1 text-sm">理쒓렐 7?쇨컙???숈뒿 吏??諛??쇰뱶諛깆엯?덈떎.</DialogDescription>
                    </div>
                    <div className="p-8 space-y-10 bg-white overflow-y-auto max-h-[60vh] custom-scrollbar">
                      <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase text-[#14295F] tracking-[0.2em] ml-1">?쇰퀎 吏묒쨷 ?쒓컙 (遺?</h4>
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
                        <p className="text-[10px] font-black text-[#FF7A16] uppercase mb-2 tracking-widest">?좎깮??醫낇빀 ?쇰뱶諛?/p>
                        <p className="text-base font-bold text-slate-700 leading-relaxed">"{weeklyFeedback}"</p>
                      </div>
                    </div>
                    <DialogFooter className="p-6 bg-white border-t">
                      <DialogClose asChild><Button className="w-full h-14 rounded-2xl font-black text-lg bg-[#14295F]">?뺤씤 ?꾨즺</Button></DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>

            <TabsContent value="data" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <Card className="rounded-[2rem] border border-rose-100 bg-rose-50/30 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="grid gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">?꾩쟻 踰뚯젏 吏??/span>
                    <h3 className="text-4xl font-black tracking-tighter text-rose-900">
                      {growth?.penaltyPoints || 0}
                      <span className="ml-1 text-lg opacity-40">??/span>
                    </h3>
                  </div>
                  <Badge className={cn('h-8 rounded-full border px-4 text-xs font-black shadow-sm', penaltyMeta.badge)}>
                    {penaltyMeta.label}
                  </Badge>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Card className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
                  <CardTitle className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                    <TrendingUp className="h-4 w-4 text-[#FF7A16]" />
                    理쒓렐 7??怨듬??쒓컙
                  </CardTitle>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={dailyStudyTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                        <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} width={28} />
                        <Tooltip contentStyle={{ borderRadius: '1rem', border: '1px solid #e5e7eb' }} />
                        <Line type="monotone" dataKey="minutes" stroke="#14295F" strokeWidth={3} dot={{ r: 3, fill: '#FF7A16' }} />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
                  <CardTitle className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
                    <BarChart3 className="h-4 w-4 text-[#14295F]" />
                    怨쇰ぉ蹂??숈뒿?쒓컙
                  </CardTitle>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={subjectsData.slice(0, 5)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
                        <XAxis dataKey="subject" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} width={28} />
                        <Tooltip contentStyle={{ borderRadius: '1rem', border: '1px solid #e5e7eb' }} />
                        <Bar dataKey="minutes" radius={[6, 6, 0, 0]} fill="#FF7A16" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="space-y-3 px-1">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-slate-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">理쒓렐 ?앺솢/異쒓껐 ?댁뒋</span>
                </div>
                {recentPenaltyReasons.length === 0 ? (
                  <div className="rounded-[2rem] border-2 border-dashed py-16 text-center text-xs font-black italic opacity-20">
                    湲곕줉???뱀씠?ы빆???놁뒿?덈떎.
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {recentPenaltyReasons.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:border-rose-200">
                        <div className="grid gap-1">
                          <span className="text-sm font-bold text-slate-800">{r.reason}</span>
                          <span className="text-[10px] font-black text-slate-400">{r.dateLabel} 쨌 洹쒖젙 以???덈궡</span>
                        </div>
                        <Badge variant="destructive" className="border-none bg-rose-100 px-3 py-1 text-xs font-black text-rose-700">
                          +{r.points}??
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="communication" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <Card className="rounded-[2.5rem] border-none shadow-xl bg-white p-8 ring-1 ring-slate-100">
                <CardTitle className="text-lg font-black tracking-tighter mb-6 flex items-center gap-2 text-[#14295F]"><Send className="h-5 w-5 text-[#14295F]" /> ?곷떞 諛?吏???붿껌</CardTitle>
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">?곷떞 梨꾨꼸</Label>
                    <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                      <SelectTrigger className="h-12 rounded-xl border-2 font-bold text-sm shadow-sm"><SelectValue placeholder="?곷떞 梨꾨꼸 ?좏깮" /></SelectTrigger>
                      <SelectContent className="rounded-xl border-none shadow-2xl">
                        <SelectItem value="visit" className="font-bold py-3 text-sm">?룶 ?쇳꽣 諛⑸Ц ?곷떞</SelectItem>
                        <SelectItem value="phone" className="font-bold py-3 text-sm">?뱸 ?꾪솕 ?곷떞</SelectItem>
                        <SelectItem value="online" className="font-bold py-3 text-sm">?뮲 ?⑤씪???곷떞</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">?곷떞 ?댁슜</Label>
                    <Textarea className="min-h-[120px] rounded-[1.5rem] border-2 font-bold p-4 text-sm shadow-inner" value={requestText} onChange={(e) => setRequestText(e.target.value)} placeholder="?먮????숈뒿?대굹 ?앺솢?????沅곴툑?섏떊 ?먯쓣 ?먯쑀濡?쾶 ?낅젰??二쇱꽭??" />
                  </div>
                  <Button className="w-full h-16 rounded-[1.5rem] bg-[#14295F] text-white font-black text-lg shadow-xl shadow-[#14295F]/20 active:scale-[0.98] transition-all" onClick={() => submit('consultation')} disabled={submitting}>?붿껌 蹂대궡湲?/Button>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="mt-0 space-y-4 animate-in fade-in duration-500">
              <Card className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="text-4xl font-black tracking-tight text-[#14295F] leading-none">?섎궔</h3>
                      <p className="text-[15px] font-bold text-slate-700 leading-snug">
                        <span className="block">센터수납요청건을 비대면으로</span>
                        <span className="block">결제할 수 있어요</span>
                      </p>
                    </div>
                    <span className="shrink-0 text-[14px] font-black text-[#14295F]">?ㅼ떆媛??곕룞</span>
                  </div>

                  {isMobile ? (
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12px] font-black text-[#14295F]">泥?뎄湲덉븸</p>
                        {mobileBillingStatusMeta && (
                          <Badge className={cn('h-6 border px-2 text-[11px] font-black', mobileBillingStatusMeta.className)}>
                            {mobileBillingStatusMeta.label}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-[1.05rem] font-black tracking-tight leading-none tabular-nums text-[#14295F] whitespace-nowrap">
                        {formatWon(billingSummary.billed)}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3.5 text-center shadow-sm">
                        <p className="text-[12px] font-black text-[#14295F]">泥?뎄</p>
                        <p className="mt-1 text-[1.2rem] font-black tracking-tight leading-none tabular-nums text-[#14295F] whitespace-nowrap">
                          {formatWon(billingSummary.billed)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 px-3 py-3.5 text-center shadow-sm">
                        <p className="text-[12px] font-black text-emerald-700">?섎궔</p>
                        <p className="mt-1 text-[1.2rem] font-black tracking-tight leading-none tabular-nums text-emerald-700 whitespace-nowrap">
                          {formatWon(billingSummary.paid)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-rose-200 bg-rose-50/40 px-3 py-3.5 text-center shadow-sm">
                        <p className="text-[12px] font-black text-rose-700">誘몃궔</p>
                        <p className="mt-1 text-[1.2rem] font-black tracking-tight leading-none tabular-nums text-rose-700 whitespace-nowrap">
                          {formatWon(billingSummary.overdue)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {latestInvoice ? (
                <Card className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
                  <div className={cn("flex justify-between gap-3", isMobile ? "items-center" : "items-start")}>
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className={cn("font-black tracking-tight text-[#14295F] min-w-0 truncate whitespace-nowrap", isMobile ? "text-[1.45rem] leading-none" : "text-[20px]")}>
                          {latestInvoice.studentName || student?.name || '?숈깮'}
                        </p>
                        {latestInvoiceStatusMeta && (
                          <Badge className={cn('h-6 border px-2 text-[10px] font-black shrink-0', latestInvoiceStatusMeta.className)}>
                            {isMobile ? (latestInvoice.status === 'paid' ? '?꾨궔' : '誘몃궔') : latestInvoiceStatusMeta.label}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[15px] font-bold text-slate-600">
                        寃곗젣 留덇컧??{latestInvoiceDueDate ? format(latestInvoiceDueDate, 'yyyy.MM.dd', { locale: ko }) : '-'}
                      </p>
                    </div>
                    <p className={cn("font-black tracking-tight leading-none text-[#14295F] tabular-nums whitespace-nowrap shrink-0", isMobile ? "text-[1.9rem]" : "text-[2.05rem]")}>
                      {formatWon(Number(latestInvoice.finalPrice || 0))}
                    </p>
                  </div>

                  {(latestInvoice.status === 'issued' || latestInvoice.status === 'overdue') && (
                    <Link
                      href={`/payment/checkout/${latestInvoice.id}`}
                      className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#14295F] text-[15px] font-black text-white shadow-sm transition-colors hover:bg-[#10224f]"
                    >
                      <CreditCard className="h-4 w-4" />
                      寃곗젣?섍린
                    </Link>
                  )}
                </Card>
              ) : (
                <Card className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
                  <p className="text-[14px] font-bold text-slate-500">?꾩옱 諛쒗뻾???몃낫?댁뒪媛 ?놁뒿?덈떎.</p>
                </Card>
              )}

              <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50/50 px-4 py-3">
                <p className="text-[15px] font-black text-emerald-700">媛먯궗?⑸땲?? 理쒖꽑???ㅽ빐 愿由ы븯寃좎뒿?덈떎!</p>
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="mt-0 space-y-3 animate-in fade-in duration-500">
              {notifications.length === 0 ? (
                <div className="py-32 text-center opacity-20 italic font-black text-slate-400 flex flex-col items-center gap-4">
                  <Bell className="h-16 w-16" /> <span className="text-sm uppercase tracking-widest">?덈줈???뚮┝???놁뒿?덈떎.</span>
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
                      {n.isImportant && <Badge className="bg-orange-100 text-[#FF7A16] border-none font-black text-[8px] h-5 px-2">以묒슂</Badge>}
                    </div>
                    <p className="text-base font-black text-[#14295F] tracking-tight">{n.title}</p>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed">{n.body}</p>
                  </button>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!selectedNotification} onOpenChange={(open) => { if (!open) setSelectedNotification(null); }}>
        <DialogContent className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-md">
          <div className="bg-[#14295F] p-6 text-white">
            <DialogTitle className="text-xl font-black tracking-tight">?뚮┝ ?곸꽭</DialogTitle>
            <DialogDescription className="mt-1 text-xs font-bold text-white/70">
              {selectedNotification?.createdAtLabel || '理쒓렐'} 쨌 ?쎌쓬 ?뺤씤 媛??
            </DialogDescription>
          </div>
          <div className="space-y-4 bg-white p-6">
            <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-base font-black tracking-tight text-[#14295F]">{selectedNotification?.title}</p>
                {selectedNotification?.isImportant && (
                  <Badge className="h-5 border-none bg-orange-100 px-2 text-[9px] font-black text-[#FF7A16]">以묒슂</Badge>
                )}
              </div>
              <p className="whitespace-pre-line text-sm font-bold leading-relaxed text-slate-700">{selectedNotification?.body}</p>
            </div>
            {selectedNotification && (
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600">
                {(selectedNotification.isRead || readMap[selectedNotification.id]) ? '?쎌쓬 ?뺤씤?? : '誘명솗???뚮┝'}
              </p>
            )}
          </div>
          <DialogFooter className="border-t bg-white p-4">
            <DialogClose asChild>
              <Button className="h-11 w-full rounded-xl bg-[#14295F] text-sm font-black">?リ린</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedCalendarDate} onOpenChange={(open) => { if (!open) setSelectedCalendarDate(null); }}>
        <DialogContent className="overflow-hidden rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-lg">
          <div className="bg-gradient-to-r from-[#14295F] to-[#1f3e87] p-6 text-white">
            <DialogTitle className="text-xl font-black tracking-tight">
              {selectedCalendarDate ? format(selectedCalendarDate, 'yyyy.MM.dd (EEE)', { locale: ko }) : '?좎쭨 ?곸꽭'}
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs font-bold text-white/70">?대떦 ?좎쭨???숈뒿 ?곗씠???붿빟</DialogDescription>
          </div>
          <div className="space-y-4 bg-white p-6">
            <div className="grid grid-cols-2 gap-2">
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">怨듬? ?쒓컙</p>
                <p className="mt-1 text-xl font-black text-[#14295F]">{toHm(selectedDateLog?.totalMinutes || 0)}</p>
              </Card>
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">怨꾪쉷 ?ъ꽦</p>
                <p className="mt-1 text-xl font-black text-[#FF7A16]">{selectedDatePlanRate}%</p>
              </Card>
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">?띾뱷 LP</p>
                <p className="mt-1 text-xl font-black text-emerald-600">{selectedDateLp.toLocaleString()} LP</p>
              </Card>
              <Card className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 shadow-none">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">異쒓껐 ?붿껌</p>
                <p className="mt-1 text-sm font-black text-[#14295F]">
                  {selectedDateRequest ? (selectedDateRequest.type === 'late' ? '吏媛??좎껌' : '寃곗꽍 ?좎껌') : '湲곕줉 ?놁쓬'}
                </p>
              </Card>
            </div>

            <Card className="rounded-xl border border-slate-100 p-4 shadow-none">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">?숈뒿 怨꾪쉷 ?댁뿭</p>
                <Badge className="h-5 border border-slate-200 bg-slate-50 px-2 text-[9px] font-black text-slate-500">
                  {selectedDatePlanDone}/{selectedDatePlanTotal}
                </Badge>
              </div>
              {isSelectedDatePlansLoading ? (
                <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-slate-300" /></div>
              ) : selectedDateStudyPlans.length === 0 ? (
                <p className="py-6 text-center text-xs font-bold text-slate-400">?깅줉???숈뒿 怨꾪쉷???놁뒿?덈떎.</p>
              ) : (
                <div className="space-y-1.5">
                  {selectedDateStudyPlans.slice(0, 6).map((plan) => (
                    <div key={plan.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                      <p className="line-clamp-1 text-xs font-bold text-slate-700">{plan.title}</p>
                      <Badge className={cn('h-5 border-none px-2 text-[9px] font-black', plan.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600')}>
                        {plan.done ? '?꾨즺' : '吏꾪뻾以?}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
          <DialogFooter className="border-t bg-white p-4">
            <DialogClose asChild>
              <Button className="h-11 w-full rounded-xl bg-[#14295F] text-sm font-black">?뺤씤</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-[1.5rem] border border-blue-100 bg-blue-50/50 px-6 py-4 flex items-start gap-3 mx-1">
        <Info className="h-4 w-4 text-[#14295F] mt-0.5 shrink-0" />
        <p className="text-[10px] font-bold text-[#14295F]/70 leading-relaxed break-keep">
          ?숇?紐?紐⑤뱶???ㅼ떆媛?議고쉶 ?꾩슜?낅땲?? ?뺣낫 ?섏젙?대굹 ?곸꽭 ?ㅼ젙 蹂寃쎌? ?쇳꽣 愿由ъ옄 ?먮뒗 ?먮? 怨꾩젙???듯빐 媛?ν빀?덈떎.
        </p>
      </div>
    </div>
  );
}
