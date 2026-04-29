
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { collection, query, where, setDoc, doc, serverTimestamp, getDocs, getDoc, orderBy, limit } from 'firebase/firestore';
import { AttendanceCurrent, DailyReport, CenterMembership, ParentActivityEvent, StudyPlanItem, StudyLogDay } from '@/lib/types';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  FileText, 
  Search, 
  Send, 
  Loader2,
  ChevronRight,
  Sparkles,
  Zap,
  Wand2,
  AlertCircle,
  TrendingUp,
  Calendar,
  CheckCircle2,
  PenTool,
  Users
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { generateDailyReport } from '@/ai/flows/generate-daily-report';
import { parseDateInputValue } from '@/lib/dashboard-access';
import { getStudyDayKey } from '@/lib/study-day';
import { buildAttendanceRoutineInfo, deriveAttendanceDisplayState, toDateSafe } from '@/lib/attendance-auto';
import { deriveDailyReportSignals, normalizeDailyReportContentFingerprint } from '@/lib/daily-report-ai';
import { VisualReportViewer } from '@/components/dashboard/visual-report-viewer';
import { logHandledClientIssue } from '@/lib/handled-client-log';

type StudyLogDayDoc = StudyLogDay & {
  updatedAt?: unknown;
  createdAt?: unknown;
  totalStudyMinutes?: number;
};

type DailyStudentStatDoc = {
  todayPlanCompletionRate?: number;
  studyTimeGrowthRate?: number;
};

type AttendanceDailyStatDoc = {
  checkInAt?: unknown;
  checkOutAt?: unknown;
  awayMinutes?: number;
  lateMinutes?: number | null;
  expectedArrivalTime?: string | null;
  plannedDepartureTime?: string | null;
};

type AttendanceRecordDoc = {
  status?: 'requested' | 'confirmed_present' | 'confirmed_late' | 'confirmed_absent' | 'excused_absent';
  statusSource?: 'auto' | 'manual' | string;
  checkInAt?: unknown;
  updatedAt?: unknown;
  routineMissingAtCheckIn?: boolean;
};

const MAX_RECENT_REPORT_HISTORY = 7;
const REPORT_FOCUS_RETRY_ATTEMPTS = 12;
const REPORT_FOCUS_RETRY_INTERVAL_MS = 75;
const REPORT_SECTION_HEADINGS = new Set(['오늘 관찰', '선생님 코멘트', '교사 코멘트', '선생님 메모', '교육학적 해석', '내일 코칭', '가정 연계 팁']);

type ReportStudyLogSummary = {
  hasStudyRecord: boolean;
  minutes: number;
};

type ReportTrustReviewWarning = {
  id: string;
  source: string;
  snippet: string;
  keyword: string;
};

const REPORT_TRUST_REVIEW_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: '못함/미완료', pattern: /못\s*(했|함|한다|하는|하|따라|끝|풀|외웠|외우|잡|버티)|미완료|안\s*(했|함|한다|하|되는|됨)/u },
  { label: '부족/낮음', pattern: /부족|낮음|낮은|낮아|기준선\s*아래|저조/u },
  { label: '하락/불안', pattern: /급하락|하락|무너|불안정|흔들림|흔들리는|회복이\s*우선/u },
  { label: '주의/경고', pattern: /주의|경고|문제|위험|리스크|벌점|패널티/u },
  { label: '태도 단정', pattern: /불성실|게으|산만|태도\s*불량|집중력\s*부족|집중이\s*안/u },
  { label: '출결 부정', pattern: /지각|미입실|결석|퇴실불안정|늦음|늦게\s*하원|일찍\s*하원/u },
  { label: '실패 표현', pattern: /실패|포기|못\s*버틴|따라가지\s*못/u },
];

function uniqueStrings(items: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      items
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item))
    )
  );
}

function unwrapReportGenerationLoad<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  label: string
) {
  if (result.status === 'fulfilled') return result.value;
  logHandledClientIssue(`[daily-report] ${label} load failed`, result.reason);
  return fallback;
}

function readFiniteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readReportPlanTitle(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function buildReportSchedulePreviewItem(item: Partial<StudyPlanItem>, index: number) {
  const rawTitle = readReportPlanTitle(item.title, `일정 ${index + 1}`);
  const [title, ...timeParts] = rawTitle.split(': ');
  return {
    title: title.trim() || `일정 ${index + 1}`,
    time: timeParts.join(': ').trim() || '-',
  };
}

function getReportVariationSignature(report?: DailyReport | null) {
  return report?.aiMeta?.variationSignature || report?.aiMeta?.variationKey || null;
}

function getReportContentHighlights(content?: string | null) {
  return (content || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !REPORT_SECTION_HEADINGS.has(line))
    .slice(0, 3);
}

function splitReportReviewSentences(text?: string | null) {
  return (text || '')
    .split(/\r?\n/u)
    .flatMap((line) =>
      line
        .split(/(?<=[.!?])\s+|(?<=다\.)\s+|(?<=요\.)\s+|(?<=습니다\.)\s+/u)
        .map((item) => item.trim())
    )
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length > 0 && !REPORT_SECTION_HEADINGS.has(item));
}

function buildReportReviewSnippet(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 96) return normalized;
  return `${normalized.slice(0, 95).trimEnd()}…`;
}

function findReportTrustReviewWarnings(params: {
  content: string;
  teacherNote: string;
  aiMeta?: DailyReport['aiMeta'] | null;
}) {
  const reviewSources = [
    { source: '리포트 본문', text: params.content },
    { source: '교사 관찰 노트', text: params.teacherNote },
    { source: 'AI 한 줄 코칭', text: params.aiMeta?.teacherOneLiner || '' },
    { source: '강점/보완 항목', text: [...(params.aiMeta?.strengths || []), ...(params.aiMeta?.improvements || [])].join('\n') },
    { source: '코칭/가정 팁', text: [params.aiMeta?.coachingFocus, params.aiMeta?.homeTip].filter(Boolean).join('\n') },
  ];
  const warnings: ReportTrustReviewWarning[] = [];
  const seen = new Set<string>();

  reviewSources.forEach(({ source, text }) => {
    splitReportReviewSentences(text).forEach((sentence) => {
      const matched = REPORT_TRUST_REVIEW_PATTERNS.find((item) => item.pattern.test(sentence));
      if (!matched) return;
      const snippet = buildReportReviewSnippet(sentence);
      const key = `${source}:${snippet}`;
      if (seen.has(key)) return;
      seen.add(key);
      warnings.push({
        id: key,
        source,
        snippet,
        keyword: matched.label,
      });
    });
  });

  return warnings.slice(0, 5);
}

function formatReportClock(value?: Date | null) {
  return value ? format(value, 'HH:mm') : '기록 없음';
}

