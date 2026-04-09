'use client';

import { initializeFirebase } from '@/firebase';
import { httpsCallable } from 'firebase/functions';

export type SecurePenaltySource = 'manual' | 'routine_missing';
export type AttendanceRequestType = 'late' | 'absence';

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
};

type SubmitAttendanceRequestSecureResult = {
  ok?: boolean;
  requestId?: string;
  penaltyLogId?: string;
  penaltyPointsDelta?: number;
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
