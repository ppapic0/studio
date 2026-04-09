import { format } from 'date-fns';
import {
  collection,
  deleteField,
  doc,
  Firestore,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
  where,
} from 'firebase/firestore';
import { applyPenaltyEventSecure } from '@/lib/penalty-actions';

export type AttendanceRecordStatus =
  | 'requested'
  | 'confirmed_present'
  | 'confirmed_late'
  | 'confirmed_absent'
  | 'excused_absent';

export type DisplayAttendanceStatus =
  | AttendanceRecordStatus
  | 'missing_routine'
  | 'confirmed_present_missing_routine';

export const ROUTINE_MISSING_PENALTY_POINTS = 1;

export interface AttendanceRoutineInfo {
  hasRoutine: boolean;
  isNoAttendanceDay: boolean;
  expectedArrivalTime: string | null;
}

export interface AttendanceRecordLike {
  status?: AttendanceRecordStatus;
  statusSource?: 'auto' | 'manual' | string;
  updatedAt?: any;
  checkInAt?: any;
  routineMissingAtCheckIn?: boolean;
  routineMissingPenaltyApplied?: boolean;
}

const ATTENDANCE_ROUTINE_KEYWORDS = {
  arrive: '등원 예정',
  leave: '하원 예정',
  off: '등원하지 않습니다',
} as const;

const AUTO_SYNC_STATUSES = new Set<DisplayAttendanceStatus>([
  'requested',
  'missing_routine',
  'confirmed_present',
  'confirmed_present_missing_routine',
  'confirmed_late',
  'confirmed_absent',
  'excused_absent',
]);

export const extractTimeFromRoutineTitle = (title: string): string | null => {
  const match = title.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};

export const combineDateWithTime = (date: Date, hhmm: string): Date | null => {
  const [hourText, minuteText] = hhmm.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const parsed = new Date(date);
  parsed.setHours(hour, minute, 0, 0);
  return parsed;
};

export const toDateSafe = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  return null;
};

export const buildAttendanceRoutineInfo = (scheduleTitles: string[]): AttendanceRoutineInfo => {
  const hasRoutine = scheduleTitles.some(
    (title) =>
      title.includes(ATTENDANCE_ROUTINE_KEYWORDS.arrive) ||
      title.includes(ATTENDANCE_ROUTINE_KEYWORDS.leave) ||
      title.includes(ATTENDANCE_ROUTINE_KEYWORDS.off)
  );
  const isNoAttendanceDay = scheduleTitles.some((title) => title.includes(ATTENDANCE_ROUTINE_KEYWORDS.off));
  const arrivalTitle = scheduleTitles.find((title) => title.includes(ATTENDANCE_ROUTINE_KEYWORDS.arrive));
  const expectedArrivalTime = arrivalTitle ? extractTimeFromRoutineTitle(arrivalTitle) : null;

  return {
    hasRoutine,
    isNoAttendanceDay,
    expectedArrivalTime,
  };
};

