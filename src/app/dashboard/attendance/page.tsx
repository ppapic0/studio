'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { collection, collectionGroup, deleteField, doc, getDoc, getDocs, limit, serverTimestamp, query, where, orderBy, Timestamp, writeBatch } from 'firebase/firestore';
import { Loader2, CheckCircle2, XCircle, Clock, CalendarX, UserCheck, ClipboardCheck, BarChart3, Megaphone, TrendingUp, CalendarClock, LogIn, MapPinned, ShieldAlert } from 'lucide-react';
import { CenterMembership, AttendanceRequest, AttendanceCurrent, StudentScheduleDoc } from '@/lib/types';
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
  scheduleStatus: StudentScheduleDoc['status'] | null;
  actualArrivalAt: Date | null;
};

export default function AttendancePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { activeMembership, memberships, membershipsLoading } = useAppContext();
  const { toast } = useToast();
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [attendanceRoutineMap, setAttendanceRoutineMap] = useState<Record<string, TodayScheduleInfo>>({});
  const [routineLoading, setRoutineLoading] = useState(false);
  const [studyLogMap, setStudyLogMap] = useState<Record<string, StudyLogSummary>>({});
  const [studyLogLoading, setStudyLogLoading] = useState(false);

  useEffect(() => {
    setSelectedDate(new Date());
  }, []);

  const classroomMembership = resolveMembershipByRole(
    activeMembership,
    memberships,
    (membership) => isTeacherOrAdminRole(membership.role) && isActiveMembershipStatus(membership.status)
  );
  const dateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const weekKey = selectedDate ? format(selectedDate, "yyyy-'W'II") : '';
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

  useEffect(() => {
    if (!firestore || !centerId || !isTeacherOrAdmin || !dateKey || !weekKey || !students) {
      setAttendanceRoutineMap({});
      return;
    }

    let cancelled = false;
    const loadRoutineMap = async () => {
      setRoutineLoading(true);
      try {
        const scheduledIds = new Set(todaySchedules?.map((schedule) => schedule.uid).filter(Boolean));
        const entries = await Promise.all(
          students
            .filter((student) => !scheduledIds.has(student.id))
            .map(async (student) => {
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
  }, [firestore, centerId, isTeacherOrAdmin, dateKey, weekKey, students, todaySchedules]);

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
      mapped.set(schedule.uid, {
        hasRoutine: true,
        isNoAttendanceDay: Boolean(schedule.isAbsent || schedule.status === 'absent'),
        expectedArrivalTime: schedule.arrivalPlannedAt || schedule.inTime || null,
        plannedDepartureTime: schedule.departurePlannedAt || schedule.outTime || null,
        hasExcursion: Boolean(schedule.hasExcursion),
        excursionStartAt: schedule.excursionStartAt || null,
        excursionEndAt: schedule.excursionEndAt || null,
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
        console.error('[attendance] auto-sync failed', error);
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
        description="오늘 출결, KPI, 신청 관리 화면을 같은 빠른 실행과 날짜 기준으로 이어서 봅니다."
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

      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="grid grid-cols-3 bg-muted/30 p-1 rounded-2xl border h-14 mb-8 max-w-2xl">
          <TabsTrigger value="attendance" className="rounded-xl font-black gap-2"><UserCheck className="h-4 w-4" /> 일일 출석체크</TabsTrigger>
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
                              {isExcursionInProgress(routine) ? '외출 중' : `외출 ${routine.excursionStartAt} ~ ${routine.excursionEndAt}`}
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
              <CardTitle className="text-xl font-black tracking-tight">지각/결석 신청서 관리</CardTitle>
              <CardDescription className="text-xs font-bold text-muted-foreground">학생들이 제출한 사유를 검토하고 승인합니다.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {requestsLoading ? <div className='flex justify-center py-20'><Loader2 className="h-8 w-8 animate-spin text-primary opacity-20"/></div> :
              <div className="divide-y divide-muted/10">
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
                ) : requests?.map((req) => (
                  <div key={req.id} className="p-8 hover:bg-muted/5 transition-all group">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex items-start gap-5">
                        <div className={cn("h-14 w-14 rounded-2xl flex flex-col items-center justify-center shrink-0 border-2", req.type === 'late' ? "bg-amber-50 border-amber-100 text-amber-600" : "bg-rose-50 border-rose-100 text-rose-600")}>
                          {req.type === 'late' ? <Clock className="h-6 w-6" /> : <CalendarX className="h-6 w-6" />}
                          <span className="text-[8px] font-black uppercase mt-1">{req.type === 'late' ? '지각' : '결석'}</span>
                        </div>
                        <div className="grid gap-1.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-lg tracking-tight">{req.studentName} 학생</span>
                            <Badge variant="outline" className="font-bold text-[10px] rounded-md h-5 px-2 bg-white">{req.date} 신청</Badge>
                            {req.penaltyApplied && <Badge className="bg-rose-100 text-rose-600 border-none font-black text-[9px]">당일벌점부과됨</Badge>}
                          </div>
                          <div className="p-4 rounded-2xl bg-[#fafafa] border shadow-inner">
                            <p className="text-sm font-bold text-foreground/80 leading-relaxed break-keep">“{req.reason}”</p>
                          </div>
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
                ))}
              </div>
              }
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
