'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { collection, collectionGroup, getDocs, limit, query, where } from 'firebase/firestore';

import { useCollection, useFirestore } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { logHandledClientIssue } from '@/lib/handled-client-log';
import {
  buildAttendanceRoutineInfo,
  deriveAttendanceDisplayState,
  toDateSafe,
  type AttendanceRecordStatus,
  type AttendanceRoutineInfo,
} from '@/lib/attendance-auto';
import {
  buildAttendanceBoardFlags,
  buildAttendanceBoardNote,
  buildAttendanceBoardSummary,
  formatAttendanceBoardClockLabel,
  formatAttendanceBoardMinutes,
  getAttendanceBoardStatusLabel,
  resolveAttendanceOperationalException,
  resolveAttendanceBoardStatus,
  resolveAttendanceRiskLevel,
  type CenterAdminAttendanceBoardSummary,
  type CenterAdminAttendanceSeatSignal,
} from '@/lib/center-admin-attendance-board';
import { resolveSeatIdentity } from '@/lib/seat-layout';
import type {
  AttendanceCurrent,
  CenterMembership,
  DailyStudentStat,
  StudentScheduleDoc,
  StudentScheduleOuting,
  StudentScheduleTemplate,
  StudentProfile,
} from '@/lib/types';

type AttendanceBoardRecord = {
  id: string;
  status?: AttendanceRecordStatus;
  statusSource?: 'auto' | 'manual' | string;
  updatedAt?: unknown;
  checkInAt?: unknown;
  routineMissingAtCheckIn?: boolean;
};

type ResolvedAttendanceSeat = AttendanceCurrent & {
  roomId: string;
  roomSeatNo: number;
};

type ScheduleMovementInfo = {
  scheduleMovementLabel: string | null;
  scheduleMovementRange: string | null;
  scheduleMovementSummary: string | null;
  scheduleMovementCount: number;
  hasScheduleMovement: boolean;
  movementStartAt: string | null;
  movementEndAt: string | null;
  movementReason: string | null;
};

type AttendanceRoutineInfoWithMovement = AttendanceRoutineInfo & ScheduleMovementInfo;

type UseCenterAdminAttendanceBoardOptions = {
  centerId?: string;
  isActive: boolean;
  selectedClass?: string;
  referenceDate?: Date | null;
  students?: StudentProfile[] | null;
  studentMembers?: CenterMembership[] | null;
  attendanceList?: AttendanceCurrent[] | null;
  todayStats?: DailyStudentStat[] | null;
  nowMs?: number;
};

function getScheduleTemplateTimestampMs(template: StudentScheduleTemplate) {
  const raw = template.updatedAt || template.createdAt;
  if (!raw) return 0;
  if (raw instanceof Date) return raw.getTime();
  if (typeof (raw as any).toDate === 'function') return (raw as any).toDate().getTime();
  return 0;
}

const EMPTY_SCHEDULE_MOVEMENT_INFO: ScheduleMovementInfo = {
  scheduleMovementLabel: null,
  scheduleMovementRange: null,
  scheduleMovementSummary: null,
  scheduleMovementCount: 0,
  hasScheduleMovement: false,
  movementStartAt: null,
  movementEndAt: null,
  movementReason: null,
};

function resolveMovementLabel(outing: Pick<StudentScheduleOuting, 'kind' | 'reason' | 'title'>) {
  const text = `${outing.reason || ''} ${outing.title || ''}`.trim();
  if (outing.kind === 'academy' || text.includes('학원')) return '학원';
  return '외출';
}

function buildScheduleMovementInfo(outings: StudentScheduleOuting[] | undefined | null): ScheduleMovementInfo {
  const validOutings = (outings || []).filter((outing) => outing.startTime && outing.endTime);
  const firstOuting = validOutings[0];
  if (!firstOuting) return EMPTY_SCHEDULE_MOVEMENT_INFO;

  const label = resolveMovementLabel(firstOuting);
  const range = `${firstOuting.startTime}~${firstOuting.endTime}`;
  const extraCount = validOutings.length - 1;
  return {
    scheduleMovementLabel: label,
    scheduleMovementRange: range,
    scheduleMovementSummary: `${label} ${range}${extraCount > 0 ? ` +${extraCount}` : ''}`,
    scheduleMovementCount: validOutings.length,
    hasScheduleMovement: true,
    movementStartAt: firstOuting.startTime,
    movementEndAt: firstOuting.endTime,
    movementReason: firstOuting.reason || firstOuting.title || label,
  };
}

