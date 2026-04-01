import { type QuestionSection } from '@/lib/types';

const SECONDS_PER_STEP = 8;

export function estimateRemainingTime(currentStep: number, totalSteps: number) {
  const remainingSteps = Math.max(totalSteps - currentStep, 0);
  const remainingSeconds = remainingSteps * SECONDS_PER_STEP;
  if (remainingSeconds <= 35) return '약 30초 남음';
  if (remainingSeconds <= 70) return '약 1분 남음';
  return '약 1~2분 남음';
}

export function getSectionLabel(section: QuestionSection) {
  return section;
}
