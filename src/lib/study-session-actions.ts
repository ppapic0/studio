'use client';

import { initializeFirebase } from '@/firebase';
import { httpsCallable } from 'firebase/functions';

type StopStudentStudySessionSecureInput = {
  centerId: string;
  fallbackStartTimeMs?: number;
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
