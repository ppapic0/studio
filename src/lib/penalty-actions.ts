'use client';

import { initializeFirebase } from '@/firebase';
import { httpsCallable } from 'firebase/functions';
import type { AttendanceRequestReasonCategory } from '@/lib/types';

export type SecurePenaltySource = 'manual' | 'routine_missing';
export type AttendanceRequestType = 'late' | 'absence' | 'schedule_change';

export type AttendanceRequestProofUploadPayload = {
  id: string;
  name: string;
  path: string;
  downloadToken: string;
  contentType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
};

type ApplyPenaltyEventSecureInput = {
  centerId: string;
  studentId: string;
  source: SecurePenaltySource;
  reason: string;
  pointsDelta: number;
  penaltyDateKey: string;
  penaltyKey?: string;
};

type ApplyPenaltyEventSecureResult = {
  applied?: boolean;
  duplicate?: boolean;
  penaltyLogId?: string;
  penaltyPointsDelta?: number;
};

type SubmitAttendanceRequestSecureInput = {
  centerId: string;
  requestType: AttendanceRequestType;
  requestDate: string;
  reason: string;
  reasonCategory?: AttendanceRequestReasonCategory;
  parentContactConfirmed?: boolean;
  requestedArrivalTime?: string | null;
  requestedDepartureTime?: string | null;
  requestedAcademyName?: string | null;
  requestedAcademyStartTime?: string | null;
  requestedAcademyEndTime?: string | null;
  scheduleChangeAction?: 'save' | 'absent' | 'reset' | null;
  classScheduleId?: string | null;
  classScheduleName?: string | null;
  proofAttachments?: AttendanceRequestProofUploadPayload[];
};

type SubmitAttendanceRequestSecureResult = {
  ok?: boolean;
  requestId?: string;
  penaltyLogId?: string;
  penaltyPointsDelta?: number;
  penaltyApplied?: boolean;
  penaltyWaived?: boolean;
  duplicatePenalty?: boolean;
};

export async function applyPenaltyEventSecure(
  input: ApplyPenaltyEventSecureInput
): Promise<ApplyPenaltyEventSecureResult> {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<ApplyPenaltyEventSecureInput, ApplyPenaltyEventSecureResult>(
    functions,
    'applyPenaltyEventSecure'
  );
  const result = await callable(input);
  return result.data || {};
}

export async function submitAttendanceRequestSecure(
  input: SubmitAttendanceRequestSecureInput
): Promise<SubmitAttendanceRequestSecureResult> {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<SubmitAttendanceRequestSecureInput, SubmitAttendanceRequestSecureResult>(
    functions,
    'submitAttendanceRequestSecure'
  );
  const result = await callable(input);
  return result.data || {};
}
