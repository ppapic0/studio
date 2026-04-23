'use client';

import { initializeFirebase } from '@/firebase';
import { httpsCallable } from 'firebase/functions';

export const PLANNER_COMPLETION_REWARD_POINTS = 5;
export const PLANNER_COMPLETION_DAILY_REWARD_LIMIT = 4;

type ClaimPlannerCompletionRewardSecureInput = {
  centerId: string;
  dateKey: string;
  taskId: string;
};

export type ClaimPlannerCompletionRewardSecureResult = {
  ok?: boolean;
  awarded?: boolean;
  duplicate?: boolean;
  dailyLimitReached?: boolean;
  awardedPoints?: number;
  rewardCount?: number;
  rewardLimit?: number;
  pointsBalance?: number;
  totalPointsEarned?: number;
};

export async function claimPlannerCompletionRewardSecure(
  input: ClaimPlannerCompletionRewardSecureInput
): Promise<ClaimPlannerCompletionRewardSecureResult> {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<
    ClaimPlannerCompletionRewardSecureInput,
    ClaimPlannerCompletionRewardSecureResult
  >(functions, 'claimPlannerCompletionRewardSecure');
  const result = await callable(input);
  return result.data || {};
}