export function deriveAttendanceDisplayState(params: {
  selectedDate: Date;
  dateKey: string;
  todayDateKey: string;
  routine?: AttendanceRoutineInfo;
  recordStatus?: AttendanceRecordStatus;
  recordStatusSource?: AttendanceRecordLike['statusSource'];
  recordRoutineMissingAtCheckIn?: boolean;
  recordCheckedAt?: Date | null;
  liveCheckedAt?: Date | null;
  accessCheckedAt?: Date | null;
  studyCheckedAt?: Date | null;
  studyMinutes?: number;
  hasStudyLog?: boolean;
  nowMs?: number;
  isRoutineLoading?: boolean;
  isStudyLogLoading?: boolean;
}): { status: DisplayAttendanceStatus; checkedAt: Date | null } {
  const {
    selectedDate,
    dateKey,
    todayDateKey,
    routine,
    recordStatus,
    recordStatusSource,
    recordRoutineMissingAtCheckIn = false,
    recordCheckedAt,
    liveCheckedAt,
    accessCheckedAt,
    studyCheckedAt,
    studyMinutes = 0,
    hasStudyLog = studyMinutes > 0,
    nowMs = Date.now(),
    isRoutineLoading = false,
    isStudyLogLoading = false,
  } = params;

  const isTodaySelected = dateKey === todayDateKey;
  const hasStudyEvidence = hasStudyLog || studyMinutes > 0;
  const studyEvidenceCheckedAt = studyCheckedAt || null;
  const fallbackCheckedAt = studyEvidenceCheckedAt || recordCheckedAt || liveCheckedAt || accessCheckedAt || null;
  let checkedAt: Date | null = fallbackCheckedAt;

  const isManualStatus = recordStatusSource === 'manual' && !!recordStatus && recordStatus !== 'requested';
  if (isManualStatus) {
    const status =
      recordStatus === 'confirmed_present' && recordRoutineMissingAtCheckIn && checkedAt
        ? 'confirmed_present_missing_routine'
        : (recordStatus as DisplayAttendanceStatus);
    return { status, checkedAt };
  }

  if (isStudyLogLoading) {
    return { status: recordStatus || 'requested', checkedAt };
  }

  if (!isRoutineLoading && routine && !routine.hasRoutine) {
    return {
      status: hasStudyEvidence ? 'confirmed_present_missing_routine' : 'missing_routine',
      checkedAt: hasStudyEvidence ? (studyEvidenceCheckedAt || fallbackCheckedAt) : (accessCheckedAt || liveCheckedAt || recordCheckedAt || null),
    };
  }

  if (routine?.isNoAttendanceDay) {
    return {
      status: 'excused_absent',
      checkedAt: accessCheckedAt || liveCheckedAt || recordCheckedAt || null,
    };
  }

  if (routine?.expectedArrivalTime) {
    const expectedArrivalAt = combineDateWithTime(selectedDate, routine.expectedArrivalTime);
    if (hasStudyEvidence) {
      const attendanceEvidenceAt = studyEvidenceCheckedAt || liveCheckedAt || recordCheckedAt || accessCheckedAt || null;
      const status =
        attendanceEvidenceAt && expectedArrivalAt && attendanceEvidenceAt.getTime() > expectedArrivalAt.getTime()
          ? 'confirmed_late'
          : 'confirmed_present';
      return { status, checkedAt: attendanceEvidenceAt };
    }

    let status: DisplayAttendanceStatus = 'requested';
    if (expectedArrivalAt) {
      const isPastDate = dateKey < todayDateKey;
      const hasTimedOutToday = isTodaySelected && nowMs > expectedArrivalAt.getTime();
      if (isPastDate || hasTimedOutToday) {
        status = 'confirmed_absent';
      }
    }

    return {
      status,
      checkedAt: accessCheckedAt || liveCheckedAt || recordCheckedAt || null,
    };
  }

  if (hasStudyEvidence) {
    return {
      status: 'confirmed_present',
      checkedAt: studyEvidenceCheckedAt || liveCheckedAt || recordCheckedAt || accessCheckedAt || null,
    };
  }

  return {
    status: 'requested',
    checkedAt: accessCheckedAt || liveCheckedAt || recordCheckedAt || null,
  };
}

async function fetchStudyLogInfo(
  firestore: Firestore,
  centerId: string,
  studentId: string,
  dateKey: string
): Promise<{ hasStudyLog: boolean; studyMinutes: number; checkedAt: Date | null }> {
  const dayRef = doc(firestore, 'centers', centerId, 'studyLogs', studentId, 'days', dateKey);
  const daySnap = await getDoc(dayRef);
  if (!daySnap.exists()) {
    return { hasStudyLog: false, studyMinutes: 0, checkedAt: null };
  }

  const data = daySnap.data() as any;
  const rawMinutes = Number(data?.totalMinutes || 0);
  const studyMinutes = Number.isFinite(rawMinutes) ? Math.max(0, Math.round(rawMinutes)) : 0;
  const checkedAt = toDateSafe(data?.updatedAt || data?.createdAt);
  return {
    hasStudyLog: studyMinutes > 0,
    studyMinutes,
    checkedAt,
  };
}

async function fetchAttendanceRoutineInfo(
  firestore: Firestore,
  centerId: string,
  studentId: string,
  dateKey: string,
  weekKey: string
): Promise<AttendanceRoutineInfo> {
  const routineQuery = query(
    collection(firestore, 'centers', centerId, 'plans', studentId, 'weeks', weekKey, 'items'),
    where('dateKey', '==', dateKey),
    where('category', '==', 'schedule'),
    limit(12)
  );
  const snap = await getDocs(routineQuery);
  const scheduleTitles = snap.docs.map((docSnap) => String((docSnap.data() as { title?: unknown })?.title || ''));
  return buildAttendanceRoutineInfo(scheduleTitles);
}

