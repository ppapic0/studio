'use client';

import { initializeFirebase } from '@/firebase';
import { httpsCallable } from 'firebase/functions';

type StopStudentStudySessionSecureInput = {
  centerId: string;
  fallbackStartTimeMs?: number;
};

export type AttendanceSeatStatus = 'studying' | 'away' | 'break' | 'absent';
export type AttendanceTransitionSource =
  | 'student_dashboard'
  | 'kiosk'
  | 'teacher_dashboard'
  | 'admin_focus_board'
  | 'student_index';

export type SetStudentAttendanceStatusSecureInput = {
  centerId: string;
  studentId: string;
  nextStatus: AttendanceSeatStatus;
  seatId?: string;
  seatHint?: {
    seatNo?: number | null;
    roomId?: string | null;
    roomSeatNo?: number | null;
  };
  source: AttendanceTransitionSource;
};

export type SetStudentAttendanceStatusSecureResult = {
  ok?: boolean;
  noop?: boolean;
  previousStatus?: AttendanceSeatStatus;
  nextStatus?: AttendanceSeatStatus;
  seatId?: string | null;
  eventType?: 'check_in' | 'away_start' | 'away_end' | 'check_out' | null;
  eventId?: string | null;
  eventAtMillis?: number | null;
  duplicatedSession?: boolean;
  sessionId?: string | null;
  sessionDateKey?: string | null;
  sessionMinutes?: number;
  totalMinutesAfterSession?: number;
  attendanceAchieved?: boolean;
  bonus6hAchieved?: boolean;
};

export type StopStudentStudySessionSecureResult = {
  ok?: boolean;
  duplicatedSession?: boolean;
  sessionId?: string;
  sessionDateKey?: string;
  sessionMinutes?: number;
  totalMinutesAfterSession?: number;
  attendanceAchieved?: boolean;
  bonus6hAchieved?: boolean;
};

export type RepairRecentStudySessionTotalsInput = {
  centerId: string;
  studentId?: string;
  days?: number;
};

export type RepairRecentStudySessionTotalsResult = {
  ok?: boolean;
  studentCount?: number;
  dayCount?: number;
  sessionsCreated?: number;
  daysSynced?: number;
};

export type CreateManualStudySessionInput = {
  centerId: string;
  studentId: string;
  startAtMs: number;
  endAtMs: number;
  source: 'admin_focus_board';
  note?: string;
};

export type CreateManualStudySessionResult = {
  ok?: boolean;
  sessionId?: string;
  sessionIds?: string[];
  sessionDateKey?: string;
  sessionMinutes?: number;
  totalMinutesAfterSession?: number;
  totalMinutesByDateKey?: Record<string, number>;
};

export type UpdateManualStudySessionInput = {
  centerId: string;
  studentId: string;
  dateKey: string;
  sessionId: string;
  startAtMs: number;
  endAtMs: number;
  source: 'admin_focus_board';
  note?: string;
};

export type UpdateManualStudySessionResult = {
  ok?: boolean;
  sessionId?: string;
  sessionDateKey?: string;
  sessionMinutes?: number;
  totalMinutesAfterSession?: number;
};

export type DeleteManualStudySessionInput = {
  centerId: string;
  studentId: string;
  dateKey: string;
  sessionId: string;
  source: 'admin_focus_board';
  reason?: string;
};

export type DeleteManualStudySessionResult = {
  ok?: boolean;
  sessionId?: string;
  sessionDateKey?: string;
  deletedMinutes?: number;
  totalMinutesAfterSession?: number;
};

export async function stopStudentStudySessionSecure(
  input: StopStudentStudySessionSecureInput
): Promise<StopStudentStudySessionSecureResult> {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<StopStudentStudySessionSecureInput, StopStudentStudySessionSecureResult>(
    functions,
    'stopStudentStudySessionSecure'
  );
  const result = await callable(input);
  return result.data || {};
}

export async function setStudentAttendanceStatusSecure(
  input: SetStudentAttendanceStatusSecureInput
): Promise<SetStudentAttendanceStatusSecureResult> {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<SetStudentAttendanceStatusSecureInput, SetStudentAttendanceStatusSecureResult>(
    functions,
    'setStudentAttendanceStatusSecure'
  );
  const result = await callable(input);
  return result.data || {};
}

export async function createManualStudySessionSecure(
  input: CreateManualStudySessionInput
): Promise<CreateManualStudySessionResult> {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<CreateManualStudySessionInput, CreateManualStudySessionResult>(
    functions,
    'createManualStudySessionSecure'
  );
  const result = await callable(input);
  return result.data || {};
}

export async function updateManualStudySessionSecure(
  input: UpdateManualStudySessionInput
): Promise<UpdateManualStudySessionResult> {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<UpdateManualStudySessionInput, UpdateManualStudySessionResult>(
    functions,
    'updateManualStudySessionSecure'
  );
  const result = await callable(input);
  return result.data || {};
}

export async function deleteManualStudySessionSecure(
  input: DeleteManualStudySessionInput
): Promise<DeleteManualStudySessionResult> {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<DeleteManualStudySessionInput, DeleteManualStudySessionResult>(
    functions,
    'deleteManualStudySessionSecure'
  );
  const result = await callable(input);
  return result.data || {};
}

export async function repairRecentStudySessionTotals(
  input: RepairRecentStudySessionTotalsInput
): Promise<RepairRecentStudySessionTotalsResult> {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<RepairRecentStudySessionTotalsInput, RepairRecentStudySessionTotalsResult>(
    functions,
    'repairRecentStudySessionTotals'
  );
  const result = await callable(input);
  return result.data || {};
}
