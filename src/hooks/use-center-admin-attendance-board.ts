'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { collection, collectionGroup, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';

import { useCollection, useFirestore } from '@/firebase';
import { useMemoFirebase } from '@/hooks/use-memo-firebase';
import { logHandledClientIssue } from '@/lib/handled-client-log';
import { getStudyDayKey } from '@/lib/study-day';
import { getLiveStudySessionDurationMinutes, getStudySessionDurationMinutes } from '@/lib/study-session-time';
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
  SHORT_AWAY_NOT_RETURNED_THRESHOLD_MINUTES,
  type CenterAdminAttendanceBoardSummary,
  type CenterAdminAttendanceSeatSignal,
} from '@/lib/center-admin-attendance-board';
import { resolveSeatIdentity } from '@/lib/seat-layout';
import { buildStudyRoomClassSchedulesForClassName } from '@/lib/study-room-class-schedule';
import type {
  AttendanceCurrent,
  CenterMembership,
  DailyStudentStat,
  StudentScheduleDoc,
  StudentScheduleOuting,
  StudentScheduleTemplate,
  StudentProfile,
  StudyRoomClassScheduleTemplate,
} from '@/lib/types';

type AttendanceBoardRecord = {
  id: string;
  status?: AttendanceRecordStatus;
  statusSource?: 'auto' | 'manual' | string;
  updatedAt?: unknown;
  checkInAt?: unknown;
  routineMissingAtCheckIn?: boolean;
};

type AttendanceBoardEvent = {
  id: string;
  studentId?: string;
  dateKey?: string;
  eventType?: string;
  type?: string;
  occurredAt?: unknown;
  eventAt?: unknown;
  createdAt?: unknown;
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

type TodayStudyLogMinutesEntry = {
  minutes: number;
  hasSessions: boolean;
  firstSessionStartAtMs?: number | null;
};

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
  refreshKey?: number;
};

function getScheduleTemplateTimestampMs(template: StudentScheduleTemplate) {
  const raw = template.updatedAt || template.createdAt;
  if (!raw) return 0;
  if (raw instanceof Date) return raw.getTime();
  if (typeof (raw as any).toDate === 'function') return (raw as any).toDate().getTime();
  return 0;
}

function pickDateByMode(values: Array<Date | null | undefined>, mode: 'earliest' | 'latest') {
  const dates = values.filter((value): value is Date => value instanceof Date && Number.isFinite(value.getTime()));
  if (dates.length === 0) return null;
  return dates
    .slice()
    .sort((a, b) => mode === 'earliest' ? a.getTime() - b.getTime() : b.getTime() - a.getTime())[0] || null;
}

function pickAttendanceEventTime(
  events: AttendanceBoardEvent[],
  eventType: string,
  mode: 'earliest' | 'latest'
) {
  return pickDateByMode(
    events
      .filter((event) => getAttendanceBoardEventType(event) === eventType)
      .map((event) => getAttendanceEventDate(event)),
    mode
  );
}

function pickAttendanceEventTimeByTypes(
  events: AttendanceBoardEvent[],
  eventTypes: string[],
  mode: 'earliest' | 'latest'
) {
  const eventTypeSet = new Set(eventTypes);
  return pickDateByMode(
    events
      .filter((event) => eventTypeSet.has(getAttendanceBoardEventType(event)))
      .map((event) => getAttendanceEventDate(event)),
    mode
  );
}

function pickAttendanceEventTimeAfter(
  events: AttendanceBoardEvent[],
  eventType: string,
  after: Date | null | undefined,
  mode: 'earliest' | 'latest'
) {
  if (!after) return null;
  const afterMs = after.getTime();
  return pickDateByMode(
    events
      .filter((event) => getAttendanceBoardEventType(event) === eventType)
      .map((event) => getAttendanceEventDate(event))
      .filter((date): date is Date => date instanceof Date && date.getTime() >= afterMs),
    mode
  );
}

function getAttendanceBoardEventType(event: AttendanceBoardEvent) {
  return String(event.eventType || event.type || '').trim();
}

function getAttendanceEventDate(event: AttendanceBoardEvent) {
  return toDateSafe(event.occurredAt) || toDateSafe(event.eventAt) || toDateSafe(event.createdAt);
}

function isDateInStudyDay(date: Date | null | undefined, dateKey: string) {
  return Boolean(date && getStudyDayKey(date) === dateKey);
}

function toStudyDayDateSafe(value: unknown, dateKey: string) {
  const date = toDateSafe(value);
  return isDateInStudyDay(date, dateKey) ? date : null;
}