export async function syncAutoAttendanceRecord(params: {
  firestore: Firestore;
  centerId: string;
  studentId: string;
  studentName?: string;
  targetDate?: Date;
  checkInAt?: Date | null;
  confirmedByUserId?: string;
  overwriteManual?: boolean;
}): Promise<{ status: DisplayAttendanceStatus; wrote: boolean; reason?: string }> {
  const {
    firestore,
    centerId,
    studentId,
    studentName,
    targetDate = new Date(),
    checkInAt = null,
    confirmedByUserId,
    overwriteManual = false,
  } = params;

  const dateKey = format(targetDate, 'yyyy-MM-dd');
  const todayDateKey = format(new Date(), 'yyyy-MM-dd');
  const weekKey = format(targetDate, "yyyy-'W'II");

  const recordRef = doc(firestore, 'centers', centerId, 'attendanceRecords', dateKey, 'students', studentId);
  const existingSnap = await getDoc(recordRef);
  const existing = (existingSnap.exists() ? (existingSnap.data() as AttendanceRecordLike) : null);
  if (!overwriteManual && existing?.statusSource === 'manual') {
    return { status: existing.status || 'requested', wrote: false, reason: 'manual_override' };
  }

  const routine = await fetchAttendanceRoutineInfo(firestore, centerId, studentId, dateKey, weekKey);
  const studyLogInfo = await fetchStudyLogInfo(firestore, centerId, studentId, dateKey);
  const existingCheckedAt = toDateSafe(existing?.checkInAt || existing?.updatedAt);
  const accessCheckedAt = checkInAt || existingCheckedAt;
  const derived = deriveAttendanceDisplayState({
    selectedDate: targetDate,
    dateKey,
    todayDateKey,
    routine,
    recordStatus: existing?.status,
    recordStatusSource: existing?.statusSource,
    recordRoutineMissingAtCheckIn: Boolean(existing?.routineMissingAtCheckIn),
    recordCheckedAt: existingCheckedAt,
    liveCheckedAt: checkInAt || null,
    accessCheckedAt,
    studyCheckedAt: studyLogInfo.checkedAt,
    studyMinutes: studyLogInfo.studyMinutes,
    hasStudyLog: studyLogInfo.hasStudyLog,
  });

  if (!AUTO_SYNC_STATUSES.has(derived.status)) {
    return { status: derived.status, wrote: false, reason: 'not_sync_target' };
  }

  const isRoutineMissingDay =
    derived.status === 'missing_routine' || derived.status === 'confirmed_present_missing_routine';
  const persistedStatus: AttendanceRecordStatus =
    derived.status === 'confirmed_present_missing_routine'
      ? 'confirmed_present'
      : derived.status === 'missing_routine'
        ? 'requested'
        : (derived.status as AttendanceRecordStatus);

  const normalizedExistingCheckInAt = toDateSafe(existing?.checkInAt || existing?.updatedAt);
  const shouldSyncStatus =
    existing?.status !== persistedStatus ||
    Boolean(existing?.routineMissingAtCheckIn) !== isRoutineMissingDay;
  const shouldSyncCheckIn =
    (persistedStatus === 'confirmed_present' || persistedStatus === 'confirmed_late') &&
    !!derived.checkedAt &&
    (!normalizedExistingCheckInAt || Math.abs(normalizedExistingCheckInAt.getTime() - derived.checkedAt.getTime()) > 60000);
  const shouldApplyMissingRoutinePenalty =
    isRoutineMissingDay && !existing?.routineMissingPenaltyApplied;

  if (!shouldSyncStatus && !shouldSyncCheckIn && !shouldApplyMissingRoutinePenalty) {
    return { status: derived.status, wrote: false, reason: 'already_synced' };
  }

  const batch = writeBatch(firestore);
  const payload: Record<string, any> = {
    status: persistedStatus,
    statusSource: 'auto',
    autoSyncedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    centerId,
    studentId,
    dateKey,
  };
  if (studentName) payload.studentName = studentName;
  if (confirmedByUserId) payload.confirmedByUserId = confirmedByUserId;

  if ((persistedStatus === 'confirmed_present' || persistedStatus === 'confirmed_late') && derived.checkedAt) {
    payload.checkInAt = Timestamp.fromDate(derived.checkedAt);
  } else {
    payload.checkInAt = deleteField();
  }

  if (isRoutineMissingDay) {
    payload.routineMissingAtCheckIn = true;
  } else {
    payload.routineMissingAtCheckIn = deleteField();
  }

  batch.set(recordRef, payload, { merge: true });

  await batch.commit();

  if (shouldApplyMissingRoutinePenalty) {
    const penaltyResult = await applyPenaltyEventSecure({
      centerId,
      studentId,
      source: 'routine_missing',
      reason: `루틴 미작성 (${dateKey})`,
      pointsDelta: ROUTINE_MISSING_PENALTY_POINTS,
      penaltyDateKey: dateKey,
      penaltyKey: `routine_missing:${dateKey}`,
    });

    if (penaltyResult.applied || penaltyResult.duplicate) {
      await updateDoc(recordRef, {
        routineMissingPenaltyApplied: true,
        updatedAt: serverTimestamp(),
      });
    }
  }

  return { status: derived.status, wrote: true };
}
