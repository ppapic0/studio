'use client';

import { initializeFirebase } from '@/firebase';
import {
  type DocumentReference,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

export const PLANNER_COMPLETION_REWARD_POINTS = 5;
export const PLANNER_COMPLETION_DAILY_REWARD_LIMIT = 4;
const DAILY_POINT_EARN_CAP = 1000;

export type ClaimPlannerCompletionRewardInput = {
  centerId: string;
  dateKey: string;
  taskId: string;
  weekKey?: string;
  category?: unknown;
};

export type ClaimPlannerCompletionRewardSecureResult = {
  ok?: boolean;
  awarded?: boolean;
  duplicate?: boolean;
  dailyLimitReached?: boolean;
  ineligible?: boolean;
  awardedPoints?: number;
  rewardCount?: number;
  rewardLimit?: number;
  pointsBalance?: number;
  totalPointsEarned?: number;
  usedFallback?: boolean;
};

type ClaimPlannerCompletionRewardWithFallbackInput = ClaimPlannerCompletionRewardInput & {
  progressRef?: DocumentReference;
};

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizePlannerCompletionRewardTaskIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => asTrimmedString(entry))
        .filter(Boolean)
    )
  ).slice(-200);
}

function normalizeDailyPointEvents(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainObject).slice(-80);
}

function upsertPlanCompletionPointEvent(
  existing: unknown,
  dateKey: string,
  taskId: string,
  awardedPoints: number
) {
  const next = new Map<string, Record<string, unknown>>();
  normalizeDailyPointEvents(existing).forEach((entry) => {
    const id = asTrimmedString(entry.id);
    if (id) next.set(id, entry);
  });
  const eventId = `plan_completion:${dateKey}:${taskId}`;
  next.set(eventId, {
    id: eventId,
    source: 'plan_completion',
    label: '계획 완수',
    points: awardedPoints,
    createdAt: new Date().toISOString(),
  });
  return Array.from(next.values()).slice(-80);
}

function getDailyAwardedPointTotal(dayStatus: Record<string, unknown>): number {
  const dailyPointAmount = Math.max(0, Math.floor(parseFiniteNumber(dayStatus.dailyPointAmount) ?? 0));
  const pointEventsTotal = normalizeDailyPointEvents(dayStatus.pointEvents).reduce((total, event) => {
    return total + Math.max(0, Math.floor(parseFiniteNumber(event.points) ?? 0));
  }, 0);
  return Math.max(dailyPointAmount, pointEventsTotal);
}

export function isPlannerCompletionRewardEligibleCategory(category: unknown): boolean {
  const normalizedCategory = asTrimmedString(category);
  return !normalizedCategory || normalizedCategory === 'study';
}

function buildIneligibleResult(): ClaimPlannerCompletionRewardSecureResult {
  return {
    ok: true,
    awarded: false,
    duplicate: false,
    dailyLimitReached: false,
    ineligible: true,
    awardedPoints: 0,
    rewardCount: 0,
    rewardLimit: PLANNER_COMPLETION_DAILY_REWARD_LIMIT,
  };
}

export async function claimPlannerCompletionRewardSecure(
  input: ClaimPlannerCompletionRewardInput
): Promise<ClaimPlannerCompletionRewardSecureResult> {
  const { functions } = initializeFirebase();
  const callable = httpsCallable<
    ClaimPlannerCompletionRewardInput,
    ClaimPlannerCompletionRewardSecureResult
  >(functions, 'claimPlannerCompletionRewardSecure');
  const result = await callable(input);
  return result.data || {};
}