function buildScheduleMovementInfoFromTemplate(template: StudentScheduleTemplate): ScheduleMovementInfo {
  const outings: StudentScheduleOuting[] = [];
  if (template.academyStartAtDefault && template.academyEndAtDefault) {
    outings.push({
      id: 'academy-template',
      kind: 'academy',
      title: null,
      startTime: template.academyStartAtDefault,
      endTime: template.academyEndAtDefault,
      reason: template.academyNameDefault || '학원',
    });
  }
  if (template.hasExcursionDefault && template.defaultExcursionStartAt && template.defaultExcursionEndAt) {
    outings.push({
      id: 'outing-template',
      kind: 'outing',
      title: null,
      startTime: template.defaultExcursionStartAt,
      endTime: template.defaultExcursionEndAt,
      reason: template.defaultExcursionReason || '외출',
    });
  }
  return buildScheduleMovementInfo(outings);
}

function buildScheduleMovementInfoFromLegacyTitles(scheduleTitles: string[]): ScheduleMovementInfo {
  const outingTitles = scheduleTitles.filter((title) => title.includes('학원/외출 예정'));
  const outings = outingTitles
    .map((title, index) => {
      const match = title.match(/([01]\d|2[0-3]):[0-5]\d\s*~\s*([01]\d|2[0-3]):[0-5]\d/);
      if (!match) return null;
      const [startTime, endTime] = match[0].split('~').map((value) => value.trim());
      return {
        id: `legacy-outing-${index + 1}`,
        kind: title.includes('학원') ? 'academy' as const : 'outing' as const,
        title: null,
        startTime,
        endTime,
        reason: title.includes('학원') ? '학원' : '외출',
      };
    })
    .filter(Boolean) as StudentScheduleOuting[];

  return buildScheduleMovementInfo(outings);
}

function buildRoutineInfoFromSchedule(schedule: StudentScheduleDoc): AttendanceRoutineInfoWithMovement {
  return {
    hasRoutine: true,
    isNoAttendanceDay: Boolean(schedule.isAbsent || schedule.status === 'absent'),
    expectedArrivalTime: schedule.arrivalPlannedAt || schedule.inTime || null,
    plannedDepartureTime: schedule.departurePlannedAt || schedule.outTime || null,
    classScheduleName: schedule.classScheduleName || null,
    ...(schedule.isAbsent || schedule.status === 'absent'
      ? EMPTY_SCHEDULE_MOVEMENT_INFO
      : buildScheduleMovementInfo(
          schedule.outings?.length
            ? schedule.outings
            : schedule.hasExcursion && schedule.excursionStartAt && schedule.excursionEndAt
              ? [{
                  id: 'legacy-excursion',
                  kind: 'outing',
                  title: null,
                  startTime: schedule.excursionStartAt,
                  endTime: schedule.excursionEndAt,
                  reason: schedule.excursionReason || '외출',
                }]
              : []
        )),
  };
}

function buildRoutineInfoFromTemplate(template: StudentScheduleTemplate): AttendanceRoutineInfoWithMovement {
  return {
    hasRoutine: true,
    isNoAttendanceDay: false,
    expectedArrivalTime: template.arrivalPlannedAt || null,
    plannedDepartureTime: template.departurePlannedAt || null,
    classScheduleName: template.classScheduleName || null,
    ...buildScheduleMovementInfoFromTemplate(template),
  };
}

