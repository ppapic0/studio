'use client';

import { initializeFirebase } from '@/firebase';
import { doc, increment, serverTimestamp, setDoc } from 'firebase/firestore';

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

const DAILY_POINT_EARN_CAP = 1000;

function normalizeStudyBoxHours(values: unknown) {
  if (!Array.isArray(values)) return [] as number[];
  return Array.from(
    new Set(
      values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 1 && value <= 8)
    )
  ).sort((a, b) => a - b);
}

function normalizeStudyBoxRewardEntries(values: unknown) {
  if (!Array.isArray(values)) return [] as StudyBoxReward[];
  return values
    .map((entry): StudyBoxReward | null => {
      const milestone = Number(entry?.milestone);
      const minReward = Number(entry?.minReward);
      const maxReward = Number(entry?.maxReward);
      const awardedPoints = Number(entry?.awardedPoints);
      const multiplier = Number(entry?.multiplier ?? 1);
      const rarity = entry?.rarity;
      if (!Number.isFinite(milestone) || milestone < 1 || milestone > 8) return null;
      if (!Number.isFinite(minReward) || !Number.isFinite(maxReward) || !Number.isFinite(awardedPoints)) return null;
      if (rarity !== 'common' && rarity !== 'rare' && rarity !== 'epic') return null;
      return {
        milestone,
        rarity,
        minReward,
        maxReward,
        awardedPoints,
        multiplier: Number.isFinite(multiplier) ? multiplier : 1,
      };
    })
    .filter((entry): entry is StudyBoxReward => Boolean(entry))
    .sort((a, b) => a.milestone - b.milestone);
}

function upsertStudyBoxRewardEntry(entries: StudyBoxReward[], reward: StudyBoxReward) {
  const next = new Map<number, StudyBoxReward>();
  entries.forEach((entry) => {
    next.set(entry.milestone, entry);
  });
  next.set(reward.milestone, reward);
  return Array.from(next.values()).sort((a, b) => a.milestone - b.milestone);
}

function getLegacyDailyPointAwardTotal(dayStatus: Record<string, any>) {
  const studyBoxPoints = normalizeStudyBoxRewardEntries(dayStatus.studyBoxRewards).reduce(
    (total, entry) => total + Math.max(0, Math.floor(entry.awardedPoints)),
    0
  );
  const rankRewardPoints = ['dailyRankRewardAmount', 'weeklyRankRewardAmount', 'monthlyRankRewardAmount'].reduce(
    (total, key) => total + Math.max(0, Math.floor(Number(dayStatus?.[key] || 0))),
    0
  );
  return studyBoxPoints + rankRewardPoints;
}

function getDailyAwardedPointTotal(dayStatus: Record<string, any>) {
  const dailyPointAmount = Math.max(0, Math.floor(Number(dayStatus?.dailyPointAmount || 0)));
  return Math.max(dailyPointAmount, getLegacyDailyPointAwardTotal(dayStatus));
}

export async function openStudyRewardBoxSecure(
  input: OpenStudyRewardBoxSecureInput
): Promise<OpenStudyRewardBoxSecureResult> {
  const { firestore } = initializeFirebase();
  const progressRef = doc(firestore, 'centers', input.centerId, 'growthProgress', input.studentId);
  const currentDayStatus = input.dayStatus || {};
  const openedStudyBoxes = normalizeStudyBoxHours(currentDayStatus.openedStudyBoxes);
  const claimedStudyBoxes = normalizeStudyBoxHours(currentDayStatus.claimedStudyBoxes);
  const rewardEntries = normalizeStudyBoxRewardEntries(currentDayStatus.studyBoxRewards);
  const alreadyOpened = openedStudyBoxes.includes(input.hour);
  const storedReward = rewardEntries.find((entry) => entry.milestone === input.hour) || null;
  const baseReward = alreadyOpened ? (storedReward || input.reward) : input.reward;
  const currentDailyPointAmount = getDailyAwardedPointTotal(currentDayStatus);
  const awardedDelta = alreadyOpened
    ? 0
    : Math.min(Math.max(0, DAILY_POINT_EARN_CAP - currentDailyPointAmount), Math.max(0, Math.floor(baseReward.awardedPoints)));
  const creditedReward: StudyBoxReward = alreadyOpened
    ? baseReward
    : {
        ...baseReward,
        awardedPoints: awardedDelta,
      };
  const nextOpenedStudyBoxes = normalizeStudyBoxHours([...openedStudyBoxes, input.hour]);
  const nextClaimedStudyBoxes = normalizeStudyBoxHours([...claimedStudyBoxes, input.hour]);
  const nextRewardEntries = upsertStudyBoxRewardEntry(rewardEntries, creditedReward);
  const nextDailyPointAmount = currentDailyPointAmount + awardedDelta;

  await setDoc(progressRef, {
    pointsBalance: increment(awardedDelta),
    totalPointsEarned: increment(awardedDelta),
    dailyPointStatus: {
      [input.dateKey]: {
        ...currentDayStatus,
        claimedStudyBoxes: nextClaimedStudyBoxes,
        openedStudyBoxes: nextOpenedStudyBoxes,
        studyBoxRewards: nextRewardEntries,
        dailyPointAmount: nextDailyPointAmount,
        updatedAt: serverTimestamp(),
      },
    },
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return {
    ok: true,
    opened: !alreadyOpened,
    alreadyOpened,
    reward: creditedReward,
    openedStudyBoxes: nextOpenedStudyBoxes,
    claimedStudyBoxes: nextClaimedStudyBoxes,
    pointsBalance: typeof input.currentPointsBalance === 'number'
      ? Math.max(0, input.currentPointsBalance + awardedDelta)
      : undefined,
    totalPointsEarned: typeof input.currentTotalPointsEarned === 'number'
      ? Math.max(0, input.currentTotalPointsEarned + awardedDelta)
      : undefined,
  };
}