async function claimPlannerCompletionRewardLocally(
  input: ClaimPlannerCompletionRewardInput & { progressRef: DocumentReference }
): Promise<ClaimPlannerCompletionRewardSecureResult> {
  return runTransaction(input.progressRef.firestore, async (transaction) => {
    const progressSnap = await transaction.get(input.progressRef);
    if (!progressSnap.exists()) {
      return buildIneligibleResult();
    }

    const progressData = progressSnap.data() as Record<string, unknown>;
    const dailyPointStatus = isPlainObject(progressData.dailyPointStatus)
      ? progressData.dailyPointStatus
      : {};
    const rawDayStatus = dailyPointStatus[input.dateKey];
    const currentDayStatus: Record<string, unknown> = isPlainObject(rawDayStatus)
      ? rawDayStatus
      : {};
    const rewardedTaskIds = normalizePlannerCompletionRewardTaskIds(
      currentDayStatus.planCompletionRewardTaskIds
    );
    const rewardCount = Math.max(
      rewardedTaskIds.length,
      Math.max(0, Math.floor(parseFiniteNumber(currentDayStatus.planCompletionRewardCount) ?? 0))
    );
    const currentPointsBalance = Math.max(0, Math.floor(parseFiniteNumber(progressData.pointsBalance) ?? 0));
    const currentTotalPointsEarned = Math.max(0, Math.floor(parseFiniteNumber(progressData.totalPointsEarned) ?? 0));

    if (rewardedTaskIds.includes(input.taskId)) {
      return {
        ok: true,
        awarded: false,
        duplicate: true,
        dailyLimitReached: false,
        awardedPoints: 0,
        rewardCount,
        rewardLimit: PLANNER_COMPLETION_DAILY_REWARD_LIMIT,
        pointsBalance: currentPointsBalance,
        totalPointsEarned: currentTotalPointsEarned,
      };
    }

    if (rewardCount >= PLANNER_COMPLETION_DAILY_REWARD_LIMIT) {
      return {
        ok: true,
        awarded: false,
        duplicate: false,
        dailyLimitReached: true,
        awardedPoints: 0,
        rewardCount,
        rewardLimit: PLANNER_COMPLETION_DAILY_REWARD_LIMIT,
        pointsBalance: currentPointsBalance,
        totalPointsEarned: currentTotalPointsEarned,
      };
    }

    const remainingDailyPoints = Math.max(0, DAILY_POINT_EARN_CAP - getDailyAwardedPointTotal(currentDayStatus));
    const awardedPoints = Math.min(PLANNER_COMPLETION_REWARD_POINTS, remainingDailyPoints);
    const nextRewardedTaskIds = normalizePlannerCompletionRewardTaskIds([...rewardedTaskIds, input.taskId]);
    const nextRewardCount = nextRewardedTaskIds.length;
    const nextPointEvents = awardedPoints > 0
      ? upsertPlanCompletionPointEvent(currentDayStatus.pointEvents, input.dateKey, input.taskId, awardedPoints)
      : normalizeDailyPointEvents(currentDayStatus.pointEvents);
    const currentDailyPointAmount = Math.max(0, Math.floor(parseFiniteNumber(currentDayStatus.dailyPointAmount) ?? 0));

    transaction.set(input.progressRef, {
      ...(awardedPoints > 0
        ? {
            pointsBalance: currentPointsBalance + awardedPoints,
            totalPointsEarned: currentTotalPointsEarned + awardedPoints,
          }
        : {}),
      dailyPointStatus: {
        [input.dateKey]: {
          ...currentDayStatus,
          planCompletionRewardTaskIds: nextRewardedTaskIds,
          planCompletionRewardCount: nextRewardCount,
          pointEvents: nextPointEvents,
          dailyPointAmount: currentDailyPointAmount + awardedPoints,
          updatedAt: serverTimestamp(),
        },
      },
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return {
      ok: true,
      awarded: awardedPoints > 0,
      duplicate: false,
      dailyLimitReached: false,
      awardedPoints,
      rewardCount: nextRewardCount,
      rewardLimit: PLANNER_COMPLETION_DAILY_REWARD_LIMIT,
      pointsBalance: currentPointsBalance + awardedPoints,
      totalPointsEarned: currentTotalPointsEarned + awardedPoints,
    };
  });
}

export async function claimPlannerCompletionRewardWithFallback(
  input: ClaimPlannerCompletionRewardWithFallbackInput
): Promise<ClaimPlannerCompletionRewardSecureResult> {
  if (!isPlannerCompletionRewardEligibleCategory(input.category)) {
    return buildIneligibleResult();
  }

  try {
    return await claimPlannerCompletionRewardSecure(input);
  } catch (error) {
    if (!input.progressRef) throw error;
    const localResult = await claimPlannerCompletionRewardLocally({
      ...input,
      progressRef: input.progressRef,
    });
    return {
      ...localResult,
      usedFallback: true,
    };
  }
}
