import { useEffect, useMemo, useState } from 'react';
import { addDays, differenceInMinutes, eachDayOfInterval, endOfDay, format, startOfDay, subDays } from 'date-fns';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import {
  AttendanceRoutineInfo,
  buildAttendanceRoutineInfoFromScheduleDoc,
  buildAttendanceRoutineInfoFromScheduleTemplate,
  buildAttendanceRoutineInfo,
  buildAutonomousAttendanceRoutineInfo,
  combineDateWithTime,
  deriveAttendanceDisplayState,
  toDateSafe,
  type AttendanceRecordStatus,
} from '@/lib/attendance-auto';
import {
  ATTENDANCE_KPI_PERIOD_OPTIONS,
  buildAttendanceRecommendations,
  buildAttendanceTopIssue,
  calculateAttendanceStabilityScore,
  deriveRequestOperationsSummary,
  formatMinutesAsLabel,
  getAttendanceRiskMeta,
  toPercent,
  type AttendanceCenterSummary,
  type AttendanceKpiDay,
  type AttendanceKpiPeriod,
  type AttendanceRequestOperationsSummary,
  type AttendanceStudentKpiRow,
} from '@/lib/attendance-kpi';
import { getRoomLabel } from '@/lib/seat-layout';
import { getStudyDayKey } from '@/lib/study-day';
import { getLiveStudySessionDurationMinutes, getStudySessionDurationMinutes } from '@/lib/study-session-time';
import { buildStudyRoomClassSchedulesForClassName } from '@/lib/study-room-class-schedule';
import { isAutonomousAttendanceDateKey } from '@/lib/korean-public-holidays';
import {
  AttendanceCurrent,
  AttendanceRequest,
  CenterMembership,
  StudentScheduleDoc,
  StudentScheduleTemplate,
  StudyRoomClassScheduleTemplate,
} from '@/lib/types';

type AttendanceRecordDoc = {
  id: string;
  centerId?: string;
  studentId?: string;
  dateKey?: string;
  status?: AttendanceRecordStatus;
  statusSource?: 'auto' | 'manual' | string;
  checkInAt?: unknown;
  routineMissingAtCheckIn?: boolean;
};

type DailyStudentStatDoc = {
  id: string;
  centerId?: string;
  studentId?: string;
  dateKey?: string;
  totalStudyMinutes?: number;
  awayMinutes?: number;
  breakMinutes?: number;
  updatedAt?: unknown;
  createdAt?: unknown;
};

type StudyLogDayDoc = {
  id: string;
  centerId?: string;
  studentId?: string;
  dateKey?: string;
  totalMinutes?: number;
  updatedAt?: unknown;
  createdAt?: unknown;
};

type AttendanceDailyStatDoc = {
  id: string;
  centerId?: string;
  studentId?: string;
  dateKey?: string;
  attendanceStatus?: string;
  source?: string;
  checkInAt?: unknown;
  checkOutAt?: unknown;
  lateMinutes?: number;
  awayMinutes?: number;
  awayCount?: number;
  hasCheckOutRecord?: boolean;
  requestType?: AttendanceRequest['type'];
  requestStatus?: AttendanceRequest['status'];
  expectedArrivalTime?: string | null;
};

type AttendanceEventDoc = {
  id: string;
  studentId?: string;
  dateKey?: string;
  eventType?: string;
  occurredAt?: unknown;
  createdAt?: unknown;
};

type ParentNotificationDoc = {
  id: string;
  studentId?: string;
  type?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type ScheduleItemDoc = {
  id: string;
  studentId?: string;
  dateKey?: string;
  title?: string;
};

type DirectScheduleDoc = StudentScheduleDoc & {
  id: string;
};

type ScheduleTemplateDoc = StudentScheduleTemplate & {
  id: string;
  studentId: string;
};

type StudySessionDoc = {
  id: string;
  studentId: string;
  dateKey: string;
  startTime: Date | null;
  endTime: Date | null;
  durationMinutes?: number;
};

export type AttendanceKpiSourceKey =
  | 'scheduleItems'
  | 'directSchedules'
  | 'scheduleTemplates'
  | 'attendanceRecords'
  | 'dailyStudentStats'
  | 'attendanceDailyStats'
  | 'studyLogDays'
  | 'studySessions'
  | 'parentNotifications'
  | 'attendanceEvents';

export type AttendanceKpiSourceDiagnostic = {
  key: AttendanceKpiSourceKey;
  label: string;
  count: number;
  usedFallback: boolean;
  errorMessage: string | null;
};

type LoadResult<T> = {
  data: T[];
  diagnostic: AttendanceKpiSourceDiagnostic;
};

interface UseAttendanceKpiOptions {
  firestore: Firestore | null;
  centerId: string | null | undefined;
  students: CenterMembership[] | undefined;
  requests: AttendanceRequest[] | undefined;
  attendanceCurrentDocs: AttendanceCurrent[] | undefined;
  enabled?: boolean;
  periodDays: AttendanceKpiPeriod;
  anchorDate?: Date | null;
}

interface UseAttendanceKpiResult {
  isLoading: boolean;
  error: string | null;
  rows: AttendanceStudentKpiRow[];
  summary: AttendanceCenterSummary;
  requestOperations: AttendanceRequestOperationsSummary;
  availableRooms: Array<{ value: string; label: string }>;
  periodOptions: typeof ATTENDANCE_KPI_PERIOD_OPTIONS;
  sourceDiagnostics: AttendanceKpiSourceDiagnostic[];
  rangeEndKey: string;
}

const REQUEST_DEFAULT_SUMMARY = {
  pendingTodayCount: 0,
  overduePendingCount: 0,
  averageProcessingHours: 0,
  repeatRequesterCount: 0,
};

const EMPTY_CENTER_SUMMARY: AttendanceCenterSummary = {
  attendanceRate: 0,
  lateRate: 0,
  unexcusedAbsenceRate: 0,
  averageAwayMinutes: 0,
  checkoutCompletionRate: 100,
  requestSlaComplianceRate: 100,
  pendingRequestsToday: 0,
  overduePendingCount: 0,
  averageProcessingHours: 0,
  repeatRequesterCount: 0,
  stableCount: 0,
  watchCount: 0,
  riskCount: 0,
  criticalCount: 0,
};

const SOURCE_LABELS: Record<AttendanceKpiSourceKey, string> = {
  scheduleItems: '기존 일정',
  directSchedules: '직접 등록 일정',
  scheduleTemplates: '학생 템플릿',
  attendanceRecords: '출결 기록',
  dailyStudentStats: '일별 학습 통계',
  attendanceDailyStats: '출결 KPI 통계',
  studyLogDays: '학습일 기록',
  studySessions: '학습 세션',
  parentNotifications: '보호자 알림',
  attendanceEvents: '출결 이벤트',
};

const EMPTY_SOURCE_DIAGNOSTICS = (Object.keys(SOURCE_LABELS) as AttendanceKpiSourceKey[]).map((key) =>
  makeSourceDiagnostic(key, 0)
);

function makeCompositeKey(studentId: string, dateKey: string) {
  return `${studentId}::${dateKey}`;
}

function getErrorMessage(error: unknown) {
  if (!error) return null;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || '');
  return String(error);
}

