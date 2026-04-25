'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { differenceInMinutes, format, isSameDay } from 'date-fns';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { useAppContext } from '@/contexts/app-context';
import { collection, collectionGroup, deleteDoc, deleteField, doc, getDoc, getDocs, limit, serverTimestamp, query, where, orderBy, Timestamp, writeBatch, setDoc } from 'firebase/firestore';
import { Loader2, CheckCircle2, XCircle, Clock, CalendarX, UserCheck, ClipboardCheck, BarChart3, Megaphone, TrendingUp, CalendarClock, LogIn, MapPinned, ShieldAlert, Plus, Pencil, Trash2 } from 'lucide-react';
import {
  AttendanceCurrent,
  AttendanceRequest,
  CenterMembership,
  StudentScheduleDoc,
  StudentScheduleOuting,
  StudentScheduleTemplate,
  StudyRoomClassScheduleTemplate,
  StudyRoomPeriodBlock,
} from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  AttendanceRecordStatus,
  AttendanceRoutineInfo,
  DisplayAttendanceStatus,
  buildAttendanceRoutineInfo,
  combineDateWithTime,
  deriveAttendanceDisplayState,
  syncAutoAttendanceRecord,
  toDateSafe,
} from '@/lib/attendance-auto';
import { appendAttendanceEventToBatch, mergeAttendanceDailyStatToBatch } from '@/lib/attendance-events';
import { deriveRequestOperationsSummary } from '@/lib/attendance-kpi';
import { AttendanceKpiBoard } from '@/components/dashboard/attendance-kpi-board';
import { buildNoShowFlag } from '@/features/schedules/lib/buildNoShowFlag';
import { logHandledClientIssue } from '@/lib/handled-client-log';
import {
  buildStudyRoomClassScheduleSummary,
  formatStudyRoomWeekdays,
  getAttendanceRequestTypeLabel,
  getScheduleChangeReasonLabel,
} from '@/lib/attendance-request';
import {
  SHARED_STUDY_ROOM_MANDATORY_ARRIVAL_TIME,
  SHARED_STUDY_ROOM_MANDATORY_DEPARTURE_TIME,
  buildStudyRoomClassSchedulesForClassName,
  buildSharedStudyRoomClassSchedules,
  getStudyRoomClassScheduleDisplayName,
  toStudyRoomTrackScheduleName,
} from '@/lib/study-room-class-schedule';
import {
  canManageSettings,
  canReadFinance,
  isActiveMembershipStatus,
  isTeacherOrAdminRole,
  parseDateInputValue,
  resolveMembershipByRole,
} from '@/lib/dashboard-access';
import { AdminWorkbenchCommandBar } from '@/components/dashboard/admin-workbench-command-bar';

type AttendanceRecord = {
  id: string;
  status: AttendanceRecordStatus;
  statusSource?: 'auto' | 'manual' | string;
  updatedAt?: any;
  checkInAt?: any;
  autoSyncedAt?: any;
  routineMissingAtCheckIn?: boolean;
  routineMissingPenaltyApplied?: boolean;
  confirmedByUserId?: string;
  centerId?: string;
  studentId?: string;
  dateKey?: string;
  studentName?: string;
};

type StudyLogSummary = {
  hasStudyLog: boolean;
  studyMinutes: number;
  checkedAt: Date | null;
};

type TodayScheduleInfo = {
  hasRoutine: boolean;
  isNoAttendanceDay: boolean;
  expectedArrivalTime: string | null;
  plannedDepartureTime: string | null;
  hasExcursion: boolean;
  excursionStartAt: string | null;
  excursionEndAt: string | null;
  scheduleMovementSummary: string | null;
  classScheduleName: string | null;
  scheduleUpdatedAt: Date | null;
  scheduleStatus: StudentScheduleDoc['status'] | null;
  actualArrivalAt: Date | null;
};

function getScheduleTemplateTimestampMs(template: StudentScheduleTemplate) {
  const raw = template.updatedAt || template.createdAt;
  if (!raw) return 0;
  if (raw instanceof Date) return raw.getTime();
  if (typeof (raw as any).toDate === 'function') return (raw as any).toDate().getTime();
  return 0;
}

function buildTodayScheduleInfoFromTemplate(template: StudentScheduleTemplate): TodayScheduleInfo {
  const hasExcursion = Boolean(
    template.hasExcursionDefault &&
    template.defaultExcursionStartAt &&
    template.defaultExcursionEndAt
  );

  return {
    hasRoutine: true,
    isNoAttendanceDay: false,
    expectedArrivalTime: template.arrivalPlannedAt || null,
    plannedDepartureTime: template.departurePlannedAt || null,
    hasExcursion,
    excursionStartAt: hasExcursion ? template.defaultExcursionStartAt : null,
    excursionEndAt: hasExcursion ? template.defaultExcursionEndAt : null,
    scheduleMovementSummary: hasExcursion
      ? `학원/외출 ${template.defaultExcursionStartAt} ~ ${template.defaultExcursionEndAt}`
      : null,
    classScheduleName: template.classScheduleName || null,
    scheduleUpdatedAt: toDateSafe(template.updatedAt || template.createdAt),
    scheduleStatus: 'scheduled',
    actualArrivalAt: null,
  };
}

function getOutingLabel(outing: Pick<StudentScheduleOuting, 'kind' | 'reason' | 'title'>) {
  const text = `${outing.reason || ''} ${outing.title || ''}`.trim();
  if (outing.kind === 'academy' || text.includes('학원')) return '학원';
  return '학원/외출';
}

function formatScheduleMovementSummary(outings?: StudentScheduleOuting[] | null) {
  const validOutings = [...(outings || [])]
    .filter((outing) => outing.startTime && outing.endTime)
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
  const firstOuting = validOutings[0];
  if (!firstOuting) return null;

  const suffix = validOutings.length > 1 ? ` 외 ${validOutings.length - 1}건` : '';
  const reason = firstOuting.reason?.trim() || firstOuting.title?.trim();
  return `${getOutingLabel(firstOuting)} ${firstOuting.startTime} ~ ${firstOuting.endTime}${reason ? ` · ${reason}` : ''}${suffix}`;
}

function buildTodayScheduleInfoFromClassSchedule(schedule: StudyRoomClassScheduleTemplate): TodayScheduleInfo {
  return {
    hasRoutine: true,
    isNoAttendanceDay: false,
    expectedArrivalTime: schedule.arrivalTime || null,
    plannedDepartureTime: schedule.departureTime || null,
    hasExcursion: false,
    excursionStartAt: null,
    excursionEndAt: null,
    scheduleMovementSummary: null,
    classScheduleName: schedule.className || null,
    scheduleUpdatedAt: toDateSafe(schedule.updatedAt || schedule.createdAt),
    scheduleStatus: 'scheduled',
    actualArrivalAt: null,
  };
}

function createPeriodBlock(overrides?: Partial<StudyRoomPeriodBlock>): StudyRoomPeriodBlock {
  return {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: '',
    startTime: '',
    endTime: '',
    description: '',
    ...overrides,
  };
}

const WEEKDAY_OPTIONS = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
];

