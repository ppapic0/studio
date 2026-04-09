'use client';

import { initializeFirebase } from '@/firebase';
import { httpsCallable } from 'firebase/functions';

import type { StudyBoxReward } from '@/lib/student-rewards';

type OpenStudyRewardBoxSecureInput = {
  centerId: string;
  dateKey: string;
  hour: number;
};

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
  const callable = httpsCallable<OpenStudyRewardBoxSecureInput, OpenStudyRewardBoxSecureResult>(
    functions,
    'openStudyRewardBoxSecure'
  );
  const result = await callable(input);
  return result.data || {};
}
