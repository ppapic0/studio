import {
  Firestore,
  Timestamp,
  WriteBatch,
  collection,
  doc,
  serverTimestamp,
} from 'firebase/firestore';

export type AttendanceEventType =
  | 'check_in'
  | 'check_out'
  | 'away_start'
  | 'away_end'
  | 'status_override'
  | 'request_approved'
  | 'request_rejected';

type TimestampLike = Date | Timestamp | null | undefined;

export interface AttendanceEventPayload {
  studentId: string;
  dateKey: string;
  eventType: AttendanceEventType;
  occurredAt?: TimestampLike;
  source: string;
  seatId?: string | null;
  requestId?: string | null;
  statusBefore?: string | null;
  statusAfter?: string | null;
  meta?: Record<string, unknown>;
}

export interface AttendanceDailyStatPatch {
  attendanceStatus?: string;
  checkInAt?: TimestampLike;
  checkOutAt?: TimestampLike;
  lateMinutes?: number | null;
  awayMinutes?: number | null;
  awayCount?: number | null;
  hasCheckOutRecord?: boolean;
  requestType?: string | null;
  requestStatus?: string | null;
  expectedArrivalTime?: string | null;
  source?: string;
}

function toFirestoreTimestamp(value: TimestampLike) {
  if (!value) return undefined;
  if (value instanceof Timestamp) return value;
  if (value instanceof Date) return Timestamp.fromDate(value);
  return undefined;
}

export function appendAttendanceEventToBatch(
  batch: WriteBatch,
  firestore: Firestore,
  centerId: string,
  payload: AttendanceEventPayload
) {
  const eventRef = doc(collection(firestore, 'centers', centerId, 'attendanceEvents'));
  const occurredAt = toFirestoreTimestamp(payload.occurredAt);

  const eventData: Record<string, unknown> = {
    studentId: payload.studentId,
    dateKey: payload.dateKey,
    eventType: payload.eventType,
    source: payload.source,
    occurredAt: occurredAt ?? serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  if (payload.seatId) eventData.seatId = payload.seatId;
  if (payload.requestId) eventData.requestId = payload.requestId;
  if (payload.statusBefore) eventData.statusBefore = payload.statusBefore;
  if (payload.statusAfter) eventData.statusAfter = payload.statusAfter;
  if (payload.meta && Object.keys(payload.meta).length > 0) eventData.meta = payload.meta;

  batch.set(eventRef, eventData);
}

export function mergeAttendanceDailyStatToBatch(
  batch: WriteBatch,
  firestore: Firestore,
  centerId: string,
  studentId: string,
  dateKey: string,
  patch: AttendanceDailyStatPatch
) {
  const statRef = doc(firestore, 'centers', centerId, 'attendanceDailyStats', dateKey, 'students', studentId);
  const statData: Record<string, unknown> = {
    centerId,
    studentId,
    dateKey,
    updatedAt: serverTimestamp(),
  };

  if (typeof patch.attendanceStatus === 'string') statData.attendanceStatus = patch.attendanceStatus;
  if (patch.checkInAt !== undefined) statData.checkInAt = toFirestoreTimestamp(patch.checkInAt) ?? null;
  if (patch.checkOutAt !== undefined) statData.checkOutAt = toFirestoreTimestamp(patch.checkOutAt) ?? null;
  if (patch.lateMinutes !== undefined) statData.lateMinutes = patch.lateMinutes;
  if (patch.awayMinutes !== undefined) statData.awayMinutes = patch.awayMinutes;
  if (patch.awayCount !== undefined) statData.awayCount = patch.awayCount;
  if (patch.hasCheckOutRecord !== undefined) statData.hasCheckOutRecord = patch.hasCheckOutRecord;
  if (patch.requestType !== undefined) statData.requestType = patch.requestType;
  if (patch.requestStatus !== undefined) statData.requestStatus = patch.requestStatus;
  if (patch.expectedArrivalTime !== undefined) statData.expectedArrivalTime = patch.expectedArrivalTime;
  if (patch.source) statData.source = patch.source;

  batch.set(statRef, statData, { merge: true });
}
