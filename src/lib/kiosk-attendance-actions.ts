import { httpsCallable, type Functions } from 'firebase/functions';
import type { AttendanceCurrent } from '@/lib/types';

export type KioskAttendanceAction = 'check_in' | 'away_start' | 'away_end' | 'check_out';

export type EnqueueKioskAttendanceActionInput = {
  centerId: string;
  studentId: string;
  pin: string;
  action: KioskAttendanceAction;
  expectedStatus: AttendanceCurrent['status'];
  seatId?: string | null;
  seatHint?: {
    seatNo?: number | null;
    roomId?: string | null;
    roomSeatNo?: number | null;
  } | null;
  idempotencyKey: string;
  clientActionAtMillis: number;
};

export type EnqueueKioskAttendanceActionResult = {
  ok: true;
  queued: boolean;
  actionId: string;
  optimisticStatus: AttendanceCurrent['status'];
  status?: 'queued' | 'processing' | 'completed' | 'failed' | 'rejected_stale';
  verified?: boolean;
  confirmedStatus?: AttendanceCurrent['status'];
  confirmedSeatId?: string;
  result?: Record<string, unknown>;
  userMessage?: string;
  failedReason?: string;
  staleReason?: string;
};

export type SubmitKioskAttendanceActionFastInput = {
  centerId: string;
  studentId: string;
  pin: string;
  action: KioskAttendanceAction;
  expectedStatus: AttendanceCurrent['status'];
  seatId?: string | null;
  seatHint?: {
    seatNo?: number | null;
    roomId?: string | null;
    roomSeatNo?: number | null;
  } | null;
  idempotencyKey: string;
  clientActionAtMillis: number;
};

export type SubmitKioskAttendanceActionFastResult = {
  ok: true;
  actionId: string;
  state: 'applied' | 'already_applied' | 'queued' | 'stale';
  nextStatus: AttendanceCurrent['status'];
  previousStatus?: AttendanceCurrent['status'];
  confirmedStatus?: AttendanceCurrent['status'];
  confirmedSeatId?: string;
  eventId?: string;
  userMessage?: string;
};

export async function enqueueKioskAttendanceActionSecure(
  functions: Functions,
  input: EnqueueKioskAttendanceActionInput
): Promise<EnqueueKioskAttendanceActionResult> {
  const callable = httpsCallable<EnqueueKioskAttendanceActionInput, EnqueueKioskAttendanceActionResult>(
    functions,
    'enqueueKioskAttendanceActionSecure'
  );
  const result = await callable(input);
  return result.data;
}

export async function submitKioskAttendanceActionFast(
  functions: Functions,
  input: SubmitKioskAttendanceActionFastInput
): Promise<SubmitKioskAttendanceActionFastResult> {
  const callable = httpsCallable<SubmitKioskAttendanceActionFastInput, SubmitKioskAttendanceActionFastResult>(
    functions,
    'submitKioskAttendanceActionFast'
  );
  const result = await callable(input);
  return result.data;
}
