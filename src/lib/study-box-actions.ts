'use client';

import { initializeFirebase } from '@/firebase';
import { httpsCallable } from 'firebase/functions';

import type { StudyBoxReward } from '@/lib/student-rewards';

type OpenStudyRewardBoxSecureInput = {
  centerId: string;
  studentId: string;
  dateKey: string;
  hour: number;
  reward: StudyBoxReward;
  dayStatus?: Record<string, any> | null;
  currentPointsBalance?: number;
  currentTotalPointsEarned?: number;
};

type OpenStudyRewardBoxCallableInput = Pick<OpenStudyRewardBoxSecureInput, 'centerId' | 'dateKey' | 'hour'>;

export type OpenStudyRewardBoxSecureResult = {
  ok?: boolean;
  opened?: boolean;
  alreadyOpened?: boolean;
  reward?: StudyBoxReward;
  openedStudyBoxes?: number[];
  claimedStudyBoxes?: number[];
  pointsBalance?: number;
  totalPointsEarned?: number;
};

export async function openStudyRewardBoxSecure(
  input: OpenStudyRewardBoxSecureInput
): Promise<OpenStudyRewardBoxSecureResult> {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<OpenStudyRewardBoxCallableInput, OpenStudyRewardBoxSecureResult>(
    functions,
    'openStudyRewardBoxSecure'
  );
  const result = await callable({
    centerId: input.centerId,
    dateKey: input.dateKey,
    hour: input.hour,
  });
  return result.data || {};
}
