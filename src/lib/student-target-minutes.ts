import type { StudentProfile, User as UserType } from '@/lib/types';

type TargetDailyMinutesSource = 'default' | 'routine' | 'manual';

type TargetDailyMinutesHolder = Pick<
  StudentProfile,
  'targetDailyMinutes' | 'targetDailyMinutesSource'
> &
  Pick<UserType, 'targetDailyMinutes' | 'targetDailyMinutesSource'>;

function normalizeTargetDailyMinutes(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return Math.max(0, Math.round(numericValue));
}

export function resolveStudentTargetDailyMinutes(
  studentProfile?: Partial<TargetDailyMinutesHolder> | null,
  userProfile?: Partial<TargetDailyMinutesHolder> | null
) {
  const studentTargetMinutes = normalizeTargetDailyMinutes(studentProfile?.targetDailyMinutes);
  if (studentTargetMinutes !== null) {
    return {
      minutes: studentTargetMinutes,
      source: (studentProfile?.targetDailyMinutesSource || 'default') as TargetDailyMinutesSource,
    };
  }

  const userTargetMinutes = normalizeTargetDailyMinutes(userProfile?.targetDailyMinutes);
  if (userTargetMinutes !== null) {
    return {
      minutes: userTargetMinutes,
      source: (userProfile?.targetDailyMinutesSource || 'default') as TargetDailyMinutesSource,
    };
  }

  return {
    minutes: null,
    source: 'default' as TargetDailyMinutesSource,
  };
}

export function resolveStudentTargetDailyMinutesOrFallback(
  studentProfile?: Partial<TargetDailyMinutesHolder> | null,
  userProfile?: Partial<TargetDailyMinutesHolder> | null,
  fallbackMinutes = 240
) {
  const resolvedTarget = resolveStudentTargetDailyMinutes(studentProfile, userProfile);
  return {
    minutes: resolvedTarget.minutes ?? fallbackMinutes,
    source: resolvedTarget.source,
  };
}