export function useCenterAdminAttendanceBoard({
  centerId,
  isActive,
  selectedClass = 'all',
  referenceDate,
  students,
  studentMembers,
  attendanceList,
  todayStats,
  nowMs = Date.now(),
}: UseCenterAdminAttendanceBoardOptions) {
  const firestore = useFirestore();
  const today = useMemo(() => (referenceDate ? new Date(referenceDate) : new Date()), [referenceDate]);
  const todayKey = format(today, 'yyyy-MM-dd');
  const weekKey = format(today, "yyyy-'W'II");
  const weekday = today.getDay();
  const historyKeys = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const target = new Date(today);
        target.setDate(today.getDate() - (6 - index));
        return format(target, 'yyyy-MM-dd');
      }),
    [today]
  );

  const activeMembers = useMemo(
    () =>
      (studentMembers || []).filter(
        (member) =>
          Boolean(member) &&
          member.role === 'student' &&
          member.status === 'active' &&
          (selectedClass === 'all' || member.className === selectedClass)
      ),
    [selectedClass, studentMembers]
  );

  const targetMemberIds = useMemo(
    () => new Set(activeMembers.map((member) => member.id)),
    [activeMembers]
  );

  const resolvedAttendanceList = useMemo<ResolvedAttendanceSeat[]>(
    () =>
      (attendanceList || []).map((seat) => {
        const identity = resolveSeatIdentity(seat);
        return {
          ...seat,
          roomId: identity.roomId,
          roomSeatNo: identity.roomSeatNo,
          seatNo: identity.seatNo,
        };
      }),
    [attendanceList]
  );

  const todayRecordsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isActive) return null;
    return collection(firestore, 'centers', centerId, 'attendanceRecords', todayKey, 'students');
  }, [firestore, centerId, isActive, todayKey]);
  const { data: todayRecords, isLoading: todayRecordsLoading } = useCollection<AttendanceBoardRecord>(
    todayRecordsQuery,
    { enabled: isActive }
  );
  const todaySchedulesQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isActive) return null;
    return query(
      collectionGroup(firestore, 'schedules'),
      where('centerId', '==', centerId),
      where('dateKey', '==', todayKey)
    );
  }, [firestore, centerId, isActive, todayKey]);
  const { data: todaySchedules, isLoading: todaySchedulesLoading } = useCollection<StudentScheduleDoc>(
    todaySchedulesQuery,
    { enabled: isActive }
  );

  const [historyRecordsByDate, setHistoryRecordsByDate] = useState<Record<string, AttendanceBoardRecord[]>>({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [routineInfoByStudentId, setRoutineInfoByStudentId] = useState<Record<string, AttendanceRoutineInfoWithMovement>>({});
  const [routineLoading, setRoutineLoading] = useState(false);

  useEffect(() => {
    if (!firestore || !centerId || !isActive) {
      setHistoryRecordsByDate({});
      setHistoryLoading(false);
      return;
    }

    let cancelled = false;
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const entries = await Promise.all(
          historyKeys.map(async (dateKey) => {
            const snap = await getDocs(collection(firestore, 'centers', centerId, 'attendanceRecords', dateKey, 'students'));
            const rows = snap.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as Omit<AttendanceBoardRecord, 'id'>) }));
            return [dateKey, rows] as const;
          })
        );

        if (!cancelled) {
          setHistoryRecordsByDate(Object.fromEntries(entries));
        }
      } catch (error) {
        logHandledClientIssue('[center-admin-attendance-board] history load failed', error);
        if (!cancelled) {
          setHistoryRecordsByDate({});
        }
      } finally {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      }
    };

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [centerId, firestore, historyKeys, isActive]);

  useEffect(() => {
    if (!firestore || !centerId || !isActive || activeMembers.length === 0) {
      setRoutineInfoByStudentId({});
      setRoutineLoading(false);
      return;
    }

    let cancelled = false;
    const loadRoutineInfo = async () => {
      setRoutineLoading(true);
      try {
        const scheduleByStudentId = new Map<string, StudentScheduleDoc>();
        (todaySchedules || []).forEach((schedule) => {
          if (!schedule.uid) return;
          scheduleByStudentId.set(schedule.uid, schedule);
        });
        const entries = await Promise.all(
          activeMembers.map(async (member) => {
            const directSchedule = scheduleByStudentId.get(member.id);
            if (directSchedule) {
              return [member.id, buildRoutineInfoFromSchedule(directSchedule)] as const;
            }

            try {
              const templateSnap = await getDocs(query(
                collection(firestore, 'users', member.id, 'scheduleTemplates'),
                where('centerId', '==', centerId)
              ));
              const matchingTemplate = templateSnap.docs
                .map((docSnap) => ({ ...(docSnap.data() as StudentScheduleTemplate), id: docSnap.id }))
                .filter((template) => template.active !== false)
                .filter((template) => !template.centerId || template.centerId === centerId)
                .filter((template) => Array.isArray(template.weekdays) && template.weekdays.includes(weekday))
                .sort((left, right) => getScheduleTemplateTimestampMs(right) - getScheduleTemplateTimestampMs(left))[0];

              if (matchingTemplate) {
                return [member.id, buildRoutineInfoFromTemplate(matchingTemplate)] as const;
              }
            } catch (templateError) {
              logHandledClientIssue('[center-admin-attendance-board] schedule template fallback failed', templateError);
            }

            const routineQuery = query(
              collection(firestore, 'centers', centerId, 'plans', member.id, 'weeks', weekKey, 'items'),
              where('dateKey', '==', todayKey),
              where('category', '==', 'schedule'),
              limit(12)
            );
            const snap = await getDocs(routineQuery);
            const scheduleTitles = snap.docs.map((docSnap) => String(docSnap.data()?.title || ''));
            return [
              member.id,
              {
                ...buildAttendanceRoutineInfo(scheduleTitles),
                ...buildScheduleMovementInfoFromLegacyTitles(scheduleTitles),
              },
            ] as const;
          })
        );

        if (!cancelled) {
          setRoutineInfoByStudentId(Object.fromEntries(entries));
        }
      } catch (error) {
        logHandledClientIssue('[center-admin-attendance-board] routine load failed', error);
        if (!cancelled) {
          setRoutineInfoByStudentId({});
        }
      } finally {
        if (!cancelled) {
          setRoutineLoading(false);
        }
      }
    };

    void loadRoutineInfo();
    return () => {
      cancelled = true;
    };
  }, [activeMembers, centerId, firestore, isActive, todayKey, todaySchedules, weekday, weekKey]);

  const studentById = useMemo(() => new Map((students || []).map((student) => [student.id, student])), [students]);
  const memberById = useMemo(() => new Map((studentMembers || []).map((member) => [member.id, member])), [studentMembers]);
  const todayRecordByStudentId = useMemo(
    () => new Map((todayRecords || []).map((record) => [record.id, record])),
    [todayRecords]
  );
  const todayStatsByStudentId = useMemo(
    () => new Map((todayStats || []).map((stat) => [stat.studentId, stat])),
    [todayStats]
  );
  const todayScheduleByStudentId = useMemo(() => {
    const mapped = new Map<string, StudentScheduleDoc>();
    (todaySchedules || []).forEach((schedule) => {
      if (!schedule.uid) return;
      mapped.set(schedule.uid, schedule);
    });
    return mapped;
  }, [todaySchedules]);

  const historySummaryByStudentId = useMemo(() => {
    const bucket = new Map<string, { lateCount: number; absentCount: number; routineMissingCount: number }>();
    activeMembers.forEach((member) => {
      bucket.set(member.id, { lateCount: 0, absentCount: 0, routineMissingCount: 0 });
    });

    historyKeys.forEach((dateKey) => {
      (historyRecordsByDate[dateKey] || []).forEach((record) => {
        if (!bucket.has(record.id)) return;
        const summary = bucket.get(record.id)!;
        if (record.status === 'confirmed_late') summary.lateCount += 1;
        if (record.status === 'confirmed_absent') summary.absentCount += 1;
        if (record.routineMissingAtCheckIn) summary.routineMissingCount += 1;
      });
    });

    return bucket;
  }, [activeMembers, historyKeys, historyRecordsByDate]);

  const seatSignals = useMemo<CenterAdminAttendanceSeatSignal[]>(() => {
    return resolvedAttendanceList
      .filter((seat) => seat.studentId && targetMemberIds.has(seat.studentId))
      .map((seat) => {
        const studentId = seat.studentId as string;
        const student = studentById.get(studentId);
        const member = memberById.get(studentId);
        const todayStat = todayStatsByStudentId.get(studentId);
        const rawRoutineInfo = routineInfoByStudentId[studentId];
        const todaySchedule = todayScheduleByStudentId.get(studentId);
        const routineInfo = rawRoutineInfo || (todaySchedule ? buildRoutineInfoFromSchedule(todaySchedule) : undefined);
        const scheduleMovementInfo = routineInfo?.isNoAttendanceDay ? EMPTY_SCHEDULE_MOVEMENT_INFO : routineInfo || EMPTY_SCHEDULE_MOVEMENT_INFO;
        const todayRecord = todayRecordByStudentId.get(studentId);
        const historySummary = historySummaryByStudentId.get(studentId) || {
          lateCount: 0,
          absentCount: 0,
          routineMissingCount: 0,
        };

        const lastCheckInAt = toDateSafe(seat.lastCheckInAt);
        const liveSessionMinutes =
          seat.status === 'studying' && lastCheckInAt
            ? Math.max(0, Math.ceil((nowMs - lastCheckInAt.getTime()) / 60000))
            : 0;
        const recordedStudyMinutes = Math.max(0, Math.round(Number(todayStat?.totalStudyMinutes || 0)));
        const totalStudyMinutes = recordedStudyMinutes + liveSessionMinutes;
        const currentAwayMinutes =
          (seat.status === 'away' || seat.status === 'break') && lastCheckInAt
            ? Math.max(0, Math.floor((nowMs - lastCheckInAt.getTime()) / 60000))
            : 0;
        const isLongAway = currentAwayMinutes >= 20;
        const isReturned =
          seat.status === 'studying' &&
          recordedStudyMinutes >= 1 &&
          Boolean(lastCheckInAt && format(lastCheckInAt, 'yyyy-MM-dd') === todayKey);

        const derived = deriveAttendanceDisplayState({
          selectedDate: today,
          dateKey: todayKey,
          todayDateKey: todayKey,
          routine: routineInfo,
          recordStatus: todayRecord?.status,
          recordStatusSource: todayRecord?.statusSource,
          recordRoutineMissingAtCheckIn: Boolean(todayRecord?.routineMissingAtCheckIn),
          recordCheckedAt: toDateSafe(todayRecord?.checkInAt),
          liveCheckedAt: lastCheckInAt,
          accessCheckedAt: lastCheckInAt,
          studyCheckedAt:
            recordedStudyMinutes > 0
              ? toDateSafe(todayRecord?.checkInAt) || lastCheckInAt || toDateSafe(todayRecord?.updatedAt)
              : null,
          studyMinutes: recordedStudyMinutes,
          hasStudyLog: recordedStudyMinutes > 0,
          nowMs,
          isRoutineLoading: routineLoading,
          isStudyLogLoading: false,
        });

        const hasAttendanceEvidence =
          seat.status !== 'absent' ||
          derived.status === 'confirmed_present' ||
          derived.status === 'confirmed_late' ||
          derived.status === 'confirmed_present_missing_routine' ||
          recordedStudyMinutes > 0 ||
          Boolean(derived.checkedAt);

        const { level: attendanceRiskLevel, label: attendanceRiskLabel } = resolveAttendanceRiskLevel({
          lateCount: historySummary.lateCount,
          absentCount: historySummary.absentCount,
          routineMissingCount: historySummary.routineMissingCount,
        });

        const boardStatus = resolveAttendanceBoardStatus({
          seatStatus: seat.status,
          displayStatus: derived.status,
          hasAttendanceEvidence,
          isReturned,
        });

        const flags = buildAttendanceBoardFlags({
          displayStatus: derived.status,
          attendanceRiskLevel,
          isLongAway,
        });
        const operationalException = resolveAttendanceOperationalException({
          boardStatus,
          plannedDepartureTime: routineInfo?.plannedDepartureTime || todaySchedule?.departurePlannedAt || null,
          hasExcursion: Boolean(scheduleMovementInfo.hasScheduleMovement),
          excursionStartAt: scheduleMovementInfo.movementStartAt,
          excursionEndAt: scheduleMovementInfo.movementEndAt,
          excursionReason: scheduleMovementInfo.movementReason,
          currentAwayMinutes,
          nowMs,
        });

        return {
          seatId: seat.id,
          studentId,
          studentName: student?.name || member?.displayName || '학생',
          className: member?.className,
          roomId: seat.roomId,
          roomSeatNo: seat.roomSeatNo,
          seatStatus: seat.status,
          attendanceDisplayStatus: derived.status,
          boardStatus,
          boardLabel: getAttendanceBoardStatusLabel(boardStatus),
          todayStudyMinutes: totalStudyMinutes,
          todayStudyLabel: formatAttendanceBoardMinutes(totalStudyMinutes),
          liveSessionMinutes,
          isNoAttendanceDay: Boolean(routineInfo?.isNoAttendanceDay),
          routineExpectedArrivalTime: routineInfo?.expectedArrivalTime || null,
          plannedDepartureTime: routineInfo?.plannedDepartureTime || todaySchedule?.departurePlannedAt || null,
          classScheduleName: todaySchedule?.classScheduleName || routineInfo?.classScheduleName || null,
          hasExcursion: Boolean(scheduleMovementInfo.hasScheduleMovement),
          excursionStartAt: scheduleMovementInfo.movementStartAt,
          excursionEndAt: scheduleMovementInfo.movementEndAt,
          excursionReason: scheduleMovementInfo.movementReason,
          scheduleMovementLabel: scheduleMovementInfo.scheduleMovementLabel,
          scheduleMovementRange: scheduleMovementInfo.scheduleMovementRange,
          scheduleMovementSummary: scheduleMovementInfo.scheduleMovementSummary,
          scheduleMovementCount: scheduleMovementInfo.scheduleMovementCount,
          checkedAtLabel: formatAttendanceBoardClockLabel(derived.checkedAt),
          attendanceRiskLevel,
          attendanceRiskLabel,
          recentLateCount: historySummary.lateCount,
          recentAbsentCount: historySummary.absentCount,
          recentRoutineMissingCount: historySummary.routineMissingCount,
          currentAwayMinutes,
          isLongAway,
          isReturned,
          isCheckedOut: boardStatus === 'checked_out',
          hasAttendanceEvidence,
          operationalExceptionKind: operationalException?.kind || null,
          operationalExceptionLabel: operationalException?.label || null,
          operationalExceptionNote: operationalException?.note || null,
          flags,
          note: buildAttendanceBoardNote({
            boardStatus,
            displayStatus: derived.status,
            expectedArrivalTime: routineInfo?.expectedArrivalTime,
            currentAwayMinutes,
            attendanceRiskLabel,
          }),
        };
      });
  }, [
    historySummaryByStudentId,
    memberById,
    nowMs,
    resolvedAttendanceList,
    routineInfoByStudentId,
    routineLoading,
    studentById,
    targetMemberIds,
    today,
    todayKey,
    todayRecordByStudentId,
    todayScheduleByStudentId,
    todayStatsByStudentId,
  ]);

  const seatSignalsBySeatId = useMemo(
    () => new Map(seatSignals.map((signal) => [signal.seatId, signal])),
    [seatSignals]
  );

  const seatSignalsByStudentId = useMemo(
    () => new Map(seatSignals.map((signal) => [signal.studentId, signal])),
    [seatSignals]
  );

  const summary = useMemo<CenterAdminAttendanceBoardSummary>(
    () => buildAttendanceBoardSummary(seatSignals),
    [seatSignals]
  );

  return {
    seatSignals,
    seatSignalsBySeatId,
    seatSignalsByStudentId,
    summary,
    isLoading:
      todayRecordsLoading ||
      todaySchedulesLoading ||
      historyLoading ||
      routineLoading ||
      !students ||
      !studentMembers ||
      !attendanceList ||
      !todayStats,
  };
}