export default function AttendancePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, memberships, membershipsLoading } = useAppContext();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'kpi' | 'requests'>('kpi');
  const [isProcessing, setIsProcessing] = useState(false);
  const [attendanceRoutineMap, setAttendanceRoutineMap] = useState<Record<string, TodayScheduleInfo>>({});
  const [routineLoading, setRoutineLoading] = useState(false);
  const [studyLogMap, setStudyLogMap] = useState<Record<string, StudyLogSummary>>({});
  const [studyLogLoading, setStudyLogLoading] = useState(false);
  const [editingClassScheduleId, setEditingClassScheduleId] = useState<string | null>(null);
  const [classScheduleClassName, setClassScheduleClassName] = useState('');
  const [classScheduleWeekdays, setClassScheduleWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [classScheduleArrivalTime, setClassScheduleArrivalTime] = useState(SHARED_STUDY_ROOM_MANDATORY_ARRIVAL_TIME);
  const [classScheduleDepartureTime, setClassScheduleDepartureTime] = useState(SHARED_STUDY_ROOM_MANDATORY_DEPARTURE_TIME);
  const [classScheduleNote, setClassScheduleNote] = useState('');
  const [classScheduleBlocks, setClassScheduleBlocks] = useState<StudyRoomPeriodBlock[]>([
    createPeriodBlock({ label: '1트랙', startTime: '18:10', endTime: '19:30' }),
    createPeriodBlock({ label: '2트랙', startTime: '19:40', endTime: '21:00' }),
    createPeriodBlock({ label: '3트랙', startTime: '21:20', endTime: '22:40' }),
    createPeriodBlock({ label: '의무 트랙', startTime: '22:50', endTime: '23:30', description: '자습 / 오답정리 / 테스트' }),
    createPeriodBlock({ label: '4트랙', startTime: '23:30', endTime: '00:50', description: '심화반 / 보강 / 선택자습' }),
  ]);

  useEffect(() => {
    setSelectedDate(new Date());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (tabParam === 'requests') {
      setActiveTab('requests');
    }
  }, []);

  const classroomMembership = resolveMembershipByRole(
    activeMembership,
    memberships,
    (membership) => isTeacherOrAdminRole(membership.role) && isActiveMembershipStatus(membership.status)
  );
  const dateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const weekKey = selectedDate ? format(selectedDate, "yyyy-'W'II") : '';
  const selectedWeekdayValue = selectedDate ? selectedDate.getDay() : null;
  const centerId = classroomMembership?.id;
  const isTeacherOrAdmin = Boolean(classroomMembership);
  const canOpenSettings = canManageSettings(activeMembership?.role);
  const canOpenFinance = canReadFinance(activeMembership?.role);

  // 1. 센터 모든 학생 조회
  const studentsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'members'),
      where('role', '==', 'student')
    );
  }, [firestore, centerId]);
  const { data: students, isLoading: membersLoading } = useCollection<CenterMembership>(studentsQuery, { enabled: isTeacherOrAdmin });

  // 2. 선택일 출석 기록 조회
  const attendanceQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !dateKey) return null;
    return collection(firestore, 'centers', centerId, 'attendanceRecords', dateKey, 'students');
  }, [firestore, centerId, dateKey]);
  const { data: attendanceRecords, isLoading: attendanceLoading } = useCollection<AttendanceRecord>(attendanceQuery, { enabled: isTeacherOrAdmin });

  const attendanceCurrentQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return collection(firestore, 'centers', centerId, 'attendanceCurrent');
  }, [firestore, centerId]);
  const { data: attendanceCurrentDocs, isLoading: attendanceCurrentLoading } = useCollection<AttendanceCurrent>(attendanceCurrentQuery, { enabled: isTeacherOrAdmin });
  const todaySchedulesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !dateKey) return null;
    return query(
      collectionGroup(firestore, 'schedules'),
      where('centerId', '==', centerId),
      where('dateKey', '==', dateKey)
    );
  }, [centerId, dateKey, firestore]);
  const { data: todaySchedules, isLoading: todaySchedulesLoading } = useCollection<StudentScheduleDoc>(todaySchedulesQuery, {
    enabled: isTeacherOrAdmin,
  });

  // 3. 지각/결석 신청 내역 조회
  const requestsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId) return null;
    return query(
      collection(firestore, 'centers', centerId, 'attendanceRequests'),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, centerId]);
  const { data: requests, isLoading: requestsLoading } = useCollection<AttendanceRequest>(requestsQuery, { enabled: isTeacherOrAdmin });
  const classSchedules = useMemo(
    () => buildSharedStudyRoomClassSchedules(centerId),
    [centerId]
  );
  const classSchedulesLoading = false;

  useEffect(() => {
    if (!firestore || !centerId || !isTeacherOrAdmin || !dateKey || !weekKey || selectedWeekdayValue === null || !students) {
      setAttendanceRoutineMap({});
      return;
    }

    let cancelled = false;
    const weekday = selectedWeekdayValue;
    const loadRoutineMap = async () => {
      setRoutineLoading(true);
      try {
        const scheduledIds = new Set(todaySchedules?.map((schedule) => schedule.uid).filter(Boolean));
        const entries = await Promise.all(
          students
            .filter((student) => !scheduledIds.has(student.id))
            .map(async (student) => {
              try {
                const templateSnap = await getDocs(query(
                  collection(firestore, 'users', student.id, 'scheduleTemplates'),
                  where('centerId', '==', centerId)
                ));
                const matchingTemplate = templateSnap.docs
                  .map((docSnap) => ({ ...(docSnap.data() as StudentScheduleTemplate), id: docSnap.id }))
                  .filter((template) => template.active !== false)
                  .filter((template) => !template.centerId || template.centerId === centerId)
                  .filter((template) => Array.isArray(template.weekdays) && template.weekdays.includes(weekday))
                  .sort((left, right) => getScheduleTemplateTimestampMs(right) - getScheduleTemplateTimestampMs(left))[0];

                if (matchingTemplate) {
                  return [student.id, buildTodayScheduleInfoFromTemplate(matchingTemplate)] as const;
                }
              } catch (templateError) {
                logHandledClientIssue('[attendance] schedule template fallback failed', templateError);
              }

              const defaultTrackSchedule = buildStudyRoomClassSchedulesForClassName(centerId, student.className)
                .filter((schedule) => schedule.active !== false)
                .find((schedule) => Array.isArray(schedule.weekdays) && schedule.weekdays.includes(weekday));
              if (defaultTrackSchedule) {
                return [student.id, buildTodayScheduleInfoFromClassSchedule(defaultTrackSchedule)] as const;
              }

              const routineQuery = query(
                collection(firestore, 'centers', centerId, 'plans', student.id, 'weeks', weekKey, 'items'),
                where('dateKey', '==', dateKey),
                where('category', '==', 'schedule'),
                limit(5)
              );
              const snap = await getDocs(routineQuery);
              const scheduleTitles = snap.docs.map((docSnap) => String(docSnap.data()?.title || ''));
              const routineInfo = buildAttendanceRoutineInfo(scheduleTitles);

              return [
                student.id,
                {
                  hasRoutine: routineInfo.hasRoutine,
                  isNoAttendanceDay: routineInfo.isNoAttendanceDay,
                  expectedArrivalTime: routineInfo.expectedArrivalTime,
                  plannedDepartureTime: null,
                  hasExcursion: false,
                  excursionStartAt: null,
                  excursionEndAt: null,
                  scheduleMovementSummary: null,
                  classScheduleName: null,
                  scheduleUpdatedAt: null,
                  scheduleStatus: null,
                  actualArrivalAt: null,
                },
              ] as const;
            })
        );

        if (!cancelled) {
          setAttendanceRoutineMap(Object.fromEntries(entries));
        }
      } catch (error) {
        console.error('[attendance] routine map load failed', error);
        if (!cancelled) setAttendanceRoutineMap({});
      } finally {
        if (!cancelled) setRoutineLoading(false);
      }
    };

    void loadRoutineMap();
    return () => {
      cancelled = true;
    };
  }, [firestore, centerId, isTeacherOrAdmin, dateKey, weekKey, selectedWeekdayValue, students, todaySchedules]);

  useEffect(() => {
    if (!firestore || !centerId || !isTeacherOrAdmin || !dateKey || !students) {
      setStudyLogMap({});
      setStudyLogLoading(false);
      return;
    }

    let cancelled = false;
    const loadStudyLogMap = async () => {
      setStudyLogLoading(true);
      try {
        const entries = await Promise.all(
          students.map(async (student) => {
            const dayRef = doc(firestore, 'centers', centerId, 'studyLogs', student.id, 'days', dateKey);
            const daySnap = await getDoc(dayRef);
            if (!daySnap.exists()) {
              return [
                student.id,
                { hasStudyLog: false, studyMinutes: 0, checkedAt: null },
              ] as const;
            }

            const data = daySnap.data() as any;
            const rawMinutes = Number(data?.totalMinutes || 0);
            const studyMinutes = Number.isFinite(rawMinutes) ? Math.max(0, Math.round(rawMinutes)) : 0;
            const checkedAt = toDateSafe(data?.updatedAt || data?.createdAt);

            return [
              student.id,
              {
                hasStudyLog: studyMinutes > 0,
                studyMinutes,
                checkedAt,
              },
            ] as const;
          })
        );

        if (!cancelled) {
          setStudyLogMap(Object.fromEntries(entries));
        }
      } catch (error) {
        console.error('[attendance] study log map load failed', error);
        if (!cancelled) setStudyLogMap({});
      } finally {
        if (!cancelled) setStudyLogLoading(false);
      }
    };

    void loadStudyLogMap();
    return () => {
      cancelled = true;
    };
  }, [firestore, centerId, isTeacherOrAdmin, dateKey, students]);

  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'confirmed_present': return 'default';
      case 'confirmed_present_missing_routine': return 'default';
      case 'confirmed_absent': return 'destructive';
      case 'confirmed_late': return 'secondary';
      case 'excused_absent': return 'outline';
      default: return 'outline';
    }
  };

  const formatLastVisitAt = (visitedAt: Date | null) => {
    if (!visitedAt) return '방문 기록 없음';
    return format(visitedAt, 'yyyy.MM.dd HH:mm');
  };

  const formatScheduleTimeRange = (routine?: TodayScheduleInfo | null) => {
    if (!routine || !routine.hasRoutine) return '일정 미등록';
    if (routine.isNoAttendanceDay) return '미등원 등록';
    if (!routine.expectedArrivalTime || !routine.plannedDepartureTime) return '시간 미정';
    return `${routine.expectedArrivalTime} ~ ${routine.plannedDepartureTime}`;
  };

  const isExcursionInProgress = (routine?: TodayScheduleInfo | null) => {
    if (!routine?.hasExcursion || !routine.excursionStartAt || !routine.excursionEndAt || !dateKey) return false;
    const now = new Date();
    const todayKey = format(now, 'yyyy-MM-dd');
    if (todayKey !== dateKey) return false;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = Number(routine.excursionStartAt.slice(0, 2)) * 60 + Number(routine.excursionStartAt.slice(3, 5));
    const endMinutes = Number(routine.excursionEndAt.slice(0, 2)) * 60 + Number(routine.excursionEndAt.slice(3, 5));
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  };

  const resolveNoShowStatus = (routineStatus?: TodayScheduleInfo['scheduleStatus'] | null, displayStatus?: DisplayAttendanceStatus) => {
    if (routineStatus) return routineStatus;
    if (displayStatus === 'confirmed_absent' || displayStatus === 'excused_absent') return 'absent';
    return null;
  };

  const handleStatusChange = async (studentId: string, status: AttendanceRecord['status'], checkedAt?: Date | null) => {
      if (!firestore || !user || !centerId || !dateKey || !selectedDate) return;

      setIsProcessing(true);
      try {
        const batch = writeBatch(firestore);
        const recordRef = doc(firestore, 'centers', centerId, 'attendanceRecords', dateKey, 'students', studentId);
        const studentData = students?.find(s => s.id === studentId);
        const routine = attendanceRoutineMap[studentId];
        const expectedArrivalAtFromRoutine =
          selectedDate && routine?.expectedArrivalTime
            ? combineDateWithTime(selectedDate, routine.expectedArrivalTime)
            : null;
        const fallbackCheckedAt =
          status === 'confirmed_present'
            ? expectedArrivalAtFromRoutine || selectedDate
            : status === 'confirmed_late'
              ? expectedArrivalAtFromRoutine
                ? new Date(expectedArrivalAtFromRoutine.getTime() + 10 * 60 * 1000)
                : selectedDate
              : null;
        const normalizedCheckedAt =
          status === 'confirmed_present' || status === 'confirmed_late'
            ? checkedAt || fallbackCheckedAt
            : null;

        const recordData: Partial<AttendanceRecord> = {
            status,
            updatedAt: serverTimestamp() as any,
            confirmedByUserId: user.uid,
            centerId: centerId,
            studentId: studentId,
            dateKey: dateKey,
            statusSource: 'manual',
        };
        (recordData as any).routineMissingAtCheckIn = deleteField();
        (recordData as any).routineMissingPenaltyApplied = deleteField();

        if (normalizedCheckedAt) {
          recordData.checkInAt = Timestamp.fromDate(normalizedCheckedAt);
        } else {
          (recordData as any).checkInAt = deleteField();
        }

        if (studentData) recordData.studentName = studentData.displayName;
        batch.set(recordRef, recordData, { merge: true });

        const expectedArrivalAt =
          normalizedCheckedAt && routine?.expectedArrivalTime
            ? combineDateWithTime(selectedDate, routine.expectedArrivalTime)
            : null;
        const lateMinutes =
          status === 'confirmed_late'
            ? normalizedCheckedAt && expectedArrivalAt
              ? Math.max(0, differenceInMinutes(normalizedCheckedAt, expectedArrivalAt))
              : 10
            : 0;

        appendAttendanceEventToBatch(batch, firestore, centerId, {
          studentId,
          dateKey,
          eventType: 'status_override',
          occurredAt: normalizedCheckedAt || new Date(),
          source: 'attendance_page',
          statusAfter: status,
          meta: {
            manual: true,
          },
        });

        mergeAttendanceDailyStatToBatch(batch, firestore, centerId, studentId, dateKey, {
          attendanceStatus: status,
          checkInAt: normalizedCheckedAt ?? null,
          lateMinutes,
          expectedArrivalTime: routine?.expectedArrivalTime ?? null,
          source: 'attendance_page',
        });

        await batch.commit();
        toast({ title: '출결 상태를 저장했습니다.' });
      } catch (error) {
        console.error('[attendance] manual status update failed', error);
        toast({ variant: 'destructive', title: '출결 저장 실패' });
      } finally {
        setIsProcessing(false);
      }
  }

  const handleRequestAction = async (requestId: string, status: 'approved' | 'rejected') => {
    if (!firestore || !centerId) return;
    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      const targetRequest = requests?.find((request) => request.id === requestId) || null;
      batch.update(doc(firestore, 'centers', centerId, 'attendanceRequests', requestId), {
        status,
        updatedAt: serverTimestamp(),
        statusUpdatedAt: serverTimestamp(),
        updatedByUserId: user?.uid || null,
      });

      if (targetRequest?.studentId) {
        appendAttendanceEventToBatch(batch, firestore, centerId, {
          studentId: targetRequest.studentId,
          dateKey: targetRequest.date,
          requestId: targetRequest.id,
          eventType: status === 'approved' ? 'request_approved' : 'request_rejected',
          occurredAt: new Date(),
          source: 'attendance_page',
          statusAfter: status,
          meta: {
            requestType: targetRequest.type,
          },
        });

        mergeAttendanceDailyStatToBatch(batch, firestore, centerId, targetRequest.studentId, targetRequest.date, {
          requestType: targetRequest.type,
          requestStatus: status,
          source: 'attendance_page',
        });
      }

      await batch.commit();
      toast({ title: status === 'approved' ? "신청을 승인했습니다." : "신청을 반려했습니다." });
    } catch (e) {
      toast({ variant: "destructive", title: "처리 실패" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveClassSchedule = async () => {
    if (!firestore || !centerId || !user?.uid) return;

    const trimmedClassName = classScheduleClassName.trim();
    const trimmedBlocks = classScheduleBlocks
      .map((block) => ({
        ...block,
        label: block.label.trim(),
        startTime: block.startTime.trim(),
        endTime: block.endTime.trim(),
        description: block.description?.trim() || '',
      }))
      .filter((block) => block.label && block.startTime && block.endTime);

    if (!trimmedClassName) {
      toast({ variant: 'destructive', title: '반 이름을 입력해 주세요.' });
      return;
    }
    if (classScheduleWeekdays.length === 0) {
      toast({ variant: 'destructive', title: '적용할 요일을 선택해 주세요.' });
      return;
    }
    if (!classScheduleArrivalTime || !classScheduleDepartureTime) {
      toast({ variant: 'destructive', title: '등원/하원 시간을 모두 입력해 주세요.' });
      return;
    }
    if (trimmedBlocks.length === 0) {
      toast({ variant: 'destructive', title: '최소 1개 이상의 트랙 블록이 필요해요.' });
      return;
    }

    setIsProcessing(true);
    try {
      const targetRef = editingClassScheduleId
        ? doc(firestore, 'centers', centerId, 'studyRoomClassSchedules', editingClassScheduleId)
        : doc(collection(firestore, 'centers', centerId, 'studyRoomClassSchedules'));
      const editingSchedule = (classSchedules || []).find((schedule) => schedule.id === editingClassScheduleId) || null;

      await setDoc(targetRef, {
        centerId,
        className: trimmedClassName,
        weekdays: [...classScheduleWeekdays].sort((left, right) => left - right),
        arrivalTime: classScheduleArrivalTime,
        departureTime: classScheduleDepartureTime,
        note: classScheduleNote.trim() || null,
        blocks: trimmedBlocks,
        active: true,
        createdAt: editingSchedule?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdByUid: editingSchedule?.createdByUid || user.uid,
        updatedByUid: user.uid,
      }, { merge: true });

      toast({
        title: editingClassScheduleId ? '트랙제를 수정했어요.' : '트랙제를 등록했어요.',
        description: `${trimmedClassName} 반 일정이 학생 일정 설정에 바로 반영됩니다.`,
      });
      resetClassScheduleForm();
    } catch (error) {
      logHandledClientIssue('[attendance] save class schedule failed', error);
      toast({ variant: 'destructive', title: '트랙제 저장 실패' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteClassSchedule = async (scheduleId?: string | null) => {
    if (!firestore || !centerId || !scheduleId) return;
    const shouldDelete = window.confirm('이 트랙제를 삭제할까요?');
    if (!shouldDelete) return;

    setIsProcessing(true);
    try {
      await deleteDoc(doc(firestore, 'centers', centerId, 'studyRoomClassSchedules', scheduleId));
      if (editingClassScheduleId === scheduleId) {
        resetClassScheduleForm();
      }
      toast({ title: '트랙제를 삭제했어요.' });
    } catch (error) {
      logHandledClientIssue('[attendance] delete class schedule failed', error);
      toast({ variant: 'destructive', title: '트랙제 삭제 실패' });
    } finally {
      setIsProcessing(false);
    }
  };

  const isLoading =
    membershipsLoading ||
    (Boolean(selectedDate) && (membersLoading || attendanceLoading || attendanceCurrentLoading || todaySchedulesLoading || studyLogLoading));
  const attendanceMap = useMemo(() => new Map(attendanceRecords?.map(r => [r.id, r])), [attendanceRecords]);
  const attendanceCurrentMap = useMemo(() => {
    const mapped = new Map<string, AttendanceCurrent>();
    (attendanceCurrentDocs || []).forEach((seat) => {
      if (seat.studentId) {
        mapped.set(seat.studentId, seat);
      }
    });
    return mapped;
  }, [attendanceCurrentDocs]);
  const todayScheduleMap = useMemo(() => {
    const mapped = new Map<string, TodayScheduleInfo>();
    (todaySchedules || []).forEach((schedule) => {
      if (!schedule.uid) return;
      const scheduleMovementSummary =
        formatScheduleMovementSummary(schedule.outings)
        || (
          schedule.excursionStartAt && schedule.excursionEndAt
            ? `학원/외출 ${schedule.excursionStartAt} ~ ${schedule.excursionEndAt}${schedule.excursionReason ? ` · ${schedule.excursionReason}` : ''}`
            : null
        );
      mapped.set(schedule.uid, {
        hasRoutine: true,
        isNoAttendanceDay: Boolean(schedule.isAbsent || schedule.status === 'absent'),
        expectedArrivalTime: schedule.arrivalPlannedAt || schedule.inTime || null,
        plannedDepartureTime: schedule.departurePlannedAt || schedule.outTime || null,
        hasExcursion: Boolean(schedule.hasExcursion || scheduleMovementSummary),
        excursionStartAt: schedule.excursionStartAt || null,
        excursionEndAt: schedule.excursionEndAt || null,
        scheduleMovementSummary,
        classScheduleName: schedule.classScheduleName || null,
        scheduleUpdatedAt: toDateSafe(schedule.updatedAt || schedule.createdAt),
        scheduleStatus: schedule.status || null,
        actualArrivalAt: toDateSafe(schedule.actualArrivalAt),
      });
    });
    return mapped;
  }, [todaySchedules]);

  const attendanceDisplayMap = useMemo(() => {
    const mapped = new Map<string, { status: DisplayAttendanceStatus; checkedAt: Date | null }>();
    if (!selectedDate) return mapped;

    const todayDateKey = format(new Date(), 'yyyy-MM-dd');
    const isTodaySelected = dateKey === todayDateKey;
    const nowMs = Date.now();

    (students || []).forEach((student) => {
      const record = attendanceMap.get(student.id);
      const routine = todayScheduleMap.get(student.id) || attendanceRoutineMap[student.id];
      const liveAttendance = attendanceCurrentMap.get(student.id);
      const studyLog = studyLogMap[student.id];
      const liveCheckInAt = isTodaySelected ? toDateSafe(liveAttendance?.lastCheckInAt) : null;
      const accessCheckedAt =
        liveCheckInAt && isSameDay(liveCheckInAt, selectedDate)
          ? liveCheckInAt
          : null;
      const derived = deriveAttendanceDisplayState({
        selectedDate,
        dateKey,
        todayDateKey,
        routine,
        recordStatus: record?.status,
        recordStatusSource: record?.statusSource,
        recordRoutineMissingAtCheckIn: Boolean(record?.routineMissingAtCheckIn),
        recordCheckedAt: toDateSafe(record?.checkInAt),
        liveCheckedAt: accessCheckedAt,
        accessCheckedAt,
        studyCheckedAt: studyLog?.checkedAt || null,
        studyMinutes: studyLog?.studyMinutes || 0,
        hasStudyLog: Boolean(studyLog?.hasStudyLog),
        nowMs,
        isRoutineLoading: routineLoading,
        isStudyLogLoading: studyLogLoading,
      });

      const normalizedCheckedAt =
        derived.checkedAt && isSameDay(derived.checkedAt, selectedDate)
          ? derived.checkedAt
          : null;

      mapped.set(student.id, { ...derived, checkedAt: normalizedCheckedAt });
    });

    return mapped;
  }, [
    attendanceMap,
    attendanceCurrentMap,
    attendanceRoutineMap,
    todayScheduleMap,
    dateKey,
    routineLoading,
    studyLogLoading,
    studyLogMap,
    selectedDate,
    students,
  ]);

  const mergedScheduleMap = useMemo(() => {
    const mapped = new Map<string, TodayScheduleInfo>();
    (students || []).forEach((student) => {
      const directSchedule = todayScheduleMap.get(student.id);
      if (directSchedule) {
        mapped.set(student.id, directSchedule);
        return;
      }
      const fallbackRoutine = attendanceRoutineMap[student.id];
      if (fallbackRoutine) {
        mapped.set(student.id, fallbackRoutine);
      }
    });
    return mapped;
  }, [attendanceRoutineMap, students, todayScheduleMap]);

  const todayDateKey = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const sortedStudents = useMemo(() => {
    return [...(students || [])].sort((a, b) => {
      const aRoutine = mergedScheduleMap.get(a.id);
      const bRoutine = mergedScheduleMap.get(b.id);
      const aDisplay = attendanceDisplayMap.get(a.id);
      const bDisplay = attendanceDisplayMap.get(b.id);

      const aNoShow = buildNoShowFlag({
        now: new Date(),
        dateKey: todayDateKey,
        selectedDateKey: dateKey,
        arrivalPlannedAt: aRoutine?.expectedArrivalTime,
        actualArrivalAt: aRoutine?.actualArrivalAt || aDisplay?.checkedAt || null,
        status: resolveNoShowStatus(aRoutine?.scheduleStatus || null, aDisplay?.status),
      });
      const bNoShow = buildNoShowFlag({
        now: new Date(),
        dateKey: todayDateKey,
        selectedDateKey: dateKey,
        arrivalPlannedAt: bRoutine?.expectedArrivalTime,
        actualArrivalAt: bRoutine?.actualArrivalAt || bDisplay?.checkedAt || null,
        status: resolveNoShowStatus(bRoutine?.scheduleStatus || null, bDisplay?.status),
      });

      if (aNoShow !== bNoShow) return aNoShow ? -1 : 1;

      const aArrival = aRoutine?.expectedArrivalTime || '99:99';
      const bArrival = bRoutine?.expectedArrivalTime || '99:99';
      if (aArrival !== bArrival) return aArrival.localeCompare(bArrival);

      return (a.displayName || '').localeCompare(b.displayName || '', 'ko');
    });
  }, [attendanceDisplayMap, dateKey, mergedScheduleMap, students, todayDateKey]);

  const attendanceScheduleSummary = useMemo(() => {
    return sortedStudents.reduce(
      (summary, student) => {
        const routine = mergedScheduleMap.get(student.id);
        const display = attendanceDisplayMap.get(student.id);
        const actualArrivalAt = routine?.actualArrivalAt || display?.checkedAt || null;
        const noShow = buildNoShowFlag({
          now: new Date(),
          dateKey: todayDateKey,
          selectedDateKey: dateKey,
          arrivalPlannedAt: routine?.expectedArrivalTime,
          actualArrivalAt,
          status: resolveNoShowStatus(routine?.scheduleStatus || null, display?.status),
        });

        if (routine?.hasRoutine && !routine.isNoAttendanceDay) {
          summary.scheduled += 1;
        }
        if (noShow) {
          summary.noShow += 1;
        }
        if (routine?.hasExcursion) {
          summary.excursion += 1;
        }
        if (actualArrivalAt || display?.status === 'confirmed_present' || display?.status === 'confirmed_late' || routine?.scheduleStatus === 'checked_in') {
          summary.checkedIn += 1;
        }

        return summary;
      },
      { scheduled: 0, noShow: 0, excursion: 0, checkedIn: 0 }
    );
  }, [attendanceDisplayMap, dateKey, mergedScheduleMap, sortedStudents, todayDateKey]);

  const missingRoutineStudents = useMemo(
    () => (students || []).filter((student) => mergedScheduleMap.get(student.id)?.hasRoutine === false),
    [students, mergedScheduleMap]
  );
  const requestOpsSummary = useMemo(
    () => deriveRequestOperationsSummary(requests || [], new Date()),
    [requests]
  );
  const pendingScheduleChangeRequestByStudentId = useMemo(() => {
    const mapped = new Map<string, AttendanceRequest>();
    (requests || [])
      .filter((request) => request.status === 'requested')
      .filter((request) => request.type === 'schedule_change')
      .filter((request) => !dateKey || request.date === dateKey)
      .sort((left, right) => {
        const leftCreatedAtMs = toDateSafe(left.createdAt)?.getTime() ?? 0;
        const rightCreatedAtMs = toDateSafe(right.createdAt)?.getTime() ?? 0;
        return rightCreatedAtMs - leftCreatedAtMs;
      })
      .forEach((request) => {
        if (!mapped.has(request.studentId)) {
          mapped.set(request.studentId, request);
        }
      });
    return mapped;
  }, [dateKey, requests]);
  const classNameOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (students || [])
            .map((student) => student.className?.trim())
            .filter((value): value is string => Boolean(value))
        )
      ).sort((left, right) => left.localeCompare(right, 'ko')),
    [students]
  );
  const visibleClassSchedules = useMemo(
    () => [...(classSchedules || [])].sort((left, right) => {
      const classCompare = String(left.className || '').localeCompare(String(right.className || ''), 'ko');
      if (classCompare !== 0) return classCompare;
      const leftWeekday = Math.min(...(left.weekdays || [0]));
      const rightWeekday = Math.min(...(right.weekdays || [0]));
      return leftWeekday - rightWeekday;
    }),
    [classSchedules]
  );

  const resetClassScheduleForm = useCallback(() => {
    setEditingClassScheduleId(null);
    setClassScheduleClassName(classNameOptions[0] || '');
    setClassScheduleWeekdays([1, 2, 3, 4, 5]);
    setClassScheduleArrivalTime(SHARED_STUDY_ROOM_MANDATORY_ARRIVAL_TIME);
    setClassScheduleDepartureTime(SHARED_STUDY_ROOM_MANDATORY_DEPARTURE_TIME);
    setClassScheduleNote('');
    setClassScheduleBlocks([
      createPeriodBlock({ label: '1트랙', startTime: '18:10', endTime: '19:30' }),
      createPeriodBlock({ label: '2트랙', startTime: '19:40', endTime: '21:00' }),
      createPeriodBlock({ label: '3트랙', startTime: '21:20', endTime: '22:40' }),
      createPeriodBlock({ label: '의무 트랙', startTime: '22:50', endTime: '23:30', description: '자습 / 오답정리 / 테스트' }),
      createPeriodBlock({ label: '4트랙', startTime: '23:30', endTime: '00:50', description: '심화반 / 보강 / 선택자습' }),
    ]);
  }, [classNameOptions]);

  const handleEditClassSchedule = useCallback((schedule: StudyRoomClassScheduleTemplate) => {
    setEditingClassScheduleId(schedule.id || null);
    setClassScheduleClassName(schedule.className || '');
    setClassScheduleWeekdays([...(schedule.weekdays || [])].sort((left, right) => left - right));
    setClassScheduleArrivalTime(schedule.arrivalTime || SHARED_STUDY_ROOM_MANDATORY_ARRIVAL_TIME);
    setClassScheduleDepartureTime(schedule.departureTime || SHARED_STUDY_ROOM_MANDATORY_DEPARTURE_TIME);
    setClassScheduleNote(schedule.note || '');
    setClassScheduleBlocks(
      (schedule.blocks || []).length
        ? schedule.blocks.map((block) => createPeriodBlock(block))
        : [createPeriodBlock()]
    );
  }, []);

  useEffect(() => {
    if (
      !firestore ||
      !user?.uid ||
      !centerId ||
      !dateKey ||
      !selectedDate ||
      !isTeacherOrAdmin ||
      isLoading ||
      routineLoading ||
      !students?.length
    ) {
      return;
    }

    let cancelled = false;
    const syncAutoAttendance = async () => {
      try {
        await Promise.all(
          students.map(async (student) => {
            const derived = attendanceDisplayMap.get(student.id);
            if (!derived) return;

            if (cancelled) return;

            await syncAutoAttendanceRecord({
              firestore,
              centerId,
              studentId: student.id,
              studentName: student.displayName || '',
              targetDate: selectedDate,
              checkInAt: derived.checkedAt,
              confirmedByUserId: user.uid,
            });
          })
        );
      } catch (error) {
        if (!cancelled) {
          logHandledClientIssue('[attendance] auto-sync failed', error);
        }
      }
    };

    void syncAutoAttendance();
    return () => {
      cancelled = true;
    };
  }, [
    attendanceDisplayMap,
    centerId,
    dateKey,
    firestore,
    isLoading,
    isTeacherOrAdmin,
    routineLoading,
    selectedDate,
    students,
    user?.uid,
  ]);

  useEffect(() => {
    if (editingClassScheduleId || classScheduleClassName || classNameOptions.length === 0) return;
    setClassScheduleClassName(classNameOptions[0]);
  }, [classNameOptions, classScheduleClassName, editingClassScheduleId]);

  if (membershipsLoading && !classroomMembership) {
    return (
      <div className="p-8">
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
        </div>
      </div>
    );
  }

  if (!isTeacherOrAdmin) {
    return (
      <div className="p-8"><Alert><AlertTitle>권한 없음</AlertTitle><AlertDescription>교사 또는 관리자 계정으로 로그인해야 출석을 관리할 수 있습니다.</AlertDescription></Alert></div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto p-4 sm:p-8">
      <header className="flex justify-between items-center">
        <div className="grid gap-1">
          <h1 className="text-3xl font-black tracking-tighter text-primary">출결 및 신청 관리</h1>
          <p className="text-xs font-bold text-muted-foreground tracking-widest whitespace-nowrap">출결 및 요청 관리</p>
        </div>
      </header>

      <AdminWorkbenchCommandBar
        eyebrow="출결 워크벤치"
        title="출결 운영 워크벤치"
        description="출결 KPI와 신청 관리 화면을 같은 빠른 실행과 날짜 기준으로 이어서 봅니다."
        quickActions={[
          { label: '실시간 교실', icon: <UserCheck className="h-4 w-4" />, href: '/dashboard/teacher' },
          ...(canOpenSettings ? [{ label: '문자 콘솔', icon: <ClipboardCheck className="h-4 w-4" />, href: '/dashboard/settings/notifications' }] : []),
          { label: '리드상담', icon: <Megaphone className="h-4 w-4" />, href: '/dashboard/leads' },
          ...(canOpenFinance ? [{ label: '수익분석', icon: <TrendingUp className="h-4 w-4" />, href: '/dashboard/revenue' }] : []),
          { label: '학생 관리', icon: <BarChart3 className="h-4 w-4" />, href: '/dashboard/teacher/students' },
        ]}
      >
        <div className="grid gap-1">
          <Label className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">조회 날짜</Label>
          <Input
            type="date"
            value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
            onChange={(event) => setSelectedDate(parseDateInputValue(event.target.value))}
            className="h-11 min-w-[180px] rounded-xl border-2 font-black"
          />
        </div>
      </AdminWorkbenchCommandBar>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value === 'requests' ? 'requests' : 'kpi')} className="w-full">
        <TabsList className="grid grid-cols-2 bg-muted/30 p-1 rounded-2xl border h-14 mb-8 max-w-2xl">
          <TabsTrigger value="kpi" className="rounded-xl font-black gap-2"><BarChart3 className="h-4 w-4" /> 출결 KPI</TabsTrigger>
          <TabsTrigger value="requests" className="rounded-xl font-black gap-2"><ClipboardCheck className="h-4 w-4" /> 신청 내역 관리</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="animate-in fade-in duration-500">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="bg-muted/5 border-b p-8 flex flex-row items-center justify-between gap-4">
              <div className="grid gap-1">
                <CardTitle className="text-xl font-black tracking-tight">학생 출석부</CardTitle>
                <CardDescription className="text-xs font-bold">{dateKey} 현황을 관리합니다.</CardDescription>
              </div>
              <Input 
                type="date" 
                value={dateKey}
                onChange={(e) => setSelectedDate(parseDateInputValue(e.target.value))}
                className="w-[180px] h-11 rounded-xl border-2 font-black"
              />
            </CardHeader>
            <CardContent className="p-0">
              {!selectedDate ? (
                <div className="flex justify-center py-20">
                  <p className="text-sm font-bold text-muted-foreground">조회할 날짜를 선택해 주세요.</p>
                </div>
              ) : isLoading ? <div className='flex justify-center py-20'><Loader2 className="h-8 w-8 animate-spin text-primary opacity-20"/></div> :
              <div>
                {!routineLoading && missingRoutineStudents.length > 0 && (
                  <div className="px-8 pt-6">
                    <Alert className="rounded-2xl border-amber-200 bg-amber-50/60">
                      <AlertTitle className="font-black text-amber-700">미작성 학생 {missingRoutineStudents.length}명</AlertTitle>
                      <AlertDescription className="font-bold text-amber-700/90 text-xs leading-relaxed">
                        선택한 날짜({dateKey})에 출결 루틴(등원/하원/휴무)이 없는 학생입니다. 먼저 학습계획에서 루틴을 작성해 주세요.
                      </AlertDescription>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {missingRoutineStudents.map((student) => (
                          <Badge key={student.id} variant="outline" className="border-amber-300 bg-white text-amber-700 font-black">
                            {student.displayName}
                          </Badge>
                        ))}
                      </div>
                    </Alert>
                  </div>
                )}
                <div className="grid gap-3 px-8 pb-2 pt-6 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[1.45rem] border border-slate-200 bg-white px-4 py-4 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">오늘 일정 등록</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{attendanceScheduleSummary.scheduled}명</p>
                  </div>
                  <div className="rounded-[1.45rem] border border-rose-200 bg-rose-50/70 px-4 py-4 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-400">미등원 플래그</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-rose-700">{attendanceScheduleSummary.noShow}명</p>
                  </div>
                  <div className="rounded-[1.45rem] border border-amber-200 bg-amber-50/70 px-4 py-4 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-500">외출 예정/중</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-amber-700">{attendanceScheduleSummary.excursion}명</p>
                  </div>
                  <div className="rounded-[1.45rem] border border-emerald-200 bg-emerald-50/70 px-4 py-4 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-500">체크인 완료</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-emerald-700">{attendanceScheduleSummary.checkedIn}명</p>
                  </div>
                </div>
                <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow className="border-none hover:bg-transparent h-12">
                    <TableHead className="font-black text-[10px] pl-8 whitespace-nowrap">학생</TableHead>
                    <TableHead className="font-black text-[10px] whitespace-nowrap">상태</TableHead>
                    <TableHead className="hidden lg:table-cell font-black text-[10px] whitespace-nowrap">예정 일정</TableHead>
                    <TableHead className="hidden md:table-cell font-black text-[10px]">최근 방문 기록</TableHead>
                    <TableHead className="text-right pr-8 font-black text-[10px] whitespace-nowrap">처리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students?.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-40 text-center font-bold opacity-30 italic">학생 정보가 없습니다.</TableCell></TableRow>
                  ) : sortedStudents.map((student) => {
                    const record = attendanceMap.get(student.id);
                    const status = attendanceDisplayMap.get(student.id)?.status || 'requested';
                    const routine = mergedScheduleMap.get(student.id);
                    const scheduleChangeRequest = pendingScheduleChangeRequestByStudentId.get(student.id);
                    const hasAttendanceRoutine = routine?.hasRoutine !== false;
                    const checkedAt = attendanceDisplayMap.get(student.id)?.checkedAt;
                    const manualStatus = record?.status && record.status !== 'requested' ? record.status : undefined;
                    const noShowFlag = buildNoShowFlag({
                      now: new Date(),
                      dateKey: todayDateKey,
                      selectedDateKey: dateKey,
                      arrivalPlannedAt: routine?.expectedArrivalTime,
                      actualArrivalAt: routine?.actualArrivalAt || checkedAt || null,
                      status: resolveNoShowStatus(routine?.scheduleStatus || null, status),
                    });
                    return (
                    <TableRow key={student.id} className="h-20 hover:bg-muted/5 transition-colors border-muted/10">
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10 border-2 border-white shadow-sm ring-1 ring-border/50">
                            <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">{student.displayName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-black text-sm">{student.displayName}</div>
                            {routineLoading && !attendanceRoutineMap[student.id] && (
                              <Badge variant="outline" className="font-black text-[10px]">루틴 확인중</Badge>
                            )}
                            {!routineLoading && !hasAttendanceRoutine && (
                              <Badge className="font-black text-[10px] border-none bg-amber-100 text-amber-700">미작성</Badge>
                            )}
                            {noShowFlag && (
                              <Badge className="font-black text-[10px] border-none bg-rose-100 text-rose-700">미등원</Badge>
                            )}
                            {scheduleChangeRequest ? (
                              <Badge className="font-black text-[10px] border-none bg-sky-100 text-sky-700">학원 일정 확인</Badge>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <Badge
                            variant={getBadgeVariant(status) as any}
                            className={cn(
                              "w-fit font-black text-[10px] rounded-md shadow-sm border-none",
                              status === 'missing_routine' && "bg-amber-100 text-amber-700",
                              status === 'confirmed_present_missing_routine' && "bg-emerald-100 text-emerald-700"
                            )}
                          >
                            {status === 'confirmed_present'
                              ? '출석'
                              : status === 'confirmed_present_missing_routine'
                                ? '출석(미작성)'
                              : status === 'confirmed_late'
                                ? '지각출석'
                                : status === 'confirmed_absent'
                                  ? '결석'
                                  : status === 'excused_absent'
                                    ? '사유결석'
                                    : status === 'missing_routine'
                                      ? '미작성'
                                      : '미확인'}
                          </Badge>
                          {routine?.hasExcursion ? (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                              <MapPinned className="h-3.5 w-3.5" />
                              {isExcursionInProgress(routine)
                                ? '학원/외출 중'
                                : routine.scheduleMovementSummary || `학원/외출 ${routine.excursionStartAt} ~ ${routine.excursionEndAt}`}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="grid gap-1">
                          <div className="flex items-center gap-1.5 text-xs font-black text-[#17326B]">
                            <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                            {formatScheduleTimeRange(routine)}
                          </div>
                          {routine?.classScheduleName?.trim() ? (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#5F739F]">
                              <ClipboardCheck className="h-3.5 w-3.5" />
                              {toStudyRoomTrackScheduleName(routine.classScheduleName)}
                            </div>
                          ) : null}
                          {routine?.scheduleMovementSummary ? (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#C95A08]">
                              <MapPinned className="h-3.5 w-3.5" />
                              {routine.scheduleMovementSummary}
                            </div>
                          ) : null}
                          {scheduleChangeRequest ? (
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-sky-700">
                              <ShieldAlert className="h-3.5 w-3.5" />
                              당일 변경 접수됨 · 학부모 확인 권장
                            </div>
                          ) : null}
                          {routine?.isNoAttendanceDay ? (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-500">
                              <CalendarX className="h-3.5 w-3.5" />
                              미등원 등록
                            </div>
                          ) : noShowFlag ? (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-500">
                              <ShieldAlert className="h-3.5 w-3.5" />
                              예정 시간 경과, 체크인 없음
                            </div>
                          ) : routine?.actualArrivalAt || checkedAt ? (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                              <LogIn className="h-3.5 w-3.5" />
                              체크인 완료
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs font-bold text-muted-foreground">
                        {formatLastVisitAt(checkedAt ?? null)}
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <Select value={manualStatus} onValueChange={(newStatus) => handleStatusChange(student.id, newStatus as any, checkedAt)}>
                          <SelectTrigger className="w-[120px] h-10 rounded-xl font-bold border-2 ml-auto">
                            <SelectValue placeholder="상태 설정" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl shadow-2xl border-none">
                            <SelectItem value="confirmed_present" className="font-bold">출석</SelectItem>
                            <SelectItem value="confirmed_late" className="font-bold">지각출석</SelectItem>
                            <SelectItem value="confirmed_absent" className="font-bold text-rose-600">무단결석</SelectItem>
                            <SelectItem value="excused_absent" className="font-bold text-blue-600">사유결석</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
              </div>
              }
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kpi" className="animate-in fade-in duration-500">
          <AttendanceKpiBoard
            firestore={firestore}
            centerId={centerId}
            students={students || undefined}
            requests={requests || undefined}
            attendanceCurrentDocs={attendanceCurrentDocs || undefined}
          />
        </TabsContent>

        <TabsContent value="requests" className="animate-in fade-in duration-500">
          <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden ring-1 ring-border/50">
            <CardHeader className="bg-muted/5 border-b p-8">
              <CardTitle className="text-xl font-black tracking-tight">트랙제 및 출결 변경 신청 관리</CardTitle>
              <CardDescription className="text-xs font-bold text-muted-foreground">센터 공통 트랙제를 기준으로 학생들의 당일 변경 사유를 함께 검토합니다.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {requestsLoading ? <div className='flex justify-center py-20'><Loader2 className="h-8 w-8 animate-spin text-primary opacity-20"/></div> :
              <div className="divide-y divide-muted/10">
                <div className="space-y-6 border-b border-muted/10 bg-slate-50/30 p-6">
                  <div className="rounded-[1.8rem] border border-[#DCE6F7] bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#5F739F]">센터 공통 트랙제</p>
                        <h3 className="mt-1 text-lg font-black tracking-tight text-[#17326B]">전달해주신 독서실 트랙제를 기본값으로 적용</h3>
                        <p className="mt-1 text-[11px] font-semibold leading-5 text-[#5F739F]">
                          선생님이 반마다 따로 등록하지 않아도 학생 출석정보 수정 화면에서 이 공통 트랙제가 기본값으로 바로 적용됩니다.
                        </p>
                      </div>
                      <Badge className="h-10 rounded-full border border-[#DCE6F7] bg-[#F8FBFF] px-4 text-[11px] font-black text-[#17326B] shadow-none">
                        학생 기본값 적용 중
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-3">
                      {visibleClassSchedules.length === 0 ? (
                        <div className="rounded-[1rem] border border-dashed border-[#DCE6F7] bg-[#F8FBFF] px-4 py-6 text-center text-[11px] font-semibold text-[#5F739F]">
                          공통 트랙제 정보를 아직 불러오지 못했어요.
                        </div>
                      ) : visibleClassSchedules.map((schedule) => (
                        <div key={schedule.id} className="rounded-[1.1rem] border border-[#E4ECF9] bg-[#F9FBFF] p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-black text-[#17326B]">{getStudyRoomClassScheduleDisplayName(schedule)}</p>
                                <Badge variant="outline" className="rounded-full border-[#DCE6F7] bg-white text-[10px] font-black text-[#5F739F]">
                                  {formatStudyRoomWeekdays(schedule.weekdays)}
                                </Badge>
                              </div>
                              <p className="mt-2 text-[11px] font-semibold leading-5 text-[#17326B]">{buildStudyRoomClassScheduleSummary(schedule)}</p>
                              {schedule.note?.trim() ? (
                                <p className="mt-1 text-[11px] font-semibold leading-5 text-[#5F739F]">{schedule.note.trim()}</p>
                              ) : null}
                            </div>
                            <Badge className="rounded-full border border-[#DCE6F7] bg-white px-3 py-1 text-[10px] font-black text-[#17326B] shadow-none">
                              학생 일정 기본값
                            </Badge>
                          </div>
                          {schedule.blocks?.length ? (
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                              {schedule.blocks.map((block) => (
                                <div key={block.id} className="rounded-[0.95rem] border border-white bg-white px-3 py-2.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-black text-[#17326B]">{block.label}</p>
                                    <span className="text-[10px] font-black text-[#5F739F]">{block.startTime} ~ {block.endTime}</span>
                                  </div>
                                  {block.description?.trim() ? (
                                    <p className="mt-1 text-[11px] font-semibold leading-5 text-[#5F739F]">{block.description.trim()}</p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 border-b border-muted/10 bg-slate-50/40 p-6 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">오늘 대기 건수</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{requestOpsSummary.pendingTodayCount}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">24시간 초과</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{requestOpsSummary.overduePendingCount}</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">평균 처리시간</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{requestOpsSummary.averageProcessingHours}h</p>
                  </div>
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">반복 신청 학생</p>
                    <p className="mt-2 text-2xl font-black tracking-tight text-[#14295F]">{requestOpsSummary.repeatRequesterCount}</p>
                  </div>
                </div>
                {requests?.length === 0 ? (
                  <div className="py-20 text-center opacity-20 italic font-black text-sm">접수된 신청 내역이 없습니다.</div>
                ) : requests?.map((req) => {
                  const relatedRoutine =
                    req.type === 'schedule_change' && (!dateKey || req.date === dateKey)
                      ? mergedScheduleMap.get(req.studentId)
                      : null;

                  return (
                  <div key={req.id} className="p-8 hover:bg-muted/5 transition-all group">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex items-start gap-5">
                        <div className={cn("h-14 w-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border-2", req.type === 'late' ? "bg-amber-50 border-amber-100 text-amber-600" : req.type === 'schedule_change' ? "bg-sky-50 border-sky-100 text-sky-600" : "bg-rose-50 border-rose-100 text-rose-600")}>
                          {req.type === 'late' ? <Clock className="h-6 w-6" /> : req.type === 'schedule_change' ? <CalendarClock className="h-6 w-6" /> : <CalendarX className="h-6 w-6" />}
                          <span className="text-[8px] font-black uppercase mt-1">{getAttendanceRequestTypeLabel(req.type)}</span>
                        </div>
                        <div className="grid gap-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-lg tracking-tight">{req.studentName} 학생</span>
                            <Badge variant="outline" className="font-bold text-[10px] rounded-md h-5 px-2 bg-white">{req.date} 신청</Badge>
                            {req.penaltyApplied ? (
                              <Badge className="bg-rose-100 text-rose-600 border-none font-black text-[9px]">벌점 대상</Badge>
                            ) : req.penaltyWaived ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[9px]">벌점 면제</Badge>
                            ) : null}
                            {req.reasonCategory ? (
                              <Badge variant="outline" className="font-bold text-[10px] rounded-md h-5 px-2 bg-white">
                                {getScheduleChangeReasonLabel(req.reasonCategory)}
                              </Badge>
                            ) : null}
                            {req.reasonCategory === 'hospital' ? (
                              req.parentContactConfirmed ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[9px]">학부모 연락 확인</Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-700 border-none font-black text-[9px]">학부모 연락 필요</Badge>
                              )
                            ) : null}
                            {req.type === 'schedule_change' && req.status === 'requested' ? (
                              <Badge className="bg-sky-100 text-sky-700 border-none font-black text-[9px]">학원 일정 확인 필요</Badge>
                            ) : null}
                          </div>
                          {req.type === 'schedule_change' ? (
                            <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-[#5F739F]">
                              {req.requestedArrivalTime && req.requestedDepartureTime ? (
                                <span>등하원 {req.requestedArrivalTime} ~ {req.requestedDepartureTime}</span>
                              ) : null}
                              {req.requestedAcademyStartTime && req.requestedAcademyEndTime ? (
                                <span>학원 {req.requestedAcademyStartTime} ~ {req.requestedAcademyEndTime}{req.requestedAcademyName ? ` · ${req.requestedAcademyName}` : ''}</span>
                              ) : null}
                              {req.classScheduleName?.trim() ? <span>{toStudyRoomTrackScheduleName(req.classScheduleName)}</span> : null}
                              {relatedRoutine?.scheduleMovementSummary ? (
                                <span>현재 저장 일정 · {relatedRoutine.scheduleMovementSummary}</span>
                              ) : null}
                              {relatedRoutine?.classScheduleName?.trim() ? (
                                <span>적용 트랙 · {toStudyRoomTrackScheduleName(relatedRoutine.classScheduleName)}</span>
                              ) : null}
                            </div>
                          ) : null}
                          {req.type === 'schedule_change' && req.status === 'requested' ? (
                            <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                              <p className="text-[11px] font-black leading-5 text-sky-800">
                                학생이 당일 학원/외출 또는 등하원 일정을 바꿨어요. 저장된 일정이 실제 학원 일정과 맞는지 학부모님께 확인하면 됩니다.
                              </p>
                            </div>
                          ) : null}
                          <div className="p-4 rounded-2xl bg-[#fafafa] border shadow-inner">
                            <p className="text-sm font-bold text-foreground/80 leading-relaxed break-keep">“{req.reason}”</p>
                          </div>
                          {req.proofAttachments?.length ? (
                            <div className="flex flex-wrap gap-2">
                              {req.proofAttachments.map((attachment) => (
                                <a
                                  key={attachment.id}
                                  href={attachment.downloadUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="overflow-hidden rounded-xl border border-[#DCE6F7] bg-white"
                                >
                                  <img src={attachment.downloadUrl} alt={attachment.name} className="h-16 w-16 object-cover" />
                                </a>
                              ))}
                            </div>
                          ) : null}
                          {req.reasonCategory === 'hospital' && (!req.proofAttachments?.length || !req.parentContactConfirmed) ? (
                            <p className="text-[10px] font-black text-amber-600">
                              {!req.proofAttachments?.length && !req.parentContactConfirmed
                                ? '진료 확인·처방 자료와 학부모님 연락 확인이 없어 벌점 면제 조건을 충족하지 못했습니다.'
                                : !req.proofAttachments?.length
                                  ? '진료 확인·처방 자료가 없어 벌점 면제 조건을 충족하지 못했습니다.'
                                  : '학부모님 연락 확인이 없어 벌점 면제 조건을 충족하지 못했습니다.'}
                            </p>
                          ) : null}
                          <p className="text-[10px] font-bold text-muted-foreground ml-1">신청 시각: {req.createdAt ? format(req.createdAt.toDate(), 'yyyy.MM.dd HH:mm') : '-'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                        {req.status === 'requested' ? (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleRequestAction(req.id, 'approved')} disabled={isProcessing} className="bg-emerald-500 hover:bg-emerald-600 rounded-xl h-10 px-6 font-black gap-2 shadow-lg shadow-emerald-100">
                              <CheckCircle2 className="h-4 w-4" /> 승인
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleRequestAction(req.id, 'rejected')} disabled={isProcessing} className="text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl h-10 px-6 font-black gap-2">
                              <XCircle className="h-4 w-4" /> 반려
                            </Button>
                          </div>
                        ) : (
                          <Badge className={cn(
                            "rounded-full px-4 py-1.5 font-black text-xs shadow-sm",
                            req.status === 'approved' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                          )}>
                            {req.status === 'approved' ? '최종 승인됨' : '반려 처리됨'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
              }
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