function makeSourceDiagnostic(
  key: AttendanceKpiSourceKey,
  count: number,
  options?: {
    usedFallback?: boolean;
    error?: unknown;
  }
): AttendanceKpiSourceDiagnostic {
  return {
    key,
    label: SOURCE_LABELS[key],
    count,
    usedFallback: Boolean(options?.usedFallback),
    errorMessage: getErrorMessage(options?.error),
  };
}

function asNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function compareDateKeys(startKey: string, endKey: string, currentKey?: string | null) {
  if (!currentKey) return false;
  return currentKey >= startKey && currentKey <= endKey;
}

function getScheduleTimestampMs(value?: unknown) {
  const date = toDateSafe(value);
  if (date) return date.getTime();
  return 0;
}

function getScheduleTemplateTimestampMs(template: ScheduleTemplateDoc) {
  return Math.max(getScheduleTimestampMs(template.updatedAt), getScheduleTimestampMs(template.createdAt));
}

function buildAttendanceRoutineInfoFromClassSchedule(
  schedule: Pick<StudyRoomClassScheduleTemplate, 'arrivalTime' | 'departureTime' | 'className'>
): AttendanceRoutineInfo {
  return {
    hasRoutine: true,
    isNoAttendanceDay: false,
    expectedArrivalTime: schedule.arrivalTime || null,
    plannedDepartureTime: schedule.departureTime || null,
    classScheduleName: schedule.className || null,
  };
}

function mapSnapshotData<T extends { id: string }>(docs: QueryDocumentSnapshot[]) {
  return docs.map((snapshot) => ({ id: snapshot.id, ...(snapshot.data() as Omit<T, 'id'>) })) as T[];
}

function getPathPart(parts: string[], index: number) {
  return typeof parts[index] === 'string' ? parts[index] : '';
}

function getDateRange(periodDays: AttendanceKpiPeriod, anchorDate?: Date | null) {
  const today = startOfDay(new Date());
  const requestedAnchor = anchorDate ? startOfDay(anchorDate) : today;
  const rangeEnd = requestedAnchor.getTime() > today.getTime() ? today : requestedAnchor;
  const start = startOfDay(subDays(rangeEnd, periodDays - 1));
  const end = endOfDay(rangeEnd);
  const dates = eachDayOfInterval({ start, end: rangeEnd });
  const dateKeys = dates.map((date) => format(date, 'yyyy-MM-dd'));
  return {
    today,
    rangeEnd,
    start,
    end,
    dates,
    dateKeys,
    startKey: dateKeys[0]!,
    endKey: dateKeys[dateKeys.length - 1]!,
  };
}

function groupByStudentAndDate<T extends { studentId?: string; dateKey?: string }>(items: T[]) {
  const mapped = new Map<string, T>();
  items.forEach((item) => {
    if (!item.studentId || !item.dateKey) return;
    mapped.set(makeCompositeKey(item.studentId, item.dateKey), item);
  });
  return mapped;
}

function groupListByStudentAndDate<T extends { studentId?: string; dateKey?: string }>(items: T[]) {
  const mapped = new Map<string, T[]>();
  items.forEach((item) => {
    if (!item.studentId || !item.dateKey) return;
    const key = makeCompositeKey(item.studentId, item.dateKey);
    const bucket = mapped.get(key) || [];
    bucket.push(item);
    mapped.set(key, bucket);
  });
  return mapped;
}

function pickDateByMode(values: Array<Date | null | undefined>, mode: 'earliest' | 'latest') {
  const dates = values.filter((value): value is Date => value instanceof Date && Number.isFinite(value.getTime()));
  if (dates.length === 0) return null;
  return dates
    .slice()
    .sort((a, b) => mode === 'earliest' ? a.getTime() - b.getTime() : b.getTime() - a.getTime())[0] || null;
}

function pickAttendanceEventTime(
  events: AttendanceEventDoc[],
  eventType: string,
  mode: 'earliest' | 'latest'
) {
  return pickDateByMode(
    events
      .filter((event) => event.eventType === eventType)
      .map((event) => toDateSafe(event.occurredAt) || toDateSafe(event.createdAt)),
    mode
  );
}

function getAttendanceEventDate(event: AttendanceEventDoc) {
  return toDateSafe(event.occurredAt) || toDateSafe(event.createdAt);
}

function calculateClosedStudyMinutesFromAttendanceEvents(events: AttendanceEventDoc[]) {
  const sortedEvents = events
    .map((event) => ({ event, occurredAt: getAttendanceEventDate(event) }))
    .filter((item): item is { event: AttendanceEventDoc; occurredAt: Date } => Boolean(item.occurredAt))
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  let activeStartAt: Date | null = null;
  let totalMinutes = 0;

  sortedEvents.forEach(({ event, occurredAt }) => {
    if (event.eventType === 'check_in' || event.eventType === 'away_end') {
      activeStartAt = occurredAt;
      return;
    }
    if ((event.eventType === 'away_start' || event.eventType === 'check_out') && activeStartAt) {
      const diffMinutes = Math.ceil((occurredAt.getTime() - activeStartAt.getTime()) / 60000);
      if (diffMinutes > 0) {
        totalMinutes += diffMinutes;
      }
      activeStartAt = null;
    }
  });

  return Math.max(0, Math.round(totalMinutes));
}

function groupNotificationsByStudentAndDate(notifications: ParentNotificationDoc[]) {
  const mapped = new Map<string, ParentNotificationDoc[]>();
  notifications.forEach((item) => {
    if (!item.studentId) return;
    const createdAt = toDateSafe(item.createdAt || item.updatedAt);
    if (!createdAt) return;
    const dateKey = format(createdAt, 'yyyy-MM-dd');
    const key = makeCompositeKey(item.studentId, dateKey);
    const bucket = mapped.get(key) || [];
    bucket.push(item);
    mapped.set(key, bucket);
  });
  return mapped;
}

function buildSessionGroups(sessions: StudySessionDoc[]) {
  const mapped = new Map<string, StudySessionDoc[]>();
  sessions.forEach((session) => {
    const key = makeCompositeKey(session.studentId, session.dateKey);
    const bucket = mapped.get(key) || [];
    bucket.push(session);
    mapped.set(key, bucket);
  });
  mapped.forEach((bucket) => {
    bucket.sort((a, b) => (a.startTime?.getTime() || 0) - (b.startTime?.getTime() || 0));
  });
  return mapped;
}

function calculateSessionGapMetrics(sessions: StudySessionDoc[]) {
  if (!sessions.length) {
    return {
      awayMinutes: 0,
      awayCount: 0,
      hasEndedSession: false,
      lastEndTime: null as Date | null,
    };
  }

  let awayMinutes = 0;
  let awayCount = 0;
  for (let index = 1; index < sessions.length; index += 1) {
    const previous = sessions[index - 1];
    const current = sessions[index];
    if (!previous.endTime || !current.startTime) continue;
    const gapMinutes = differenceInMinutes(current.startTime, previous.endTime);
    if (gapMinutes > 0 && gapMinutes < 180) {
      awayMinutes += gapMinutes;
      awayCount += 1;
    }
  }

  const lastSession = sessions[sessions.length - 1];
  return {
    awayMinutes: Math.max(0, Math.round(awayMinutes)),
    awayCount,
    hasEndedSession: Boolean(lastSession?.endTime),
    lastEndTime: lastSession?.endTime || null,
  };
}