function isAttendanceEventInStudyDay(event: AttendanceBoardEvent, dateKey: string) {
  const occurredAt = getAttendanceEventDate(event);
  if (occurredAt) return isDateInStudyDay(occurredAt, dateKey);
  return event.dateKey === dateKey;
}

function normalizeSeatActiveAwayKind(value: unknown): AttendanceCurrent['activeAwayKind'] | null {
  return value === 'short' || value === 'long' ? value : null;
}

function getStudySessionStartDate(session: Record<string, unknown>) {
  return (
    toDateSafe(session.startTime) ||
    toDateSafe(session.startedAt) ||
    toDateSafe(session.startAt) ||
    toDateSafe(session.createdAt)
  );
}

function calculateClosedStudyMinutesFromAttendanceEvents(events: AttendanceBoardEvent[]) {
  const sortedEvents = events
    .map((event) => ({ event, occurredAt: getAttendanceEventDate(event) }))
    .filter((item): item is { event: AttendanceBoardEvent; occurredAt: Date } => Boolean(item.occurredAt))
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  let activeStartAt: Date | null = null;
  let totalMinutes = 0;

  sortedEvents.forEach(({ event, occurredAt }) => {
    const eventType = getAttendanceBoardEventType(event);
    if (eventType === 'check_in' || eventType === 'study_start' || eventType === 'away_end') {
      activeStartAt = occurredAt;
      return;
    }
    if ((eventType === 'away_start' || eventType === 'check_out' || eventType === 'study_end') && activeStartAt) {
      const diffMinutes = Math.ceil((occurredAt.getTime() - activeStartAt.getTime()) / 60000);
      if (diffMinutes > 0) {
        totalMinutes += diffMinutes;
      }
      activeStartAt = null;
    }
  });

  return Math.max(0, Math.round(totalMinutes));
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
  const validOutings = [...(outings || [])]
    .filter((outing) => outing.startTime && outing.endTime)
    .sort((left, right) => left.startTime.localeCompare(right.startTime));
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

function buildRoutineInfoFromClassSchedule(schedule: StudyRoomClassScheduleTemplate): AttendanceRoutineInfoWithMovement {
  return {
    hasRoutine: true,
    isNoAttendanceDay: false,
    expectedArrivalTime: schedule.arrivalTime || null,
    plannedDepartureTime: schedule.departureTime || null,
    classScheduleName: schedule.className || null,
    ...EMPTY_SCHEDULE_MOVEMENT_INFO,
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
  refreshKey = 0,
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
  const activeMemberIds = useMemo(
    () => activeMembers.map((member) => member.id).filter(Boolean),
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
  const todayEventsQuery = useMemoFirebase(() => {
    if (!firestore || !centerId || !isActive) return null;
    return query(
      collection(firestore, 'centers', centerId, 'attendanceEvents'),
      where('dateKey', '==', todayKey)
    );
  }, [firestore, centerId, isActive, todayKey]);
  const { data: todayEvents, isLoading: todayEventsLoading } = useCollection<AttendanceBoardEvent>(
    todayEventsQuery,
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
  const [todayStudyLogMinutesByStudentId, setTodayStudyLogMinutesByStudentId] = useState<Record<string, TodayStudyLogMinutesEntry>>({});
  const [todayStudyLogLoading, setTodayStudyLogLoading] = useState(false);

  const attendanceStudyStateSignature = useMemo(
    () =>
      resolvedAttendanceList
        .filter((seat) => seat.studentId && targetMemberIds.has(seat.studentId))
        .map((seat) => {
          const updatedAtMs = toDateSafe(seat.updatedAt)?.getTime() || 0;
          return `${seat.studentId}:${seat.status}:${updatedAtMs}`;
        })
        .sort()
        .join('|'),
    [resolvedAttendanceList, targetMemberIds]
  );

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

            const defaultTrackSchedule = buildStudyRoomClassSchedulesForClassName(centerId, member.className)
              .filter((schedule) => schedule.active !== false)
              .find((schedule) => Array.isArray(schedule.weekdays) && schedule.weekdays.includes(weekday));
            if (defaultTrackSchedule) {
              return [member.id, buildRoutineInfoFromClassSchedule(defaultTrackSchedule)] as const;
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
  }, [activeMembers, centerId, firestore, isActive, refreshKey, todayKey, todaySchedules, weekday, weekKey]);

  useEffect(() => {
    if (!firestore || !centerId || !isActive || !todayKey || activeMemberIds.length === 0) {
      setTodayStudyLogMinutesByStudentId({});
      setTodayStudyLogLoading(false);
      return;
    }

    let cancelled = false;
    const loadTodayStudyLogMinutes = async () => {
      setTodayStudyLogLoading(true);
      try {
        const entries = await Promise.all(
          activeMemberIds.map(async (studentId) => {
            try {
              const dayRef = doc(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', todayKey);
              const daySnap = await getDoc(dayRef);
              const dayData = daySnap.exists() ? (daySnap.data() as Record<string, unknown>) : null;
              const dayFirstSessionStartAt = toStudyDayDateSafe(dayData?.firstSessionStartAt, todayKey);
              const rawDayFirstSessionStartAt = toDateSafe(dayData?.firstSessionStartAt);
              const useDayTotals = !rawDayFirstSessionStartAt || Boolean(dayFirstSessionStartAt);
              const dayBaseMinutes = Number(dayData?.totalMinutes ?? dayData?.totalStudyMinutes ?? 0);
              const hasManualCorrection = Boolean(dayData?.correctedAt || dayData?.correctedByUserId);
              const dayAdjustmentMinutes = hasManualCorrection ? Number(dayData?.manualAdjustmentMinutes ?? 0) : 0;
              const dayTotal = useDayTotals ? Math.round(
                (Number.isFinite(dayBaseMinutes) ? dayBaseMinutes : 0) +
                (Number.isFinite(dayAdjustmentMinutes) ? dayAdjustmentMinutes : 0)
              ) : 0;

              const sessionsSnap = await getDocs(collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', todayKey, 'sessions'));
              let firstSessionStartAtMs: number | null = null;
              const sessionTotal = sessionsSnap.docs.reduce((sum, sessionDoc) => {
                const sessionData = sessionDoc.data() as Record<string, unknown>;
                const sessionStartAt = getStudySessionStartDate(sessionData);
                if (sessionStartAt && !isDateInStudyDay(sessionStartAt, todayKey)) {
                  return sum;
                }
                if (sessionStartAt) {
                  const sessionStartMs = sessionStartAt.getTime();
                  if (firstSessionStartAtMs === null || sessionStartMs < firstSessionStartAtMs) {
                    firstSessionStartAtMs = sessionStartMs;
                  }
                }
                return sum + getStudySessionDurationMinutes(sessionData);
              }, 0);
              const hasStudyDaySessions =
                sessionsSnap.docs.some((sessionDoc) => {
                  const sessionStartAt = getStudySessionStartDate(sessionDoc.data() as Record<string, unknown>);
                  return !sessionStartAt || isDateInStudyDay(sessionStartAt, todayKey);
                });
              const adjustedSessionTotal = Math.round(sessionTotal + (Number.isFinite(dayAdjustmentMinutes) ? dayAdjustmentMinutes : 0));
              const effectiveTotal = sessionsSnap.empty ? dayTotal : hasStudyDaySessions ? adjustedSessionTotal : 0;

              return [
                studentId,
                {
                  minutes: Math.max(0, effectiveTotal),
                  hasSessions: hasStudyDaySessions,
                  firstSessionStartAtMs: firstSessionStartAtMs ?? dayFirstSessionStartAt?.getTime() ?? null,
                },
              ] as const;
            } catch (error) {
              logHandledClientIssue('[center-admin-attendance-board] today study log load failed', error);
              return [studentId, { minutes: 0, hasSessions: false, firstSessionStartAtMs: null }] as const;
            }
          })
        );

        if (!cancelled) {
          setTodayStudyLogMinutesByStudentId(Object.fromEntries(entries));
        }
      } catch (error) {
        logHandledClientIssue('[center-admin-attendance-board] today study log batch load failed', error);
        if (!cancelled) setTodayStudyLogMinutesByStudentId({});
      } finally {
        if (!cancelled) setTodayStudyLogLoading(false);
      }
    };

    void loadTodayStudyLogMinutes();
    return () => {
      cancelled = true;
    };
  }, [activeMemberIds, attendanceStudyStateSignature, centerId, firestore, isActive, todayKey]);

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
  const todayEventsByStudentId = useMemo(() => {
    const mapped = new Map<string, AttendanceBoardEvent[]>();
    (todayEvents || []).filter((event) => isAttendanceEventInStudyDay(event, todayKey)).forEach((event) => {
      if (!event.studentId) return;
      const bucket = mapped.get(event.studentId) || [];
      bucket.push(event);
      mapped.set(event.studentId, bucket);
    });
    return mapped;
  }, [todayEvents, todayKey]);
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
        const todayEventsForStudent = todayEventsByStudentId.get(studentId) || [];
        const historySummary = historySummaryByStudentId.get(studentId) || {
          lateCount: 0,
          absentCount: 0,
          routineMissingCount: 0,
        };

        const lastCheckInAt = toDateSafe(seat.lastCheckInAt);
        const liveStudyDayKey = seat.activeStudyDayKey || (lastCheckInAt ? getStudyDayKey(lastCheckInAt) : '');
        const sameDayLiveCheckInAt =
          lastCheckInAt && liveStudyDayKey === todayKey
            ? lastCheckInAt
            : null;
        const rawTodayStatCheckInAt = toDateSafe(todayStat?.checkInAt);
        const rawTodayStatCheckOutAt = toDateSafe(todayStat?.checkOutAt);
        const todayStatCheckInAt = toStudyDayDateSafe(todayStat?.checkInAt, todayKey);
        const todayStatCheckOutAt = toStudyDayDateSafe(todayStat?.checkOutAt, todayKey);
        const todayStatTimesBelongToStudyDay =
          (!rawTodayStatCheckInAt || Boolean(todayStatCheckInAt)) &&
          (!rawTodayStatCheckOutAt || Boolean(todayStatCheckOutAt));
        const rawTodayRecordCheckInAt = toDateSafe(todayRecord?.checkInAt);
        const todayRecordCheckInAt = toStudyDayDateSafe(todayRecord?.checkInAt, todayKey);
        const todayRecordEvidenceBelongsToStudyDay =
          !rawTodayRecordCheckInAt || Boolean(todayRecordCheckInAt);
        const todayRecordStatus =
          todayRecordEvidenceBelongsToStudyDay ? todayRecord?.status : undefined;
        const todayRecordStatusSource =
          todayRecordEvidenceBelongsToStudyDay ? todayRecord?.statusSource : undefined;
        const todayRecordRoutineMissingAtCheckIn =
          todayRecordEvidenceBelongsToStudyDay ? Boolean(todayRecord?.routineMissingAtCheckIn) : false;
        const fallbackStudyLogEntry = todayStudyLogMinutesByStudentId[studentId];
        const fallbackStudyLogFirstSessionStartAt =
          typeof fallbackStudyLogEntry?.firstSessionStartAtMs === 'number' && Number.isFinite(fallbackStudyLogEntry.firstSessionStartAtMs)
            ? new Date(fallbackStudyLogEntry.firstSessionStartAtMs)
            : null;
        const firstCheckInEventAt = pickAttendanceEventTimeByTypes(
          todayEventsForStudent,
          ['check_in', 'study_start'],
          'earliest'
        );
        const firstStudyStartEventAt = pickAttendanceEventTimeByTypes(
          todayEventsForStudent,
          ['check_in', 'study_start', 'away_end'],
          'earliest'
        );
        const latestAwayStartAt = pickAttendanceEventTime(todayEventsForStudent, 'away_start', 'latest');
        const latestAwayEndAt = pickAttendanceEventTimeAfter(
          todayEventsForStudent,
          'away_end',
          latestAwayStartAt,
          'latest'
        );
        const latestCheckOutEventAt = pickAttendanceEventTime(todayEventsForStudent, 'check_out', 'latest');
        const firstCheckInAt = pickDateByMode(
          [
            firstCheckInEventAt,
            firstStudyStartEventAt,
            todayStatCheckInAt,
            todayRecordCheckInAt,
            fallbackStudyLogFirstSessionStartAt,
            sameDayLiveCheckInAt,
          ],
          'earliest'
        );
        const lastCheckOutAt = pickDateByMode(
          [latestCheckOutEventAt, todayStatCheckOutAt],
          'latest'
        );
        const hasCheckOutRecord = Boolean(lastCheckOutAt);
        const liveSessionMinutes = getLiveStudySessionDurationMinutes({
          status: seat.status,
          lastCheckInAt: sameDayLiveCheckInAt,
          nowMs,
        });
        const storedBaseMinutes = todayStatTimesBelongToStudyDay ? Number(todayStat?.totalStudyMinutes || 0) : 0;
        const storedAdjustmentMinutes = todayStatTimesBelongToStudyDay ? Number(todayStat?.manualAdjustmentMinutes || 0) : 0;
        const storedStudyMinutes = Math.round(
          (Number.isFinite(storedBaseMinutes) ? storedBaseMinutes : 0) +
          (Number.isFinite(storedAdjustmentMinutes) ? storedAdjustmentMinutes : 0)
        );
        const fallbackStudyLogMinutes = Math.round(Number(fallbackStudyLogEntry?.minutes || 0));
        const eventClosedStudyMinutes = calculateClosedStudyMinutesFromAttendanceEvents(todayEventsForStudent);
        const recordedStudyMinutes = fallbackStudyLogEntry?.hasSessions
          ? fallbackStudyLogMinutes
          : eventClosedStudyMinutes > 0
            ? eventClosedStudyMinutes
            : Math.max(storedStudyMinutes, fallbackStudyLogMinutes);
        const totalStudyMinutes = Math.max(0, recordedStudyMinutes + liveSessionMinutes);
        const currentAwayStartedAt =
          seat.status === 'away' || seat.status === 'break'
            ? toStudyDayDateSafe(seat.activeAwayStartedAt, todayKey) ||
              (
                latestAwayStartAt &&
                (!latestAwayEndAt || latestAwayStartAt.getTime() > latestAwayEndAt.getTime())
                  ? latestAwayStartAt
                  : null
              )
            : null;
        const currentAwayMinutes =
          (seat.status === 'away' || seat.status === 'break') && currentAwayStartedAt
            ? Math.max(0, Math.floor((nowMs - currentAwayStartedAt.getTime()) / 60000))
            : 0;
        const activeAwayKind = normalizeSeatActiveAwayKind(seat.activeAwayKind);
        const isShortAway = activeAwayKind === 'short';
        const isShortAwayOverdue =
          isShortAway && currentAwayMinutes >= SHORT_AWAY_NOT_RETURNED_THRESHOLD_MINUTES;
        const isLongAway =
          activeAwayKind === 'long' ||
          (!activeAwayKind && currentAwayMinutes >= SHORT_AWAY_NOT_RETURNED_THRESHOLD_MINUTES);
        const isReturned =
          seat.status === 'studying' &&
          recordedStudyMinutes >= 1 &&
          Boolean(sameDayLiveCheckInAt);

        const derived = deriveAttendanceDisplayState({
          selectedDate: today,
          dateKey: todayKey,
          todayDateKey: todayKey,
          routine: routineInfo,
          recordStatus: todayRecordStatus,
          recordStatusSource: todayRecordStatusSource,
          recordRoutineMissingAtCheckIn: todayRecordRoutineMissingAtCheckIn,
          recordCheckedAt: firstCheckInAt,
          liveCheckedAt: sameDayLiveCheckInAt,
          accessCheckedAt: sameDayLiveCheckInAt,
          studyCheckedAt:
            totalStudyMinutes > 0
              ? firstCheckInAt || toDateSafe(todayRecord?.updatedAt)
              : null,
          studyMinutes: Math.max(0, recordedStudyMinutes),
          hasStudyLog: totalStudyMinutes > 0,
          nowMs,
          isRoutineLoading: routineLoading,
          isStudyLogLoading: todayStudyLogLoading,
        });

        const hasAttendanceEvidence =
          hasCheckOutRecord ||
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
          isShortAwayOverdue,
        });

        const flags = buildAttendanceBoardFlags({
          displayStatus: derived.status,
          attendanceRiskLevel,
          isLongAway,
          isShortAwayOverdue,
        });
        const operationalException = resolveAttendanceOperationalException({
          boardStatus,
          expectedArrivalTime: routineInfo?.expectedArrivalTime || null,
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
          firstCheckInLabel: formatAttendanceBoardClockLabel(firstCheckInAt),
          latestAwayStartLabel: formatAttendanceBoardClockLabel(latestAwayStartAt),
          latestAwayEndLabel: formatAttendanceBoardClockLabel(latestAwayEndAt),
          lastCheckOutLabel: formatAttendanceBoardClockLabel(latestCheckOutEventAt || lastCheckOutAt),
          wasLateToday: derived.status === 'confirmed_late',
          hasCheckOutRecord,
          attendanceRiskLevel,
          attendanceRiskLabel,
          recentLateCount: historySummary.lateCount,
          recentAbsentCount: historySummary.absentCount,
          recentRoutineMissingCount: historySummary.routineMissingCount,
          currentAwayMinutes,
          isShortAway,
          isLongAway,
          isShortAwayOverdue,
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
            firstCheckInLabel: formatAttendanceBoardClockLabel(firstCheckInAt),
            lastCheckOutLabel: formatAttendanceBoardClockLabel(lastCheckOutAt),
            wasLateToday: derived.status === 'confirmed_late',
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
    todayEventsByStudentId,
    todayKey,
    todayRecordByStudentId,
    todayScheduleByStudentId,
    todayStudyLogLoading,
    todayStudyLogMinutesByStudentId,
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
      todayEventsLoading ||
      todaySchedulesLoading ||
      historyLoading ||
      routineLoading ||
      todayStudyLogLoading ||
      !students ||
      !studentMembers ||
      !attendanceList ||
      !todayStats,
  };
}