function parseClockMinutes(value?: string | null) {
  const match = value?.trim().match(/^(\d{1,2}):(\d{2})$/u);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

function getDateClockMinutes(value?: Date | null) {
  if (!value) return null;
  return value.getHours() * 60 + value.getMinutes();
}

function formatTimingStatus(params: {
  actualAt?: Date | null;
  plannedTime?: string | null;
  direction: 'arrival' | 'departure';
}) {
  const plannedMinutes = parseClockMinutes(params.plannedTime);
  const actualMinutes = getDateClockMinutes(params.actualAt);
  if (plannedMinutes === null || actualMinutes === null) return '';

  const diff = actualMinutes - plannedMinutes;
  if (Math.abs(diff) <= 5) return '제시간';
  if (params.direction === 'arrival') {
    return diff > 0 ? `${diff}분 늦음` : `${Math.abs(diff)}분 빠름`;
  }
  return diff > 0 ? `${diff}분 늦게 하원` : `${Math.abs(diff)}분 일찍 하원`;
}

function buildDailyReportAttendanceSummary(params: {
  checkInAt?: Date | null;
  checkOutAt?: Date | null;
  awayMinutes?: number | null;
  expectedArrivalTime?: string | null;
  plannedDepartureTime?: string | null;
}) {
  const awayMinutes = Math.max(0, Math.round(Number(params.awayMinutes || 0)));
  const arrivalStatus = formatTimingStatus({
    actualAt: params.checkInAt,
    plannedTime: params.expectedArrivalTime,
    direction: 'arrival',
  });
  const departureStatus = formatTimingStatus({
    actualAt: params.checkOutAt,
    plannedTime: params.plannedDepartureTime,
    direction: 'departure',
  });

  const arrivalLabel = arrivalStatus
    ? `등원 ${formatReportClock(params.checkInAt)}(${arrivalStatus})`
    : `등원 ${formatReportClock(params.checkInAt)}`;
  const departureLabel = departureStatus
    ? `하원 ${formatReportClock(params.checkOutAt)}(${departureStatus})`
    : `하원 ${formatReportClock(params.checkOutAt)}`;

  return `${arrivalLabel} · ${departureLabel} · 외출 ${awayMinutes}분`;
}

function buildRecentReportAvoidExpressions(params: {
  recentReports: DailyReport[];
  currentAiMeta?: DailyReport['aiMeta'] | null;
  currentContent?: string;
}) {
  const { recentReports, currentAiMeta, currentContent } = params;

  return uniqueStrings([
    currentAiMeta?.teacherOneLiner,
    ...(currentAiMeta?.strengths || []),
    ...(currentAiMeta?.improvements || []),
    ...getReportContentHighlights(currentContent),
    ...recentReports.flatMap((report) => [
      report.aiMeta?.teacherOneLiner,
      ...(report.aiMeta?.strengths || []),
      ...(report.aiMeta?.improvements || []),
      ...getReportContentHighlights(report.content),
    ]),
  ]).slice(0, 12);
}

function getEffectiveStudyLogMinutes(log?: Partial<StudyLogDayDoc> | null) {
  if (!log) return 0;
  const baseMinutes = Number(log.totalMinutes ?? log.totalStudyMinutes ?? 0);
  const manualAdjustmentMinutes = Number(log.manualAdjustmentMinutes ?? 0);
  return Math.max(
    0,
    Math.round(
      (Number.isFinite(baseMinutes) ? baseMinutes : 0) +
      (Number.isFinite(manualAdjustmentMinutes) ? manualAdjustmentMinutes : 0)
    )
  );
}

function hasReportStudyRecord(log?: Partial<StudyLogDayDoc> | null) {
  return getEffectiveStudyLogMinutes(log) > 0;
}

function formatReportStudyMinutes(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  if (hours <= 0) return `${mins}분`;
  if (mins <= 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

export default function DailyReportsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, viewMode } = useAppContext();
  const { toast } = useToast();
  
  const isMobile = viewMode === 'mobile';
  const [searchTerm, setSearchTerm] = useState('');
  const [sortMode, setSortMode] = useState<'unsent' | 'parentReads' | 'name'>('unsent');
  
  // 초기 날짜를 어제로 즉시 설정하여 로딩 지연 방지
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => subDays(new Date(), 1));

  const dateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const weekKey = selectedDate ? format(selectedDate, "yyyy-'W'II") : '';
  const centerId = activeMembership?.id;

  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string, name: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [reportContent, setReportContent] = useState('');
  const [teacherNote, setTeacherNote] = useState('');
  const [aiReportMeta, setAiReportMeta] = useState<DailyReport['aiMeta'] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [trustReviewWarnings, setTrustReviewWarnings] = useState<ReportTrustReviewWarning[]>([]);
  const [isTrustReviewOpen, setIsTrustReviewOpen] = useState(false);
  const pageRootRef = useRef<HTMLDivElement | null>(null);
  const writeModalTriggerRef = useRef<HTMLElement | null>(null);
  const writeModalContentRef = useRef<HTMLDivElement | null>(null);
  const reportContentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const sendReportButtonRef = useRef<HTMLButtonElement | null>(null);
  const reportFocusTimerRef = useRef<number | null>(null);
  const isClosingWriteModalRef = useRef(false);

  const clearReportFocusTimer = () => {
    if (reportFocusTimerRef.current !== null) {
      window.clearTimeout(reportFocusTimerRef.current);
      reportFocusTimerRef.current = null;
    }
  };

  const blurActiveReportElement = () => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  };

  const focusReportElement = (element: HTMLElement | null) => {
    if (!element?.isConnected || element.closest('[aria-hidden="true"]')) {
      return false;
    }

    element.focus({ preventScroll: true });
    return document.activeElement === element;
  };

  const scheduleReportFocus = (targets: Array<() => HTMLElement | null>, delayMs = REPORT_FOCUS_RETRY_INTERVAL_MS) => {
    clearReportFocusTimer();
    blurActiveReportElement();

    const tryFocus = (remainingAttempts: number) => {
      reportFocusTimerRef.current = null;

      for (const getTarget of targets) {
        if (focusReportElement(getTarget())) {
          return;
        }
      }

      if (remainingAttempts > 0) {
        reportFocusTimerRef.current = window.setTimeout(() => tryFocus(remainingAttempts - 1), REPORT_FOCUS_RETRY_INTERVAL_MS);
      }
    };

    reportFocusTimerRef.current = window.setTimeout(() => tryFocus(REPORT_FOCUS_RETRY_ATTEMPTS), delayMs);
  };

  const moveReportDialogFocusToPage = () => {
    scheduleReportFocus([
      () => writeModalTriggerRef.current,
      () => pageRootRef.current,
    ]);
  };

  const moveTrustReviewFocusToWriteModal = () => {
    if (isClosingWriteModalRef.current) {
      moveReportDialogFocusToPage();
      return;
    }

    scheduleReportFocus([
      () => sendReportButtonRef.current,
      () => reportContentTextareaRef.current,
      () => writeModalContentRef.current,
    ]);
  };

  const handleWriteModalOpenChange = (open: boolean) => {
    if (!open) {
      isClosingWriteModalRef.current = true;
      moveReportDialogFocusToPage();
      setIsTrustReviewOpen(false);
    } else {
      isClosingWriteModalRef.current = false;
    }
    setIsWriteModalOpen(open);
  };

  const handleTrustReviewOpenChange = (open: boolean) => {
    if (!open) {
      moveTrustReviewFocusToWriteModal();
    }
    setIsTrustReviewOpen(open);
  };

  useEffect(() => () => clearReportFocusTimer(), []);

  const formatTimestampLabel = (value: unknown, fallback: string) => {
    const parsed = toDateSafe(value);
    return parsed ? format(parsed, 'HH:mm') : fallback;
  };

  // 재원생(active)이면서 역할이 student인 멤버만 조회
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'), 
      where('role', '==', 'student'),
      where('status', '==', 'active')
    );
  }, [firestore, centerId]);
  const { data: studentMembers, isLoading: membersLoading } = useCollection<CenterMembership>(studentsQuery);

  const activeStudentIds = useMemo(
    () => (studentMembers || []).map((student) => student.id).filter(Boolean),
    [studentMembers]
  );
  const [studyLogSummaryByStudentId, setStudyLogSummaryByStudentId] = useState<Record<string, ReportStudyLogSummary>>({});
  const [studyLogSummaryLoading, setStudyLogSummaryLoading] = useState(false);

  useEffect(() => {
    if (!firestore || !centerId || !dateKey || activeStudentIds.length === 0) {
      setStudyLogSummaryByStudentId({});
      setStudyLogSummaryLoading(false);
      return;
    }

    let cancelled = false;
    const loadStudyLogSummaries = async () => {
      setStudyLogSummaryLoading(true);
      try {
        const entries = await Promise.all(
          activeStudentIds.map(async (studentId) => {
            const logRef = doc(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', dateKey);
            const logSnap = await getDoc(logRef);
            const log = logSnap.exists() ? (logSnap.data() as StudyLogDayDoc) : null;
            const minutes = getEffectiveStudyLogMinutes(log);
            return [
              studentId,
              {
                hasStudyRecord: minutes > 0,
                minutes,
              },
            ] as const;
          })
        );

        if (!cancelled) {
          setStudyLogSummaryByStudentId(Object.fromEntries(entries));
        }
      } catch (error) {
        console.error('[daily-report] study log summary load failed', error);
        if (!cancelled) {
          setStudyLogSummaryByStudentId({});
        }
      } finally {
        if (!cancelled) {
          setStudyLogSummaryLoading(false);
        }
      }
    };

    void loadStudyLogSummaries();
    return () => {
      cancelled = true;
    };
  }, [activeStudentIds, centerId, dateKey, firestore]);

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !dateKey) return null;
    return query(collection(firestore, 'centers', centerId, 'dailyReports'), where('dateKey', '==', dateKey));
  }, [firestore, centerId, dateKey]);
  const { data: dailyReports, isLoading: reportsLoading } = useCollection<DailyReport>(reportsQuery);

  const parentActivityQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'parentActivityEvents'),
      where('eventType', '==', 'report_read')
    );
  }, [firestore, centerId]);
  const { data: parentActivityEvents } = useCollection<ParentActivityEvent>(parentActivityQuery, { enabled: !!centerId });

  const reportByStudentId = useMemo(
    () => new Map((dailyReports || []).map((report) => [report.studentId, report])),
    [dailyReports]
  );

  const reportReadCount30dByStudentId = useMemo(() => {
    const counts = new Map<string, number>();
    const thirtyDaysAgoMs = subDays(new Date(), 30).getTime();
    (parentActivityEvents || []).forEach((event) => {
      if (event.eventType !== 'report_read') return;
      const createdAtMs = event.createdAt?.toMillis?.() ?? 0;
      if (createdAtMs < thirtyDaysAgoMs) return;
      counts.set(event.studentId, (counts.get(event.studentId) || 0) + 1);
    });
    return counts;
  }, [parentActivityEvents]);

  const filteredStudents = useMemo(() => {
    if (!studentMembers) return [];

    const normalizedSearchTerm = searchTerm.trim().toLowerCase();
    const filtered = studentMembers
      .filter((student) => studyLogSummaryByStudentId[student.id]?.hasStudyRecord)
      .filter((student) =>
        student.displayName?.toLowerCase().includes(normalizedSearchTerm)
      );

    const reportStateRank = (studentId: string) => {
      const report = reportByStudentId.get(studentId);
      if (!report) return 0;
      if (report.status === 'draft') return 1;
      return 2;
    };

    return filtered.sort((left, right) => {
      const leftName = left.displayName || '';
      const rightName = right.displayName || '';
      const leftReportState = reportStateRank(left.id);
      const rightReportState = reportStateRank(right.id);
      const leftReadCount = reportReadCount30dByStudentId.get(left.id) || 0;
      const rightReadCount = reportReadCount30dByStudentId.get(right.id) || 0;

      if (sortMode === 'parentReads') {
        if (rightReadCount !== leftReadCount) return rightReadCount - leftReadCount;
        if (leftReportState !== rightReportState) return leftReportState - rightReportState;
        return leftName.localeCompare(rightName);
      }

      if (sortMode === 'name') {
        return leftName.localeCompare(rightName);
      }

      if (leftReportState !== rightReportState) return leftReportState - rightReportState;
      if (rightReadCount !== leftReadCount) return rightReadCount - leftReadCount;
      return leftName.localeCompare(rightName);
    });
  }, [studentMembers, searchTerm, reportByStudentId, reportReadCount30dByStudentId, sortMode, studyLogSummaryByStudentId]);

  const studentRows = useMemo(
    () =>
      filteredStudents.map((student) => ({
        student,
        report: reportByStudentId.get(student.id),
        reportReadCount30d: reportReadCount30dByStudentId.get(student.id) || 0,
        studyMinutes: studyLogSummaryByStudentId[student.id]?.minutes || 0,
      })),
    [filteredStudents, reportByStudentId, reportReadCount30dByStudentId, studyLogSummaryByStudentId]
  );

  const handleOpenWriteModal = async (studentId: string, studentName: string, triggerElement?: HTMLElement | null) => {
    const studyLogSummary = studyLogSummaryByStudentId[studentId];
    if (!studyLogSummary?.hasStudyRecord) {
      toast({
        variant: 'destructive',
        title: '리포트 작성 대상이 아닙니다.',
        description: '선택한 날짜에 공부 기록이 있는 학생에게만 리포트를 작성하거나 발송할 수 있습니다.',
      });
      return;
    }
    writeModalTriggerRef.current = triggerElement || null;
    isClosingWriteModalRef.current = false;
    setSelectedStudent({ id: studentId, name: studentName });
    const existing = dailyReports?.find(r => r.studentId === studentId);
    setReportContent(existing?.content || '');
    setTeacherNote(existing?.teacherNote || '');
    setAiReportMeta(existing?.aiMeta || null);
    setTrustReviewWarnings([]);
    setIsTrustReviewOpen(false);
    setIsWriteModalOpen(true);
  };

  const handleGenerateAiReport = async () => {
    if (!selectedStudent || !firestore || !centerId || !dateKey) return;
    if (!studyLogSummaryByStudentId[selectedStudent.id]?.hasStudyRecord) {
      toast({
        variant: 'destructive',
        title: '공부 기록이 없습니다.',
        description: '선택한 날짜에 공부 기록이 있는 학생에게만 리포트를 생성할 수 있습니다.',
      });
      return;
    }
    setAiLoading(true);
    try {
      const existingReport = dailyReports?.find((report) => report.studentId === selectedStudent.id) || null;
      const todayKey = getStudyDayKey(new Date());
      const isTodayTarget = dateKey === todayKey;
      const targetDate = selectedDate ?? parseDateInputValue(dateKey) ?? new Date();

      const plansRef = collection(firestore, 'centers', centerId, 'plans', selectedStudent.id, 'weeks', weekKey, 'items');
      const logRef = doc(firestore, 'centers', centerId, 'studyLogs', selectedStudent.id, 'days', dateKey);
      const lastLogsRef = collection(firestore, 'centers', centerId, 'studyLogs', selectedStudent.id, 'days');
      const dailyStatRef = doc(firestore, 'centers', centerId, 'dailyStudentStats', dateKey, 'students', selectedStudent.id);
      const attendanceDailyStatRef = doc(firestore, 'centers', centerId, 'attendanceDailyStats', dateKey, 'students', selectedStudent.id);
      const attendanceRecordRef = doc(firestore, 'centers', centerId, 'attendanceRecords', dateKey, 'students', selectedStudent.id);
      const liveSeatQuery = query(
        collection(firestore, 'centers', centerId, 'attendanceCurrent'),
        where('studentId', '==', selectedStudent.id),
        limit(1)
      );
      const recentReportsQuery = query(
        collection(firestore, 'centers', centerId, 'dailyReports'),
        where('studentId', '==', selectedStudent.id),
        limit(20)
      );

      const [
        plansResult,
        logResult,
        historyResult,
        dailyStatResult,
        attendanceDailyStatResult,
        attendanceRecordResult,
        liveSeatResult,
        recentReportsResult,
      ] = await Promise.allSettled([
        getDocs(query(plansRef, where('dateKey', '==', dateKey))),
        getDoc(logRef),
        getDocs(query(lastLogsRef, orderBy('dateKey', 'desc'), limit(14))),
        getDoc(dailyStatRef),
        getDoc(attendanceDailyStatRef),
        getDoc(attendanceRecordRef),
        isTodayTarget ? getDocs(liveSeatQuery) : Promise.resolve(null),
        getDocs(recentReportsQuery),
      ] as const);

      const plansSnap = unwrapReportGenerationLoad(plansResult, null, 'plans');
      const logSnap = unwrapReportGenerationLoad(logResult, null, 'study log');
      const historySnap = unwrapReportGenerationLoad(historyResult, null, 'study history');
      const dailyStatSnap = unwrapReportGenerationLoad(dailyStatResult, null, 'daily stats');
      const attendanceDailyStatSnap = unwrapReportGenerationLoad(attendanceDailyStatResult, null, 'attendance stats');
      const attendanceRecordSnap = unwrapReportGenerationLoad(attendanceRecordResult, null, 'attendance record');
      const liveSeatSnap = unwrapReportGenerationLoad(liveSeatResult, null, 'live seat');
      const recentReportsSnap = unwrapReportGenerationLoad(recentReportsResult, null, 'recent reports');

      const plans = plansSnap?.docs.map(d => d.data() as StudyPlanItem) || [];
      const todayLog = logSnap?.exists() ? (logSnap.data() as StudyLogDayDoc) : null;
      const dailyStat = dailyStatSnap?.exists() ? (dailyStatSnap.data() as DailyStudentStatDoc) : null;
      const attendanceDailyStat = attendanceDailyStatSnap?.exists() ? (attendanceDailyStatSnap.data() as AttendanceDailyStatDoc) : null;
      const attendanceRecord = attendanceRecordSnap?.exists() ? (attendanceRecordSnap.data() as AttendanceRecordDoc) : null;
      const liveSeatDoc = liveSeatSnap?.docs?.[0];
      const liveSeat = liveSeatDoc
        ? ({ id: liveSeatDoc.id, ...liveSeatDoc.data() } as AttendanceCurrent)
        : null;

      const history7Days = (historySnap?.docs || [])
        .map(d => ({
          date: readReportPlanTitle(d.data().dateKey, d.id),
          minutes: getEffectiveStudyLogMinutes(d.data() as StudyLogDayDoc)
        }))
        .filter(h => h.date < dateKey)
        .slice(0, 7);

      const studyTasks = plans.filter(p => p.category === 'study' || !p.category);
      const completionFromPlans = studyTasks.length > 0
        ? Math.round((studyTasks.filter(t => t.done === true).length / studyTasks.length) * 100)
        : 0;
      const dailyCompletionRate = readFiniteNumber(dailyStat?.todayPlanCompletionRate, NaN);
      const hasPlanRecords =
        studyTasks.length > 0 ||
        (Number.isFinite(dailyCompletionRate) && dailyCompletionRate > 0);
      const completionRate = hasPlanRecords && Number.isFinite(dailyCompletionRate)
        ? Math.round(dailyCompletionRate)
        : completionFromPlans;
      const completionLabel = hasPlanRecords ? `${completionRate}%` : '러닝시스템 계획 기록 X';
      const scheduleItems = plans.filter(p => p.category === 'schedule');
      const routineInfo = buildAttendanceRoutineInfo(
        scheduleItems.map((item, index) => readReportPlanTitle(item.title, `일정 ${index + 1}`))
      );

      const attendanceStatCheckInAt = toDateSafe(attendanceDailyStat?.checkInAt);
      const attendanceStatCheckOutAt = toDateSafe(attendanceDailyStat?.checkOutAt);
      const recordCheckedAt = toDateSafe(attendanceRecord?.checkInAt || attendanceRecord?.updatedAt);
      const liveCheckedAt = toDateSafe(liveSeat?.lastCheckInAt || liveSeat?.updatedAt);
      const studyCheckedAt = toDateSafe(todayLog?.updatedAt || todayLog?.createdAt);
      const studyMinutes = getEffectiveStudyLogMinutes(todayLog) || studyLogSummaryByStudentId[selectedStudent.id]?.minutes || 0;
      const hasAttendanceEvidence = Boolean(attendanceStatCheckInAt || attendanceStatCheckOutAt || recordCheckedAt || liveCheckedAt || studyCheckedAt || studyMinutes > 0);
      const attendanceSummaryLabel = buildDailyReportAttendanceSummary({
        checkInAt: attendanceStatCheckInAt || recordCheckedAt || liveCheckedAt || studyCheckedAt,
        checkOutAt: attendanceStatCheckOutAt,
        awayMinutes: attendanceDailyStat?.awayMinutes,
        expectedArrivalTime: attendanceDailyStat?.expectedArrivalTime || routineInfo.expectedArrivalTime,
        plannedDepartureTime: attendanceDailyStat?.plannedDepartureTime || routineInfo.plannedDepartureTime,
      });
      const attendanceState = deriveAttendanceDisplayState({
        selectedDate: targetDate,
        dateKey,
        todayDateKey: todayKey,
        routine: routineInfo,
        recordStatus: attendanceRecord?.status,
        recordStatusSource: attendanceRecord?.statusSource,
        recordRoutineMissingAtCheckIn: Boolean(attendanceRecord?.routineMissingAtCheckIn),
        recordCheckedAt,
        liveCheckedAt,
        accessCheckedAt: recordCheckedAt,
        studyCheckedAt,
        studyMinutes,
        hasStudyLog: studyMinutes > 0,
      });

      const sortedRecentReports = (recentReportsSnap?.docs || [])
        .map((snapshot) => snapshot.data() as DailyReport)
        .filter((report) => report.dateKey && report.dateKey !== dateKey)
        .sort((a, b) => (b.dateKey || '').localeCompare(a.dateKey || ''));
      const recentReportsForVariation = sortedRecentReports.slice(0, MAX_RECENT_REPORT_HISTORY);
      const currentAiMeta = aiReportMeta || existingReport?.aiMeta || null;
      const draftVariationSignature =
        currentAiMeta?.variationSignature ||
        currentAiMeta?.variationKey ||
        getReportVariationSignature(existingReport);
      const draftFingerprint = normalizeDailyReportContentFingerprint(
        reportContent || existingReport?.content || ''
      );
      const excludedVariationSignatures = uniqueStrings([
        draftVariationSignature,
        ...recentReportsForVariation.map((report) => getReportVariationSignature(report)),
      ]);
      const excludedContentFingerprints = uniqueStrings([
        draftFingerprint,
        ...recentReportsForVariation.map((report) => normalizeDailyReportContentFingerprint(report.content || '')),
      ]);
      const generationAttempt =
        Math.max(aiReportMeta?.generationAttempt || 0, existingReport?.aiMeta?.generationAttempt || 0) + 1;

      const signals = deriveDailyReportSignals({
        studentId: selectedStudent.id,
        dateKey,
        totalStudyMinutes: studyMinutes,
        completionRate,
        hasPlanRecords,
        history7Days,
        growthRateOverridePercent:
          typeof dailyStat?.studyTimeGrowthRate === 'number'
            ? dailyStat.studyTimeGrowthRate * 100
            : null,
        attendanceDisplayStatus: attendanceState.status,
        attendanceSummaryLabel,
        currentSeatStatus: liveSeat?.status,
        isTodayTarget,
        hasAttendanceEvidence,
        generationAttempt,
        excludedVariationSignatures,
        excludedContentFingerprints,
      });
      const avoidExpressions = buildRecentReportAvoidExpressions({
        recentReports: recentReportsForVariation,
        currentAiMeta,
        currentContent: reportContent || existingReport?.content || '',
      });

      const aiInput = {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        date: dateKey,
        totalStudyMinutes: studyMinutes,
        completionRate,
        hasPlanRecords,
        completionLabel,
        plans: studyTasks.map((p, index) => ({
          title: readReportPlanTitle(p.title, `학습 계획 ${index + 1}`),
          done: p.done === true,
        })),
        schedule: scheduleItems.map((p, index) => buildReportSchedulePreviewItem(p, index)),
        history7Days,
        teacherNote: teacherNote.trim() || undefined,
        attendanceLabel: signals.attendanceLabel,
        studyBand: signals.studyBand,
        growthBand: signals.growthBand,
        completionBand: signals.completionBand,
        volatilityBand: signals.volatilityBand,
        routineBand: signals.routineBand,
        continuityBand: signals.continuityBand,
        pedagogyLens: signals.pedagogyLens,
        secondaryLens: signals.secondaryLens,
        stateBucket: signals.stateBucket,
        internalStage: signals.internalStage,
        stageFocus: signals.stageFocus,
        stageCoachingPoint: signals.stageCoachingPoint,
        stageHomePoint: signals.stageHomePoint,
        generationAttempt,
        variationSignature: signals.variationSignature,
        variationStyle: signals.variationStyle,
        variationGuide: signals.variationGuide,
        coachingFocus: signals.coachingFocus,
        homeTip: signals.homeTip,
        avoidExpressions,
        excludedVariationSignatures,
        excludedContentFingerprints,
        metrics: signals.metrics,
      };

      const result = await generateDailyReport(aiInput);
      setReportContent(result.content);
      setAiReportMeta({
        teacherOneLiner: result.teacherOneLiner,
        strengths: result.strengths,
        improvements: result.improvements,
        internalStage: result.internalStage,
        generationAttempt: result.generationAttempt,
        attendanceLabel: signals.attendanceLabel,
        totalStudyMinutes: studyMinutes,
        completionRate,
        hasPlanRecords,
        completionLabel,
        history7Days,
        pedagogyLens: result.pedagogyLens,
        secondaryLens: result.secondaryLens,
        stateBucket: result.stateBucket,
        variationSignature: result.variationSignature,
        variationStyle: result.variationStyle,
        coachingFocus: result.coachingFocus,
        homeTip: result.homeTip,
        studyBand: result.studyBand,
        growthBand: result.growthBand,
        completionBand: result.completionBand,
        routineBand: result.routineBand,
        volatilityBand: result.volatilityBand,
        continuityBand: result.continuityBand,
        metrics: result.metrics,
      });
      toast({
        title: '인공지능 리포트 생성 완료',
        description: `${result.pedagogyLens} 렌즈 기준으로 ${result.coachingFocus} 포인트를 정리했습니다.`,
      });
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "인공지능 생성 실패", 
        description: e.message || "연결 상태를 확인해 주세요." 
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveReport = async (
    status: 'draft' | 'sent' = 'draft',
    options: { skipTrustReview?: boolean } = {}
  ) => {
    if (!selectedStudent || !firestore || !centerId || !user || !dateKey) return;
    if (status === 'sent' && !studyLogSummaryByStudentId[selectedStudent.id]?.hasStudyRecord) {
      toast({
        variant: 'destructive',
        title: '발송할 수 없습니다.',
        description: '선택한 날짜에 공부 기록이 있는 학생에게만 리포트를 발송할 수 있습니다.',
      });
      return;
    }
    if (status === 'sent' && !options.skipTrustReview) {
      const warnings = findReportTrustReviewWarnings({
        content: reportContent,
        teacherNote,
        aiMeta: aiReportMeta,
      });
      if (warnings.length > 0) {
        setTrustReviewWarnings(warnings);
        setIsTrustReviewOpen(true);
        return;
      }
    }
    setIsSaving(true);
    try {
      const reportId = `${dateKey}_${selectedStudent.id}`;
      const reportRef = doc(firestore, 'centers', centerId, 'dailyReports', reportId);
      
      await setDoc(reportRef, {
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        teacherId: user.uid,
        dateKey,
        content: reportContent,
        teacherNote: teacherNote.trim() || null,
        aiMeta: aiReportMeta || null,
        status,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }, { merge: true });

      toast({ title: status === 'sent' ? "발송 완료" : "저장 완료" });
      setTrustReviewWarnings([]);
      isClosingWriteModalRef.current = true;
      setIsTrustReviewOpen(false);
      setIsWriteModalOpen(false);
      moveReportDialogFocusToPage();
    } catch (e: any) {
      toast({ variant: "destructive", title: "저장 실패" });
    } finally {
      setIsSaving(false);
    }
  };

  const isFullLoading = membersLoading || reportsLoading || studyLogSummaryLoading;
  const studentsWithStudyRecordCount = useMemo(
    () => activeStudentIds.filter((studentId) => studyLogSummaryByStudentId[studentId]?.hasStudyRecord).length,
    [activeStudentIds, studyLogSummaryByStudentId]
  );
  const excludedNoStudyRecordCount = Math.max(0, activeStudentIds.length - studentsWithStudyRecordCount);
  const unsentStudentCount = useMemo(
    () => studentRows.filter(({ report }) => report?.status !== 'sent').length,
    [studentRows]
  );
  const selectedStudentCanSendReport = selectedStudent
    ? Boolean(studyLogSummaryByStudentId[selectedStudent.id]?.hasStudyRecord)
    : false;

  return (
    <div ref={pageRootRef} tabIndex={-1} className={cn("flex flex-col gap-6 max-w-5xl mx-auto pb-20 px-1 outline-none", isMobile ? "gap-4" : "gap-8")}>
      <header className={cn("flex justify-between gap-4", isMobile ? "flex-col" : "flex-row items-center")}>
        <div className="flex flex-col gap-1">
          <h1 className={cn("font-black tracking-tighter flex items-center gap-2", isMobile ? "text-2xl" : "text-4xl")}>
            <FileText className={cn("text-primary", isMobile ? "h-6 w-6" : "h-10 w-10")} />
            데일리 리포트 센터
          </h1>
          <p className={cn("font-bold text-muted-foreground ml-1 uppercase tracking-widest whitespace-nowrap", isMobile ? "text-[9px]" : "text-xs")}>어제 분석 리포트</p>
        </div>
        <div className={cn("flex items-center gap-2", isMobile ? "w-full" : "")}>
          <div className="relative flex-1 sm:flex-none">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-40" />
            <Input 
              type="date" 
              value={dateKey}
              onChange={(e) => setSelectedDate(parseDateInputValue(e.target.value))}
              className={cn("font-black rounded-[1.25rem] shadow-sm border-2 pl-11 focus-visible:ring-primary/20 transition-all", isMobile ? "h-12 w-full text-sm" : "h-14 w-[200px]")}
            />
          </div>
        </div>
      </header>

      <div className={cn("grid gap-6", isMobile ? "grid-cols-1" : "md:grid-cols-4")}>
        {!isMobile && (
          <Card className="rounded-[2.5rem] border-none shadow-lg bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="bg-muted/30 border-b p-6">
              <CardTitle className="text-xs font-black flex items-center gap-2 uppercase tracking-widest opacity-60">
                <Users className="h-3.5 w-3.5 text-primary" /> 학생 빠른 찾기
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                <Input 
                  placeholder="이름 검색..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="rounded-xl border-2 pl-10 h-11 text-xs font-bold"
                />
              </div>
              <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar max-h-[500px] pr-1">
                {studentRows.map(({ student, reportReadCount30d, studyMinutes }) => (
                  <div 
                    key={student.id} 
                    className="p-3 rounded-2xl border-2 border-transparent hover:border-primary/10 hover:bg-primary/5 cursor-pointer flex items-center gap-3 transition-all active:scale-95"
                    onClick={(event) => void handleOpenWriteModal(student.id, student.displayName || '학생', event.currentTarget)}
                  >
                    <Avatar className="h-10 w-10 border-2 border-white shadow-sm ring-1 ring-border/50">
                      <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">{student.displayName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black truncate">{student.displayName}</p>
                      <p className="mt-0.5 text-[10px] font-bold text-blue-600">공부 {formatReportStudyMinutes(studyMinutes)}</p>
                      {sortMode === 'parentReads' && reportReadCount30d > 0 && (
                        <p className="mt-0.5 text-[10px] font-bold text-emerald-600">최근 30일 열람 {reportReadCount30d}회</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-20" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className={cn("flex flex-col gap-4", isMobile ? "col-span-1" : "md:col-span-3")}>
          {isMobile && (
            <div className="px-1 relative">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary opacity-30" />
               <Input 
                placeholder="학생 검색..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-2xl h-12 text-sm font-bold border-none shadow-xl pl-11 bg-white"
              />
            </div>
          )}

          <div className="grid gap-4">
            <div className={cn("flex gap-2", isMobile ? "flex-col px-1" : "items-center justify-between")}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full border-none bg-primary/10 px-3 py-1 text-[10px] font-black text-primary">
                  미발송 {unsentStudentCount}명
                </Badge>
                <Badge className="rounded-full border-none bg-blue-50 px-3 py-1 text-[10px] font-black text-blue-700">
                  공부기록 {studentsWithStudyRecordCount}명
                </Badge>
                {excludedNoStudyRecordCount > 0 && (
                  <Badge className="rounded-full border-none bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">
                    기록없음 제외 {excludedNoStudyRecordCount}명
                  </Badge>
                )}
                <Badge className="rounded-full border-none bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">
                  기본 정렬 {sortMode === 'unsent' ? '미작성 우선' : sortMode === 'parentReads' ? '열람 많은 순' : '이름순'}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={sortMode === 'unsent' ? 'default' : 'outline'}
                  className={cn(
                    "rounded-full font-black",
                    sortMode === 'unsent'
                      ? "bg-primary text-white hover:bg-primary/90"
                      : "border-primary/15 bg-white text-primary hover:bg-primary/5"
                  )}
                  onClick={() => setSortMode('unsent')}
                >
                  미작성 우선
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={sortMode === 'parentReads' ? 'default' : 'outline'}
                  className={cn(
                    "rounded-full font-black",
                    sortMode === 'parentReads'
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                  )}
                  onClick={() => setSortMode('parentReads')}
                >
                  열람 많은 순
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={sortMode === 'name' ? 'default' : 'outline'}
                  className={cn(
                    "rounded-full font-black",
                    sortMode === 'name'
                      ? "bg-slate-700 text-white hover:bg-slate-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  )}
                  onClick={() => setSortMode('name')}
                >
                  이름순
                </Button>
              </div>
            </div>
            {isFullLoading ? (
              <div className="flex flex-col items-center justify-center py-40 gap-4">
                <Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" />
                <p className="text-sm font-black text-muted-foreground/40 uppercase tracking-[0.2em] whitespace-nowrap">리포트 동기화 중...</p>
              </div>
            ) : studentRows.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center gap-6 bg-white/50 backdrop-blur-sm rounded-[3rem] border-2 border-dashed border-border/50">
                <Search className="h-16 w-16 text-muted-foreground opacity-10" />
                <div className="space-y-1">
                  <p className="text-xl font-black text-muted-foreground/40">학생을 찾을 수 없습니다.</p>
                  <p className="text-sm font-bold text-muted-foreground/20 uppercase whitespace-nowrap">선택 날짜에 공부 기록이 있는 학생만 표시됩니다</p>
                </div>
              </div>
            ) : studentRows.map(({ student, report, reportReadCount30d, studyMinutes }) => {
              const isSent = report?.status === 'sent';
              
              return (
                <Card 
                  key={student.id} 
                  className={cn(
                    "rounded-[2rem] border-none shadow-lg overflow-hidden group transition-all duration-500 active:scale-[0.98]",
                    isSent ? "bg-emerald-50/30 ring-1 ring-emerald-100" : "bg-white ring-1 ring-border/50"
                  )}
                >
                  <CardContent className="p-0">
                    <div className={cn("flex items-center justify-between p-5 sm:p-8", isMobile ? "gap-3" : "gap-8")}>
                      <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                        <div className="relative">
                          <Avatar className={cn("ring-4 transition-all duration-500", isSent ? "ring-emerald-500/20" : "ring-muted/20", isMobile ? "h-14 w-14" : "h-20 w-20")}>
                            <AvatarFallback className={cn("font-black", isMobile ? "text-xl" : "text-3xl")}>{student.displayName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          {isSent && (
                            <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full shadow-lg border-2 border-white">
                              <CheckCircle2 className="h-3 w-3 sm:h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="grid gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className={cn("font-black tracking-tighter truncate", isMobile ? "text-lg" : "text-3xl")}>{student.displayName}</h3>
                            {reportReadCount30d > 0 && (
                              <Badge className="bg-emerald-50 text-emerald-700 font-black px-2 py-0.5 rounded-full border-none text-[9px] whitespace-nowrap">
                                최근30일 열람 {reportReadCount30d}회
                              </Badge>
                            )}
                            <Badge className="bg-blue-50 text-blue-700 font-black px-2 py-0.5 rounded-full border-none text-[9px] whitespace-nowrap">
                              공부 {formatReportStudyMinutes(studyMinutes)}
                            </Badge>
                            {report?.viewedAt && (
                              <Badge className="bg-blue-500/10 text-blue-600 font-black px-2 py-0.5 rounded-full border-none text-[9px] uppercase tracking-tighter whitespace-nowrap">읽음 확인</Badge>
                            )}
                            {isSent && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 font-black px-2 py-0.5 rounded-full border-none text-[9px] uppercase tracking-tighter whitespace-nowrap">발송 완료</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <p className="font-bold text-muted-foreground/60 text-[10px] sm:text-xs">
                              {report ? `최종 수정: ${formatTimestampLabel(report.updatedAt, '시간 미확정')}` : "아직 작성 전"}
                            </p>
                            {report?.viewedAt && (
                              <p className="font-bold text-emerald-600/80 text-[10px] sm:text-xs">
                                {`열람: ${(report.viewedByName || '학생')} · ${formatTimestampLabel(report.viewedAt, '시간 미확정')}`}
                              </p>
                            )}
                            {report?.status === 'draft' && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            )}
                          </div>
                        </div>
                      </div>
                      <Button 
                        onClick={(event) => void handleOpenWriteModal(student.id, student.displayName || '학생', event.currentTarget)} 
                        className={cn(
                          "rounded-2xl font-black shrink-0 transition-all duration-300",
                          isMobile ? "h-12 w-12 p-0 shadow-lg" : "h-16 px-10 text-base shadow-xl",
                          isSent ? "bg-white text-emerald-600 border-2 border-emerald-100 hover:bg-emerald-50" : "bg-primary text-white hover:bg-primary/90"
                        )}
                      >
                        {isMobile ? (
                          isSent ? <CheckCircle2 className="h-6 w-6" /> : <PenTool className="h-6 w-6" />
                        ) : (
                          report ? '리포트 수정' : '리포트 작성'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      <Dialog open={isWriteModalOpen} onOpenChange={handleWriteModalOpenChange}>
        <DialogContent
          ref={writeModalContentRef}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            moveReportDialogFocusToPage();
          }}
          className={cn("rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col transition-all duration-500", isMobile ? "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] h-[85vh] max-w-[450px] rounded-[2rem]" : "max-w-4xl h-[90vh]")}
        >
          <div className={cn("bg-primary text-white relative overflow-hidden shrink-0", isMobile ? "p-6" : "p-12")}>
            <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
              <Sparkles className={cn(isMobile ? "h-20 w-20" : "h-48 w-48")} />
            </div>
            <DialogHeader className="relative z-10">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge className="bg-white/20 text-white border-none font-black text-[9px] tracking-[0.2em] uppercase px-3 py-1 whitespace-nowrap">프리미엄 인공지능 분석</Badge>
                <span className="text-white/60 font-black text-[10px] tracking-widest">{dateKey}</span>
              </div>
              <DialogTitle className={cn("font-black tracking-tighter", isMobile ? "text-2xl" : "text-5xl")}>{selectedStudent?.name} 학생</DialogTitle>
              <DialogDescription className="text-white/70 font-bold text-sm mt-1">성장 데이터를 바탕으로 인공지능과 선생님의 정밀 리포트가 합쳐진 최적의 솔루션입니다.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto bg-[#fafafa] custom-scrollbar">
            <div className={cn("space-y-8", isMobile ? "p-5" : "p-12")}>
              <div className={cn("grid gap-6 items-start", isMobile ? "grid-cols-1" : "md:grid-cols-5")}>
                <Card className={cn("rounded-[2rem] border-none shadow-xl bg-white ring-1 ring-border/50", isMobile ? "" : "md:col-span-3")}>
                  <CardHeader className="bg-muted/10 pb-4 border-b py-5 px-6">
                    <CardTitle className="text-[10px] font-black flex items-center gap-2 uppercase tracking-widest text-primary/70">
                      <FileText className="h-4 w-4" /> 교사 특별 관찰 노트
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <Textarea 
                      placeholder="학습 태도나 특이사항을 기록해 주세요. 인공지능 분석의 핵심 맥락으로 활용됩니다." 
                      value={teacherNote}
                      onChange={(e) => setTeacherNote(e.target.value)}
                      className="min-h-[100px] rounded-2xl border-2 font-bold text-sm resize-none shadow-inner"
                    />
                    <Button 
                      onClick={handleGenerateAiReport} 
                      disabled={aiLoading} 
                      className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-base gap-3 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                    >
                      {aiLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <Wand2 className="h-5 w-5" />}
                      인공지능 정밀 분석 리포트 생성
                    </Button>
                  </CardContent>
                </Card>

                {!isMobile && (
                  <div className="md:col-span-2 grid gap-4">
                    <div className="flex items-start gap-4 p-4 rounded-[1.5rem] bg-white border border-primary/5 shadow-md hover:shadow-xl transition-all">
                      <div className="p-2.5 rounded-2xl bg-blue-50">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">교육 렌즈</p>
                        <p className="text-sm font-black leading-snug">
                          {aiReportMeta?.pedagogyLens || '생성 대기'}
                          {aiReportMeta?.secondaryLens ? ` · ${aiReportMeta.secondaryLens}` : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {aiReportMeta?.studyBand && <Badge className="rounded-full border-none bg-blue-50 text-blue-700 font-black text-[10px]">{aiReportMeta.studyBand}</Badge>}
                          {aiReportMeta?.growthBand && <Badge className="rounded-full border-none bg-emerald-50 text-emerald-700 font-black text-[10px]">{aiReportMeta.growthBand}</Badge>}
                          {aiReportMeta?.routineBand && <Badge className="rounded-full border-none bg-amber-50 text-amber-700 font-black text-[10px]">{aiReportMeta.routineBand}</Badge>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 rounded-[1.5rem] bg-white border border-primary/5 shadow-md hover:shadow-xl transition-all">
                      <div className="p-2.5 rounded-2xl bg-amber-50">
                        <Zap className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">내일 코칭 포인트</p>
                        <p className="text-xs font-bold leading-relaxed text-foreground/80">
                          {aiReportMeta?.coachingFocus || 'AI 생성 후 교실에서 바로 실행할 코칭 포인트가 여기에 표시됩니다.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 rounded-[1.5rem] bg-white border border-primary/5 shadow-md hover:shadow-xl transition-all">
                      <div className="p-2.5 rounded-2xl bg-emerald-50">
                        <Sparkles className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">가정 연계 팁</p>
                        <p className="text-xs font-bold leading-relaxed text-foreground/80">
                          {aiReportMeta?.homeTip || 'AI 생성 후 가정에서 어떻게 대화하면 좋을지 바로 확인할 수 있습니다.'}
                        </p>
                        {aiReportMeta?.variationStyle && (
                          <p className="mt-2 text-[10px] font-black text-primary/60 uppercase tracking-widest">
                            {aiReportMeta.variationStyle}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {aiReportMeta && (
                <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "md:grid-cols-3")}>
                  <div className="rounded-[1.75rem] bg-white shadow-lg ring-1 ring-border/50 p-5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">교육 렌즈</p>
                    <p className="text-base font-black tracking-tight">{aiReportMeta.pedagogyLens || '분석 중'}</p>
                    <p className="mt-1 text-xs font-bold text-muted-foreground">{aiReportMeta.secondaryLens ? `보조 렌즈: ${aiReportMeta.secondaryLens}` : '보조 렌즈 없음'}</p>
                  </div>
                  <div className="rounded-[1.75rem] bg-white shadow-lg ring-1 ring-border/50 p-5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">오늘 코칭 포인트</p>
                    <p className="text-sm font-bold leading-relaxed text-foreground/80">{aiReportMeta.coachingFocus || '생성 후 표시됩니다.'}</p>
                  </div>
                  <div className="rounded-[1.75rem] bg-white shadow-lg ring-1 ring-border/50 p-5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">가정 연계 팁</p>
                    <p className="text-sm font-bold leading-relaxed text-foreground/80">{aiReportMeta.homeTip || '생성 후 표시됩니다.'}</p>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Label className="text-[10px] font-black uppercase text-primary/70 tracking-widest ml-2 flex items-center gap-2">
                  <Zap className="h-4 w-4" /> 생성된 리포트 최종 검토 및 편집
                </Label>
                <div className="relative group">
                  <Textarea 
                    ref={reportContentTextareaRef}
                    value={reportContent}
                    onChange={(e) => setReportContent(e.target.value)}
                    className={cn(
                      "rounded-[2.5rem] border-2 border-muted font-bold leading-relaxed text-base resize-none shadow-2xl bg-white group-hover:border-primary/20 focus-visible:ring-primary/10 transition-all",
                      isMobile ? "min-h-[300px] p-5" : "min-h-[500px] p-10"
                    )}
                  />
                  {!reportContent && !aiLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20 gap-4">
                      <Sparkles className="h-16 w-16" />
                      <p className="font-black text-xl tracking-tighter">인공지능 분석을 실행해 주세요.</p>
                    </div>
                  )}
                </div>
              </div>

              {reportContent.trim() && (
                <div className="flex flex-col gap-3">
                  <Label className="text-[10px] font-black uppercase text-primary/70 tracking-widest ml-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> 학부모·학생 화면 미리보기
                  </Label>
                  <div className="rounded-[2.5rem] border border-slate-100 bg-white p-4 shadow-xl sm:p-6">
                    {aiReportMeta ? (
                      <VisualReportViewer
                        content={reportContent}
                        aiMeta={aiReportMeta}
                        dateKey={dateKey}
                        studentName={selectedStudent?.name}
                        teacherNote={teacherNote}
                        compactMode
                      />
                    ) : (
                      <div className="rounded-[1.75rem] border border-dashed border-amber-200 bg-amber-50/70 p-6 text-sm font-bold leading-6 text-amber-800">
                        그래프 미리보기는 AI 분석을 생성하거나 기존 분석값이 저장된 리포트에서 표시됩니다. 발송 전에는 여기에서 학부모와 학생이 보는 리포트 화면을 먼저 확인할 수 있습니다.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className={cn("bg-white border-t shrink-0 backdrop-blur-xl bg-white/80", isMobile ? "p-5 flex-col gap-3" : "p-10 flex-row justify-between items-center")}>
            {!isMobile && (
              <div className="font-bold text-muted-foreground italic text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                ※ 생성된 리포트를 한 번 더 확인 후 발송해 주세요.
              </div>
            )}
            <div className={cn("flex gap-3", isMobile ? "w-full" : "")}>
              <Button variant="outline" className="rounded-2xl h-14 px-8 font-black flex-1 sm:flex-none border-2 shadow-sm" onClick={() => handleSaveReport('draft')} disabled={isSaving}>임시 저장</Button>
              <Button ref={sendReportButtonRef} className="rounded-2xl h-14 px-12 font-black gap-3 shadow-xl flex-1 sm:flex-none active:scale-95 transition-all" onClick={() => handleSaveReport('sent')} disabled={isSaving || !reportContent.trim() || !selectedStudentCanSendReport}>
                <Send className="h-5 w-5" /> 발송
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isTrustReviewOpen} onOpenChange={handleTrustReviewOpenChange}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            moveTrustReviewFocusToWriteModal();
          }}
          className="rounded-[2rem] border-none bg-white p-0 shadow-2xl sm:max-w-xl"
        >
          <div className="bg-[#14295F] px-6 py-5 text-white">
            <AlertDialogHeader className="space-y-2 text-left">
              <AlertDialogTitle className="font-black tracking-tight text-white">
                발송 전 표현 확인
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm font-bold leading-6 text-white/76">
                학부모와 학생에게 보이는 리포트입니다. 아래 표현이 의도한 톤인지 한 번 더 확인해 주세요.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-sm font-black leading-6 text-amber-900">
                다음 부분을 확인하셨나요?
              </p>
            </div>
            <div className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
              {trustReviewWarnings.map((warning) => (
                <div key={warning.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="rounded-full border-none bg-white px-2.5 py-1 text-[10px] font-black text-[#14295F]">
                      {warning.source}
                    </Badge>
                    <Badge className="rounded-full border-none bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-700">
                      {warning.keyword}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-800 break-keep">
                    “{warning.snippet}”
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs font-bold leading-5 text-slate-500">
              표현이 괜찮다면 그대로 발송하고, 톤이 강하면 리포트 본문이나 교사 관찰 노트를 부드럽게 수정한 뒤 발송해 주세요.
            </p>
          </div>
          <AlertDialogFooter className="gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:space-x-0">
            <AlertDialogCancel
              className="mt-0 h-11 rounded-xl border-slate-200 bg-white px-5 font-black text-slate-700"
            >
              다시 확인할게요
            </AlertDialogCancel>
            <Button
              type="button"
              onClick={() => {
                void handleSaveReport('sent', { skipTrustReview: true });
              }}
              disabled={isSaving}
              className="h-11 rounded-xl bg-[#14295F] px-5 font-black text-white hover:bg-[#1c397a]"
            >
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              확인 후 발송
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