async function loadScheduleItemsRange(
  firestore: Firestore,
  centerId: string,
  startKey: string,
  endKey: string,
  studentIds: string[],
  dates: Date[]
): Promise<LoadResult<ScheduleItemDoc>> {
  try {
    const groupedQuery = query(
      collectionGroup(firestore, 'items'),
      where('centerId', '==', centerId),
      where('category', '==', 'schedule'),
      where('dateKey', '>=', startKey),
      where('dateKey', '<=', endKey),
      orderBy('dateKey', 'asc')
    );
    const snap = await getDocs(groupedQuery);
    const data = snap.docs.map((snapshot) => {
      const raw = snapshot.data() as Omit<ScheduleItemDoc, 'id'>;
      const parts = snapshot.ref.path.split('/');
      const studentIdFromPath =
        getPathPart(parts, 0) === 'centers' && getPathPart(parts, 2) === 'plans'
          ? getPathPart(parts, 3)
          : '';
      return {
        id: snapshot.id,
        ...raw,
        studentId: raw.studentId || studentIdFromPath,
      } as ScheduleItemDoc;
    });
    return {
      data,
      diagnostic: makeSourceDiagnostic('scheduleItems', data.length),
    };
  } catch (error) {
    const weekKeys = Array.from(new Set(dates.map((date) => format(date, "yyyy-'W'II"))));
    const fallback = await Promise.all(
      studentIds.flatMap((studentId) =>
        weekKeys.map(async (weekKey) => {
          const weekQuery = query(
            collection(firestore, 'centers', centerId, 'plans', studentId, 'weeks', weekKey, 'items'),
            where('category', '==', 'schedule')
          );
          const snap = await getDocs(weekQuery);
          return mapSnapshotData<ScheduleItemDoc>(snap.docs)
            .map((item) => ({ ...item, studentId: item.studentId || studentId }))
            .filter((item) => compareDateKeys(startKey, endKey, item.dateKey));
        })
      )
    );
    const data = fallback.flat();
    return {
      data,
      diagnostic: makeSourceDiagnostic('scheduleItems', data.length, { usedFallback: true, error }),
    };
  }
}

async function loadDirectSchedulesRange(
  firestore: Firestore,
  centerId: string,
  startKey: string,
  endKey: string,
  studentIds: string[],
  dateKeys: string[]
): Promise<LoadResult<DirectScheduleDoc>> {
  try {
    const groupedQuery = query(
      collectionGroup(firestore, 'schedules'),
      where('centerId', '==', centerId),
      where('dateKey', '>=', startKey),
      where('dateKey', '<=', endKey),
      orderBy('dateKey', 'asc')
    );
    const snap = await getDocs(groupedQuery);
    const data = snap.docs
      .map((snapshot) => {
        const parts = snapshot.ref.path.split('/');
        const uidFromPath = parts[0] === 'users' ? parts[1] : '';
        return {
          id: snapshot.id,
          ...(snapshot.data() as Omit<DirectScheduleDoc, 'id'>),
          uid: String((snapshot.data() as { uid?: unknown }).uid || uidFromPath || ''),
        } as DirectScheduleDoc;
      })
      .filter((item) => Boolean(item.uid && item.dateKey));
    return {
      data,
      diagnostic: makeSourceDiagnostic('directSchedules', data.length),
    };
  } catch (error) {
    const snapshots = await Promise.all(
      studentIds.flatMap((studentId) =>
        dateKeys.map(async (dateKey) => getDoc(doc(firestore, 'users', studentId, 'schedules', dateKey)))
      )
    );
    const data = snapshots
      .filter((snapshot) => snapshot.exists())
      .map((snapshot) => {
        const parts = snapshot.ref.path.split('/');
        const uidFromPath = parts[1] || '';
        return {
          id: snapshot.id,
          ...(snapshot.data() as Omit<DirectScheduleDoc, 'id'>),
          uid: String((snapshot.data() as { uid?: unknown }).uid || uidFromPath || ''),
          dateKey: String((snapshot.data() as { dateKey?: unknown }).dateKey || snapshot.id),
        } as DirectScheduleDoc;
      })
      .filter((item) => !item.centerId || item.centerId === centerId);
    return {
      data,
      diagnostic: makeSourceDiagnostic('directSchedules', data.length, { usedFallback: true, error }),
    };
  }
}

async function loadScheduleTemplatesRange(
  firestore: Firestore,
  centerId: string,
  studentIds: string[]
): Promise<LoadResult<ScheduleTemplateDoc>> {
  const settled = await Promise.all(
    studentIds.map(async (studentId) => {
      try {
        const templateQuery = query(
          collection(firestore, 'users', studentId, 'scheduleTemplates'),
          where('centerId', '==', centerId)
        );
        const snap = await getDocs(templateQuery);
        return {
          data: mapSnapshotData<StudentScheduleTemplate & { id: string }>(snap.docs).map((item) => ({
            ...item,
            studentId,
          })),
          error: null,
        };
      } catch (error) {
        return {
          data: [] as ScheduleTemplateDoc[],
          error,
        };
      }
    })
  );
  const data = settled.flatMap((item) => item.data);
  const errors = settled.map((item) => item.error).filter(Boolean);
  return {
    data,
    diagnostic: makeSourceDiagnostic('scheduleTemplates', data.length, { error: errors[0] || null }),
  };
}

async function loadAttendanceRecordsRange(
  firestore: Firestore,
  centerId: string,
  dateKeys: string[]
): Promise<LoadResult<AttendanceRecordDoc>> {
  const results = await Promise.all(
    dateKeys.map(async (dateKey) => {
      try {
        const snap = await getDocs(collection(firestore, 'centers', centerId, 'attendanceRecords', dateKey, 'students'));
        return {
          data: mapSnapshotData<AttendanceRecordDoc>(snap.docs).map((item) => ({
            ...item,
            studentId: item.studentId || item.id,
            dateKey: item.dateKey || dateKey,
          })),
          error: null,
        };
      } catch (error) {
        return {
          data: [] as AttendanceRecordDoc[],
          error,
        };
      }
    })
  );
  const data = results.flatMap((result) => result.data);
  const errors = results.map((result) => result.error).filter(Boolean);
  return {
    data,
    diagnostic: makeSourceDiagnostic('attendanceRecords', data.length, { error: errors[0] || null }),
  };
}

