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
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';

export type AttendanceRecordStatus =
  | 'requested'
  | 'confirmed_present'
  | 'confirmed_late'
  | 'confirmed_absent'
  | 'excused_absent';

export type DisplayAttendanceStatus = AttendanceRecordStatus | 'missing_routine';

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
}

const ATTENDANCE_ROUTINE_KEYWORDS = {
  arrive: '등원 예정',
  leave: '하원 예정',
  off: '등원하지 않습니다',
} as const;

const AUTO_SYNC_STATUSES = new Set<AttendanceRecordStatus>([
  'confirmed_present',
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
  recordCheckedAt?: Date | null;
  liveCheckedAt?: Date | null;
  nowMs?: number;
  isRoutineLoading?: boolean;
}): { status: DisplayAttendanceStatus; checkedAt: Date | null } {
  const {
    selectedDate,
    dateKey,
    todayDateKey,
    routine,
    recordStatus,
    recordCheckedAt,
    liveCheckedAt,
    nowMs = Date.now(),
    isRoutineLoading = false,
  } = params;

  const isTodaySelected = dateKey === todayDateKey;
  const checkedAt = recordCheckedAt || liveCheckedAt || null;
  let status: DisplayAttendanceStatus = recordStatus || 'requested';

  if (!recordStatus || recordStatus === 'requested') {
    if (!isRoutineLoading && routine && !routine.hasRoutine) {
      status = 'missing_routine';
    } else if (routine?.isNoAttendanceDay) {
      status = 'excused_absent';
    } else if (routine?.expectedArrivalTime) {
      const expectedArrivalAt = combineDateWithTime(selectedDate, routine.expectedArrivalTime);
      const checkInAt = liveCheckedAt || recordCheckedAt;

      if (checkInAt) {
        status =
          expectedArrivalAt && checkInAt.getTime() > expectedArrivalAt.getTime()
            ? 'confirmed_late'
            : 'confirmed_present';
      } else if (expectedArrivalAt) {
        const isPastDate = dateKey < todayDateKey;
        const hasTimedOutToday = isTodaySelected && nowMs > expectedArrivalAt.getTime();
        if (isPastDate || hasTimedOutToday) {
          status = 'confirmed_absent';
        }
      }
    }
  }

  return { status, checkedAt };
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
  const scheduleTitles = snap.docs.map((docSnap) => String(docSnap.data()?.title || ''));
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
  const derived = deriveAttendanceDisplayState({
    selectedDate: targetDate,
    dateKey,
    todayDateKey,
    routine,
    recordStatus: existing?.status,
    recordCheckedAt: checkInAt || toDateSafe(existing?.checkInAt || existing?.updatedAt),
    liveCheckedAt: checkInAt,
  });

  if (!AUTO_SYNC_STATUSES.has(derived.status as AttendanceRecordStatus)) {
    return { status: derived.status, wrote: false, reason: 'not_sync_target' };
  }

  const normalizedExistingCheckInAt = toDateSafe(existing?.checkInAt || existing?.updatedAt);
  const shouldSyncStatus = existing?.status !== derived.status;
  const shouldSyncCheckIn =
    (derived.status === 'confirmed_present' || derived.status === 'confirmed_late') &&
    !!derived.checkedAt &&
    (!normalizedExistingCheckInAt || Math.abs(normalizedExistingCheckInAt.getTime() - derived.checkedAt.getTime()) > 60000);

  if (!shouldSyncStatus && !shouldSyncCheckIn) {
    return { status: derived.status, wrote: false, reason: 'already_synced' };
  }

  const payload: Record<string, any> = {
    status: derived.status,
    statusSource: 'auto',
    autoSyncedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    centerId,
    studentId,
    dateKey,
  };
  if (studentName) payload.studentName = studentName;
  if (confirmedByUserId) payload.confirmedByUserId = confirmedByUserId;

  if ((derived.status === 'confirmed_present' || derived.status === 'confirmed_late') && derived.checkedAt) {
    payload.checkInAt = Timestamp.fromDate(derived.checkedAt);
  } else {
    payload.checkInAt = deleteField();
  }

  await setDoc(recordRef, payload, { merge: true });
  return { status: derived.status, wrote: true };
}