async function loadDailyStudentStatsRange(
  firestore: Firestore,
  centerId: string,
  dateKeys: string[]
): Promise<LoadResult<DailyStudentStatDoc>> {
  const results = await Promise.all(
    dateKeys.map(async (dateKey) => {
      try {
        const snap = await getDocs(collection(firestore, 'centers', centerId, 'dailyStudentStats', dateKey, 'students'));
        return {
          data: mapSnapshotData<DailyStudentStatDoc>(snap.docs).map((item) => ({
            ...item,
            studentId: item.studentId || item.id,
            dateKey: item.dateKey || dateKey,
          })),
          error: null,
        };
      } catch (error) {
        return {
          data: [] as DailyStudentStatDoc[],
          error,
        };
      }
    })
  );
  const data = results.flatMap((result) => result.data);
  const errors = results.map((result) => result.error).filter(Boolean);
  return {
    data,
    diagnostic: makeSourceDiagnostic('dailyStudentStats', data.length, { error: errors[0] || null }),
  };
}

async function loadAttendanceDailyStatsRange(
  firestore: Firestore,
  centerId: string,
  dateKeys: string[]
): Promise<LoadResult<AttendanceDailyStatDoc>> {
  const results = await Promise.all(
    dateKeys.map(async (dateKey) => {
      try {
        const snap = await getDocs(collection(firestore, 'centers', centerId, 'attendanceDailyStats', dateKey, 'students'));
        return {
          data: mapSnapshotData<AttendanceDailyStatDoc>(snap.docs).map((item) => ({
            ...item,
            studentId: item.studentId || item.id,
            dateKey: item.dateKey || dateKey,
          })),
          error: null,
        };
      } catch (error) {
        return {
          data: [] as AttendanceDailyStatDoc[],
          error,
        };
      }
    })
  );
  const data = results.flatMap((result) => result.data);
  const errors = results.map((result) => result.error).filter(Boolean);
  return {
    data,
    diagnostic: makeSourceDiagnostic('attendanceDailyStats', data.length, { error: errors[0] || null }),
  };
}

async function loadStudyLogDaysRange(
  firestore: Firestore,
  centerId: string,
  startKey: string,
  endKey: string,
  studentIds: string[],
  dateKeys: string[]
): Promise<LoadResult<StudyLogDayDoc>> {
  try {
    const groupedQuery = query(
      collectionGroup(firestore, 'days'),
      where('centerId', '==', centerId),
      where('dateKey', '>=', startKey),
      where('dateKey', '<=', endKey),
      orderBy('dateKey', 'asc')
    );
    const snap = await getDocs(groupedQuery);
    const data = snap.docs
      .map((snapshot) => {
        const parts = snapshot.ref.path.split('/');
        if (parts.length < 6 || parts[1] !== centerId || parts[2] !== 'studyLogs') return null;
        const raw = snapshot.data() as Omit<StudyLogDayDoc, 'id'>;
        return {
          id: snapshot.id,
          ...raw,
          studentId: raw.studentId || getPathPart(parts, 3),
          dateKey: raw.dateKey || getPathPart(parts, 5),
        } as StudyLogDayDoc;
      })
      .filter((item): item is StudyLogDayDoc => Boolean(item));
    return {
      data,
      diagnostic: makeSourceDiagnostic('studyLogDays', data.length),
    };
  } catch (error) {
    const snapshots = await Promise.all(
      studentIds.flatMap((studentId) =>
        dateKeys.map(async (dateKey) =>
          getDoc(doc(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', dateKey))
        )
      )
    );
    const data = snapshots
      .filter((snapshot) => snapshot.exists())
      .map((snapshot) => {
        const parts = snapshot.ref.path.split('/');
        const studentId = parts[3] || '';
        return {
          id: snapshot.id,
          ...(snapshot.data() as Omit<StudyLogDayDoc, 'id'>),
          studentId: String((snapshot.data() as { studentId?: unknown }).studentId || studentId),
          dateKey: String((snapshot.data() as { dateKey?: unknown }).dateKey || snapshot.id),
        } as StudyLogDayDoc;
      })
      .filter((item) => compareDateKeys(startKey, endKey, item.dateKey));
    return {
      data,
      diagnostic: makeSourceDiagnostic('studyLogDays', data.length, { usedFallback: true, error }),
    };
  }
}

async function loadStudySessionsRange(
  firestore: Firestore,
  centerId: string,
  start: Date,
  end: Date,
  studentIds: string[],
  dateKeys: string[],
  fallbackDays?: StudyLogDayDoc[]
): Promise<LoadResult<StudySessionDoc>> {
  try {
    const groupedQuery = query(
      collectionGroup(firestore, 'sessions'),
      where('startTime', '>=', Timestamp.fromDate(start)),
      where('startTime', '<=', Timestamp.fromDate(addDays(startOfDay(end), 1))),
      orderBy('startTime', 'asc')
    );
    const snap = await getDocs(groupedQuery);
    const data = snap.docs
      .map((snapshot) => {
        const parts = snapshot.ref.path.split('/');
        if (parts.length < 8 || parts[1] !== centerId || parts[2] !== 'studyLogs') return null;
        const data = snapshot.data() as Record<string, unknown>;
        return {
          id: snapshot.id,
          studentId: parts[3] || '',
          dateKey: parts[5] || '',
          startTime: toDateSafe(data.startTime),
          endTime: toDateSafe(data.endTime),
          durationMinutes: asNumber(data.durationMinutes),
        } as StudySessionDoc;
      })
      .filter((item): item is StudySessionDoc => Boolean(item?.studentId && item?.dateKey));
    return {
      data,
      diagnostic: makeSourceDiagnostic('studySessions', data.length),
    };
  } catch (error) {
    const fallbackTargets = fallbackDays?.length
      ? fallbackDays
          .filter((day) => day.studentId && day.dateKey)
          .map((day) => ({ studentId: day.studentId as string, dateKey: day.dateKey as string }))
      : studentIds.flatMap((studentId) => dateKeys.map((dateKey) => ({ studentId, dateKey })));
    const seenTargets = new Set<string>();
    const uniqueFallbackTargets = fallbackTargets.filter((target) => {
      const key = makeCompositeKey(target.studentId, target.dateKey);
      if (seenTargets.has(key)) return false;
      seenTargets.add(key);
      return true;
    });
    const snapshots = await Promise.all(
      uniqueFallbackTargets.map(async ({ studentId, dateKey }) => {
        const snap = await getDocs(
          collection(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', dateKey, 'sessions')
        );
        return snap.docs.map((snapshot) => {
          const data = snapshot.data() as Record<string, unknown>;
          return {
            id: snapshot.id,
            studentId,
            dateKey,
            startTime: toDateSafe(data.startTime),
            endTime: toDateSafe(data.endTime),
            durationMinutes: asNumber(data.durationMinutes),
          } as StudySessionDoc;
        });
      })
    );
    const data = snapshots.flat();
    return {
      data,
      diagnostic: makeSourceDiagnostic('studySessions', data.length, { usedFallback: true, error }),
    };
  }
}

async function loadParentNotificationsRange(
  firestore: Firestore,
  centerId: string,
  start: Date
): Promise<LoadResult<ParentNotificationDoc>> {
  try {
    const notificationsQuery = query(
      collection(firestore, 'centers', centerId, 'parentNotifications'),
      where('createdAt', '>=', Timestamp.fromDate(start)),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(notificationsQuery);
    const data = mapSnapshotData<ParentNotificationDoc>(snap.docs).filter((item) =>
      item.type === 'check_out' || item.type === 'away_long' || item.type === 'unauthorized_exit'
    );
    return {
      data,
      diagnostic: makeSourceDiagnostic('parentNotifications', data.length),
    };
  } catch (error) {
    return {
      data: [],
      diagnostic: makeSourceDiagnostic('parentNotifications', 0, { error }),
    };
  }
}

async function loadAttendanceEventsRange(
  firestore: Firestore,
  centerId: string,
  startKey: string,
  endKey: string
): Promise<LoadResult<AttendanceEventDoc>> {
  try {
    const eventsQuery = query(
      collection(firestore, 'centers', centerId, 'attendanceEvents'),
      where('dateKey', '>=', startKey),
      where('dateKey', '<=', endKey),
      orderBy('dateKey', 'asc')
    );
    const snap = await getDocs(eventsQuery);
    const data = mapSnapshotData<AttendanceEventDoc>(snap.docs);
    return {
      data,
      diagnostic: makeSourceDiagnostic('attendanceEvents', data.length),
    };
  } catch (error) {
    return {
      data: [],
      diagnostic: makeSourceDiagnostic('attendanceEvents', 0, { error }),
    };
  }
}

function resolveRequestDateKey(request: AttendanceRequest) {
  if (typeof request.date === 'string' && request.date.length >= 10) return request.date;
  const createdAt = request.createdAt?.toDate?.();
  return createdAt ? format(createdAt, 'yyyy-MM-dd') : null;
}

export function useAttendanceKpi({
  firestore,
  centerId,
  students,
  requests,
  attendanceCurrentDocs,
  enabled = true,
  periodDays,
  anchorDate = null,
}: UseAttendanceKpiOptions): UseAttendanceKpiResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItemDoc[]>([]);
  const [directSchedules, setDirectSchedules] = useState<DirectScheduleDoc[]>([]);
  const [scheduleTemplates, setScheduleTemplates] = useState<ScheduleTemplateDoc[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecordDoc[]>([]);
  const [dailyStudentStats, setDailyStudentStats] = useState<DailyStudentStatDoc[]>([]);
  const [attendanceDailyStats, setAttendanceDailyStats] = useState<AttendanceDailyStatDoc[]>([]);
  const [studyLogDays, setStudyLogDays] = useState<StudyLogDayDoc[]>([]);
  const [studySessions, setStudySessions] = useState<StudySessionDoc[]>([]);
  const [parentNotifications, setParentNotifications] = useState<ParentNotificationDoc[]>([]);
  const [attendanceEvents, setAttendanceEvents] = useState<AttendanceEventDoc[]>([]);
  const [sourceDiagnostics, setSourceDiagnostics] = useState<AttendanceKpiSourceDiagnostic[]>(EMPTY_SOURCE_DIAGNOSTICS);

  const dateRange = useMemo(() => getDateRange(periodDays, anchorDate), [anchorDate, periodDays]);

  useEffect(() => {
    if (!firestore || !centerId || !students?.length || !enabled) {
      setScheduleItems([]);
      setDirectSchedules([]);
      setScheduleTemplates([]);
      setAttendanceRecords([]);
      setDailyStudentStats([]);
      setAttendanceDailyStats([]);
      setStudyLogDays([]);
      setStudySessions([]);
      setParentNotifications([]);
      setAttendanceEvents([]);
      setSourceDiagnostics(EMPTY_SOURCE_DIAGNOSTICS);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const studentIds = students.map((student) => student.id);

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [
          scheduleItemsResult,
          directSchedulesResult,
          scheduleTemplatesResult,
          nextAttendanceRecords,
          nextDailyStudentStats,
          nextAttendanceDailyStats,
          studyLogDaysResult,
          parentNotificationsResult,
          attendanceEventsResult,
        ] = await Promise.all([
          loadScheduleItemsRange(firestore, centerId, dateRange.startKey, dateRange.endKey, studentIds, dateRange.dates),
          loadDirectSchedulesRange(firestore, centerId, dateRange.startKey, dateRange.endKey, studentIds, dateRange.dateKeys),
          loadScheduleTemplatesRange(firestore, centerId, studentIds),
          loadAttendanceRecordsRange(firestore, centerId, dateRange.dateKeys),
          loadDailyStudentStatsRange(firestore, centerId, dateRange.dateKeys),
          loadAttendanceDailyStatsRange(firestore, centerId, dateRange.dateKeys),
          loadStudyLogDaysRange(firestore, centerId, dateRange.startKey, dateRange.endKey, studentIds, dateRange.dateKeys),
          loadParentNotificationsRange(firestore, centerId, dateRange.start),
          loadAttendanceEventsRange(firestore, centerId, dateRange.startKey, dateRange.endKey),
        ]);
        const studySessionsResult = await loadStudySessionsRange(
          firestore,
          centerId,
          dateRange.start,
          dateRange.end,
          studentIds,
          dateRange.dateKeys,
          studyLogDaysResult.data
        );

        if (cancelled) return;

        setScheduleItems(scheduleItemsResult.data);
        setDirectSchedules(directSchedulesResult.data);
        setScheduleTemplates(scheduleTemplatesResult.data);
        setAttendanceRecords(nextAttendanceRecords.data);
        setDailyStudentStats(nextDailyStudentStats.data);
        setAttendanceDailyStats(nextAttendanceDailyStats.data);
        setStudyLogDays(studyLogDaysResult.data);
        setStudySessions(studySessionsResult.data);
        setParentNotifications(parentNotificationsResult.data);
        setAttendanceEvents(attendanceEventsResult.data);
        setSourceDiagnostics([
          scheduleItemsResult.diagnostic,
          directSchedulesResult.diagnostic,
          scheduleTemplatesResult.diagnostic,
          nextAttendanceRecords.diagnostic,
          nextDailyStudentStats.diagnostic,
          nextAttendanceDailyStats.diagnostic,
          studyLogDaysResult.diagnostic,
          studySessionsResult.diagnostic,
          parentNotificationsResult.diagnostic,
          attendanceEventsResult.diagnostic,
        ]);
      } catch (loadError) {
        console.error('[attendance-kpi] load failed', loadError);
        if (!cancelled) {
          setError('출결 KPI 데이터를 불러오지 못했습니다.');
          setSourceDiagnostics(EMPTY_SOURCE_DIAGNOSTICS);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [firestore, centerId, students, enabled, dateRange]);

  const availableRooms = useMemo(() => {
    const seen = new Set<string>();
    return (attendanceCurrentDocs || [])
      .map((seat) => seat.roomId || null)
      .filter((roomId): roomId is string => Boolean(roomId))
      .filter((roomId) => {
        if (seen.has(roomId)) return false;
        seen.add(roomId);
        return true;
      })
      .map((roomId) => ({
        value: roomId,
        label: getRoomLabel(roomId),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ko-KR'));
  }, [attendanceCurrentDocs]);

  const requestOperations = useMemo(() => {
    if (!requests?.length) return REQUEST_DEFAULT_SUMMARY;
    const requestsInRange = requests.filter((request) => {
      const requestDateKey = resolveRequestDateKey(request);
      return compareDateKeys(dateRange.startKey, dateRange.endKey, requestDateKey);
    });
    return deriveRequestOperationsSummary(requestsInRange, new Date());
  }, [requests, dateRange.endKey, dateRange.startKey]);

  const rows = useMemo(() => {
    if (!students?.length) return [] as AttendanceStudentKpiRow[];

    const todayKey = format(dateRange.today, 'yyyy-MM-dd');
    const scheduleTitleMap = new Map<string, string[]>();
    scheduleItems.forEach((item) => {
      if (!item.studentId || !item.dateKey || !item.title) return;
      const key = makeCompositeKey(item.studentId, item.dateKey);
      const current = scheduleTitleMap.get(key) || [];
      current.push(item.title);
      scheduleTitleMap.set(key, current);
    });
    const directScheduleMap = new Map<string, DirectScheduleDoc>();
    directSchedules.forEach((item) => {
      if (!item.uid || !item.dateKey) return;
      directScheduleMap.set(makeCompositeKey(item.uid, item.dateKey), item);
    });
    const templatesByStudent = new Map<string, ScheduleTemplateDoc[]>();
    scheduleTemplates.forEach((template) => {
      const bucket = templatesByStudent.get(template.studentId) || [];
      bucket.push(template);
      templatesByStudent.set(template.studentId, bucket);
    });
    templatesByStudent.forEach((bucket) => {
      bucket.sort((left, right) => getScheduleTemplateTimestampMs(right) - getScheduleTemplateTimestampMs(left));
    });

    const attendanceMap = groupByStudentAndDate(attendanceRecords);
    const dailyStatsMap = groupByStudentAndDate(dailyStudentStats);
    const attendanceDailyStatsMap = groupByStudentAndDate(attendanceDailyStats);
    const studyLogDayMap = groupByStudentAndDate(studyLogDays);
    const eventMap = groupListByStudentAndDate(attendanceEvents);
    const notificationMap = groupNotificationsByStudentAndDate(parentNotifications);
    const sessionMap = buildSessionGroups(studySessions);
    const liveAttendanceMap = new Map<string, AttendanceCurrent>();
    (attendanceCurrentDocs || []).forEach((seat) => {
      if (seat.studentId) {
        liveAttendanceMap.set(seat.studentId, seat);
      }
    });

    const requestsByStudent = (requests || []).reduce<Record<string, AttendanceRequest[]>>((acc, request) => {
      if (!acc[request.studentId]) acc[request.studentId] = [];
      acc[request.studentId]!.push(request);
      return acc;
    }, {});

    Object.values(requestsByStudent).forEach((bucket) => {
      bucket.sort((a, b) => {
        const aMs = a.createdAt?.toDate?.()?.getTime() || 0;
        const bMs = b.createdAt?.toDate?.()?.getTime() || 0;
        return bMs - aMs;
      });
    });

    return students.map((student) => {
      const liveSeat = liveAttendanceMap.get(student.id);
      const roomId = liveSeat?.roomId || null;
      const roomLabel = roomId ? getRoomLabel(roomId) : '미지정';
      const requestHistory = (requestsByStudent[student.id] || []).filter((request) =>
        compareDateKeys(dateRange.startKey, dateRange.endKey, resolveRequestDateKey(request))
      );

      const timeline: AttendanceKpiDay[] = dateRange.dates.map((date) => {
        const dateKey = format(date, 'yyyy-MM-dd');
        const key = makeCompositeKey(student.id, dateKey);
        const directSchedule = directScheduleMap.get(key);
        const matchingTemplate = (templatesByStudent.get(student.id) || [])
          .filter((template) => template.active !== false)
          .filter((template) => !template.centerId || template.centerId === centerId)
          .find((template) => Array.isArray(template.weekdays) && template.weekdays.includes(date.getDay()));
        const defaultClassSchedule = buildStudyRoomClassSchedulesForClassName(centerId, student.className)
          .filter((schedule) => schedule.active !== false)
          .find((schedule) => Array.isArray(schedule.weekdays) && schedule.weekdays.includes(date.getDay()));
        const routineInfo: AttendanceRoutineInfo = directSchedule
            ? buildAttendanceRoutineInfoFromScheduleDoc(directSchedule)
            : isAutonomousAttendanceDateKey(dateKey)
              ? buildAutonomousAttendanceRoutineInfo()
              : matchingTemplate
                ? buildAttendanceRoutineInfoFromScheduleTemplate(matchingTemplate)
                : defaultClassSchedule
                  ? buildAttendanceRoutineInfoFromClassSchedule(defaultClassSchedule)
                  : buildAttendanceRoutineInfo(scheduleTitleMap.get(key) || []);
        const attendanceRecord = attendanceMap.get(key);
        const dayStat = dailyStatsMap.get(key);
        const dayKpi = attendanceDailyStatsMap.get(key);
        const studyLogDay = studyLogDayMap.get(key);
        const sessions = sessionMap.get(key) || [];
        const sessionGapMetrics = calculateSessionGapMetrics(sessions);
        const dayEvents = eventMap.get(key) || [];
        const dayNotifications = notificationMap.get(key) || [];
        const dayRequests = requestHistory.filter((request) => resolveRequestDateKey(request) === dateKey);
        const latestRequest = dayRequests[0] || null;

        const rawLiveCheckedAt = dateKey === todayKey ? toDateSafe(liveSeat?.lastCheckInAt) : null;
        const liveStudyDayKey = liveSeat?.activeStudyDayKey || (rawLiveCheckedAt ? getStudyDayKey(rawLiveCheckedAt) : '');
        const liveCheckedAt = rawLiveCheckedAt && liveStudyDayKey === dateKey ? rawLiveCheckedAt : null;
        const sessionStudyMinutes = sessions.reduce((sum, session) => sum + getStudySessionDurationMinutes(session), 0);
        const eventClosedStudyMinutes = calculateClosedStudyMinutesFromAttendanceEvents(dayEvents);
        const firstCheckInAt = pickDateByMode(
          [
            pickAttendanceEventTime(dayEvents, 'check_in', 'earliest'),
            toDateSafe(dayKpi?.checkInAt),
            toDateSafe(attendanceRecord?.checkInAt),
            liveCheckedAt,
          ],
          'earliest'
        );
        const studyMinutesBase = sessions.length > 0
          ? sessionStudyMinutes
          : eventClosedStudyMinutes > 0
            ? eventClosedStudyMinutes
            : Math.max(
                asNumber(studyLogDay?.totalMinutes),
                asNumber(dayStat?.totalStudyMinutes)
              );
        const activeSessionMinutes = dateKey === todayKey
          ? getLiveStudySessionDurationMinutes({
              status: liveSeat?.status,
              lastCheckInAt: liveCheckedAt,
              nowMs: Date.now(),
              rounding: 'floor',
            })
          : 0;
        const studyMinutes = Math.max(0, Math.round(studyMinutesBase + activeSessionMinutes));
        const studyLogCheckedAt = toDateSafe(
          studyLogDay?.updatedAt || studyLogDay?.createdAt || dayStat?.updatedAt || dayStat?.createdAt
        );
        const studyCheckedAt = firstCheckInAt || studyLogCheckedAt;
        const hasAttendanceEvidence = studyMinutes > 0 || Boolean(firstCheckInAt);

        const derived = deriveAttendanceDisplayState({
          selectedDate: date,
          dateKey,
          todayDateKey: todayKey,
          routine: routineInfo,
          recordStatus: attendanceRecord?.status,
          recordStatusSource: attendanceRecord?.statusSource,
          recordRoutineMissingAtCheckIn: Boolean(attendanceRecord?.routineMissingAtCheckIn),
          recordCheckedAt: firstCheckInAt,
          liveCheckedAt,
          accessCheckedAt: firstCheckInAt || liveCheckedAt,
          studyCheckedAt,
          studyMinutes,
          hasStudyLog: hasAttendanceEvidence,
          nowMs: Date.now(),
          isRoutineLoading: false,
          isStudyLogLoading: false,
        });

        const expectedArrivalAt =
          routineInfo.expectedArrivalTime ? combineDateWithTime(date, routineInfo.expectedArrivalTime) : null;
        const lateMinutes =
          typeof dayKpi?.lateMinutes === 'number'
            ? Math.max(0, Math.round(dayKpi.lateMinutes))
            : expectedArrivalAt && derived.checkedAt
              ? Math.max(0, differenceInMinutes(derived.checkedAt, expectedArrivalAt))
              : derived.status === 'confirmed_late'
                ? 10
                : 0;

        const latestCheckOutEvent = [...dayEvents]
          .filter((event) => event.eventType === 'check_out')
          .sort(
            (a, b) =>
              (toDateSafe(b.occurredAt || b.createdAt)?.getTime() || 0) -
              (toDateSafe(a.occurredAt || a.createdAt)?.getTime() || 0)
          )[0];
        const latestCheckOutNotification = [...dayNotifications]
          .filter((notification) => notification.type === 'check_out')
          .sort(
            (a, b) =>
              (toDateSafe(b.createdAt || b.updatedAt)?.getTime() || 0) -
              (toDateSafe(a.createdAt || a.updatedAt)?.getTime() || 0)
          )[0];

        const checkOutAt =
          toDateSafe(dayKpi?.checkOutAt) ||
          toDateSafe(latestCheckOutEvent?.occurredAt || latestCheckOutEvent?.createdAt) ||
          toDateSafe(latestCheckOutNotification?.createdAt || latestCheckOutNotification?.updatedAt) ||
          sessionGapMetrics.lastEndTime ||
          null;

        const hasCheckoutRecord = Boolean(
          dayKpi?.hasCheckOutRecord ||
            latestCheckOutEvent ||
            latestCheckOutNotification ||
            (sessionGapMetrics.hasEndedSession && (dateKey < todayKey || liveSeat?.status !== 'studying'))
        );

        const awayMinutes =
          typeof dayKpi?.awayMinutes === 'number'
            ? Math.max(0, Math.round(dayKpi.awayMinutes))
            : typeof dayStat?.awayMinutes === 'number'
              ? Math.max(0, Math.round(asNumber(dayStat.awayMinutes)))
              : typeof dayStat?.breakMinutes === 'number'
                ? Math.max(0, Math.round(asNumber(dayStat.breakMinutes)))
                : sessionGapMetrics.awayMinutes;

        const awayCount =
          typeof dayKpi?.awayCount === 'number'
            ? Math.max(0, Math.round(dayKpi.awayCount))
            : sessionGapMetrics.awayCount;

        const isScheduledDay = routineInfo.hasRoutine && !routineInfo.isNoAttendanceDay;
        const isRoutineMissing = !routineInfo.hasRoutine;
        const isOffDay = routineInfo.isNoAttendanceDay;

        return {
          dateKey,
          dateLabel: format(date, 'M/d'),
          status: derived.status,
          checkedAt: derived.checkedAt,
          expectedArrivalTime: dayKpi?.expectedArrivalTime || routineInfo.expectedArrivalTime,
          expectedArrivalAt,
          lateMinutes,
          isScheduledDay,
          isOffDay,
          isRoutineMissing,
          studyMinutes,
          awayMinutes,
          awayCount,
          hasCheckoutRecord,
          checkOutAt,
          requestType: latestRequest?.type || dayKpi?.requestType || null,
          requestStatus: latestRequest?.status || dayKpi?.requestStatus || null,
        };
      });

      const scheduledDays = timeline.filter((day) => day.isScheduledDay).length;
      const presentDays = timeline.filter(
        (day) =>
          day.isScheduledDay &&
          (day.status === 'confirmed_present' ||
            day.status === 'confirmed_present_missing_routine' ||
            day.status === 'confirmed_late')
      ).length;
      const lateCount = timeline.filter((day) => day.isScheduledDay && day.status === 'confirmed_late').length;
      const absenceCount = timeline.filter((day) => day.isScheduledDay && day.status === 'confirmed_absent').length;
      const excusedAbsenceCount = timeline.filter(
        (day) => !day.isOffDay && day.status === 'excused_absent'
      ).length;
      const routineMissingCount = timeline.filter((day) => day.isRoutineMissing).length;
      const arrivalOffsets = timeline
        .filter((day) => day.isScheduledDay && day.expectedArrivalAt && day.checkedAt)
        .map((day) => differenceInMinutes(day.checkedAt as Date, day.expectedArrivalAt as Date));
      const averageArrivalOffsetMinutes = arrivalOffsets.length
        ? Math.round(arrivalOffsets.reduce((sum, value) => sum + value, 0) / arrivalOffsets.length)
        : 0;
      const totalAwayMinutes = timeline.reduce((sum, day) => sum + day.awayMinutes, 0);
      const awayDayCount = timeline.filter((day) => day.awayMinutes > 0).length;
      const awayCount = timeline.reduce((sum, day) => sum + day.awayCount, 0);
      const averageAwayMinutes = scheduledDays > 0 ? Math.round(totalAwayMinutes / scheduledDays) : 0;
      const checkoutEligibleDays = timeline.filter(
        (day) =>
          day.isScheduledDay &&
          (day.studyMinutes > 0 ||
            day.status === 'confirmed_present' ||
            day.status === 'confirmed_present_missing_routine' ||
            day.status === 'confirmed_late')
      ).length;
      const checkoutRecordedDays = timeline.filter(
        (day) =>
          day.isScheduledDay &&
          (day.studyMinutes > 0 ||
            day.status === 'confirmed_present' ||
            day.status === 'confirmed_present_missing_routine' ||
            day.status === 'confirmed_late') &&
          day.hasCheckoutRecord
      ).length;

      const attendanceRate = toPercent(presentDays, scheduledDays);
      const lateRate = toPercent(lateCount, scheduledDays);
      const absenceRate = toPercent(absenceCount, scheduledDays);
      const excusedAbsenceRate = toPercent(excusedAbsenceCount, scheduledDays);
      const checkoutCompletionRate =
        checkoutEligibleDays > 0 ? toPercent(checkoutRecordedDays, checkoutEligibleDays) : 100;
      const stabilityScore = calculateAttendanceStabilityScore({
        attendanceRate,
        lateRate,
        absenceRate,
        averageAwayMinutes,
        checkoutCompletionRate,
      });
      const riskMeta = getAttendanceRiskMeta(stabilityScore);
      const recentRequestStatus = requestHistory[0]?.status || 'none';
      const latestCheckOutAt = timeline
        .map((day) => day.checkOutAt)
        .filter((value): value is Date => Boolean(value))
        .sort((a, b) => b.getTime() - a.getTime())[0];

      return {
        studentId: student.id,
        studentName: student.displayName || '이름 없음',
        className: student.className || '미분류',
        roomId,
        roomLabel,
        attendanceRate,
        lateRate,
        absenceRate,
        excusedAbsenceRate,
        averageArrivalOffsetMinutes,
        averageAwayMinutes,
        awayDayCount,
        awayCount,
        checkoutCompletionRate,
        stabilityScore,
        riskLevel: riskMeta.level,
        lateCount,
        absenceCount,
        excusedAbsenceCount,
        routineMissingCount,
        scheduledDays,
        presentDays,
        latestCheckOutLabel: latestCheckOutAt ? format(latestCheckOutAt, 'M/d HH:mm') : '기록 없음',
        recentRequestStatus,
        recentRequestCount: requestHistory.length,
        topIssue: buildAttendanceTopIssue({
          absenceCount,
          lateCount,
          averageAwayMinutes,
          checkoutCompletionRate,
          routineMissingCount,
          recentRequestStatus,
        }),
        suggestions: buildAttendanceRecommendations({
          absenceCount,
          lateCount,
          averageArrivalOffsetMinutes,
          averageAwayMinutes,
          checkoutCompletionRate,
          recentRequestStatus,
          routineMissingCount,
        }),
        timeline,
        requestHistory,
      };
    }).sort((a, b) => {
      if (a.stabilityScore !== b.stabilityScore) return a.stabilityScore - b.stabilityScore;
      if (a.absenceCount !== b.absenceCount) return b.absenceCount - a.absenceCount;
      if (a.lateCount !== b.lateCount) return b.lateCount - a.lateCount;
      return a.studentName.localeCompare(b.studentName, 'ko-KR');
    });
  }, [
    attendanceCurrentDocs,
    attendanceDailyStats,
    attendanceEvents,
    attendanceRecords,
    centerId,
    dailyStudentStats,
    dateRange,
    directSchedules,
    parentNotifications,
    requests,
    scheduleItems,
    scheduleTemplates,
    studyLogDays,
    studySessions,
    students,
  ]);

  const summary = useMemo(() => {
    if (!rows.length) {
      return {
        ...EMPTY_CENTER_SUMMARY,
        pendingRequestsToday: requestOperations.pendingTodayCount,
        overduePendingCount: requestOperations.overduePendingCount,
        averageProcessingHours: requestOperations.averageProcessingHours,
        repeatRequesterCount: requestOperations.repeatRequesterCount,
      };
    }

    const totals = rows.reduce(
      (acc, row) => {
        acc.scheduledDays += row.scheduledDays;
        acc.presentDays += row.presentDays;
        acc.lateCount += row.lateCount;
        acc.absenceCount += row.absenceCount;
        acc.totalAwayMinutes += row.averageAwayMinutes * row.scheduledDays;
        acc.checkoutEligibleDays += row.timeline.filter(
          (day) =>
            day.isScheduledDay &&
            (day.studyMinutes > 0 ||
              day.status === 'confirmed_present' ||
              day.status === 'confirmed_present_missing_routine' ||
              day.status === 'confirmed_late')
        ).length;
        acc.checkoutRecordedDays += row.timeline.filter(
          (day) =>
            day.isScheduledDay &&
            (day.studyMinutes > 0 ||
              day.status === 'confirmed_present' ||
              day.status === 'confirmed_present_missing_routine' ||
              day.status === 'confirmed_late') &&
            day.hasCheckoutRecord
        ).length;
        return acc;
      },
      {
        scheduledDays: 0,
        presentDays: 0,
        lateCount: 0,
        absenceCount: 0,
        totalAwayMinutes: 0,
        checkoutEligibleDays: 0,
        checkoutRecordedDays: 0,
      }
    );

    const requestsInRange = (requests || []).filter((request) =>
      compareDateKeys(dateRange.startKey, dateRange.endKey, resolveRequestDateKey(request))
    );
    const compliantRequests = requestsInRange.filter((request) => {
      const createdAtMs = request.createdAt?.toDate?.()?.getTime() || 0;
      const dueAtMs =
        request.slaDueAt?.toDate?.()?.getTime() ||
        (createdAtMs ? createdAtMs + 24 * 60 * 60 * 1000 : 0);
      if (request.status === 'requested') {
        return dueAtMs === 0 ? true : dueAtMs >= Date.now();
      }
      const resolvedAtMs =
        request.statusUpdatedAt?.toDate?.()?.getTime() ||
        request.updatedAt?.toDate?.()?.getTime() ||
        0;
      return dueAtMs === 0 || resolvedAtMs === 0 ? true : resolvedAtMs <= dueAtMs;
    });

    return {
      attendanceRate: toPercent(totals.presentDays, totals.scheduledDays),
      lateRate: toPercent(totals.lateCount, totals.scheduledDays),
      unexcusedAbsenceRate: toPercent(totals.absenceCount, totals.scheduledDays),
      averageAwayMinutes: totals.scheduledDays > 0 ? Math.round(totals.totalAwayMinutes / totals.scheduledDays) : 0,
      checkoutCompletionRate:
        totals.checkoutEligibleDays > 0 ? toPercent(totals.checkoutRecordedDays, totals.checkoutEligibleDays) : 100,
      requestSlaComplianceRate:
        requestsInRange.length > 0 ? toPercent(compliantRequests.length, requestsInRange.length) : 100,
      pendingRequestsToday: requestOperations.pendingTodayCount,
      overduePendingCount: requestOperations.overduePendingCount,
      averageProcessingHours: requestOperations.averageProcessingHours,
      repeatRequesterCount: requestOperations.repeatRequesterCount,
      stableCount: rows.filter((row) => row.riskLevel === 'stable').length,
      watchCount: rows.filter((row) => row.riskLevel === 'watch').length,
      riskCount: rows.filter((row) => row.riskLevel === 'risk').length,
      criticalCount: rows.filter((row) => row.riskLevel === 'critical').length,
    };
  }, [dateRange.endKey, dateRange.startKey, requestOperations, requests, rows]);

  return {
    isLoading,
    error,
    rows,
    summary,
    requestOperations,
    availableRooms,
    periodOptions: ATTENDANCE_KPI_PERIOD_OPTIONS,
    sourceDiagnostics,
    rangeEndKey: dateRange.endKey,
  };
}

export function buildAttendanceStudentSubtitle(row: AttendanceStudentKpiRow) {
  return `${row.className} · ${row.roomLabel} · 평균 외출 ${formatMinutesAsLabel(row.averageAwayMinutes)}`;
}
