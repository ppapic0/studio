import type { StudentScheduleDoc, StudentScheduleOuting } from '@/lib/types';

export type LegacySchedulePlanItemDeleteAction =
  | { kind: 'clear-schedule' }
  | {
      kind: 'update-schedule';
      patch: Partial<StudentScheduleDoc>;
      nextSchedule: StudentScheduleDoc;
    }
  | { kind: 'delete-plan-item-only' };

function normalizeTitle(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function buildOutingTitle(outing: StudentScheduleOuting) {
  const reason = outing.reason?.trim();
  return reason
    ? `학원/외출 예정 · ${reason}: ${outing.startTime} ~ ${outing.endTime}`
    : `학원/외출 예정: ${outing.startTime} ~ ${outing.endTime}`;
}

function matchesOutingTitle(itemTitle: string, outing: StudentScheduleOuting) {
  const normalizedItemTitle = normalizeTitle(itemTitle);
  if (normalizedItemTitle === normalizeTitle(buildOutingTitle(outing))) return true;

  const hasOutingLabel = normalizedItemTitle.includes('외출') || normalizedItemTitle.includes('학원');
  const hasTimes =
    Boolean(outing.startTime) &&
    Boolean(outing.endTime) &&
    normalizedItemTitle.includes(outing.startTime) &&
    normalizedItemTitle.includes(outing.endTime);
  const hasReason = !outing.reason?.trim() || normalizedItemTitle.includes(outing.reason.trim());
  return hasOutingLabel && hasTimes && hasReason;
}

function buildOutingPatch(outings: StudentScheduleOuting[]): Partial<StudentScheduleDoc> {
  const primaryOuting = outings[0] || null;
  return {
    outings,
    hasExcursion: outings.length > 0,
    excursionStartAt: primaryOuting?.startTime || null,
    excursionEndAt: primaryOuting?.endTime || null,
    excursionReason: primaryOuting?.reason || null,
  };
}

export function resolveLegacySchedulePlanItemDeleteAction(
  schedule: StudentScheduleDoc | null | undefined,
  itemTitle: string
): LegacySchedulePlanItemDeleteAction {
  if (!schedule) return { kind: 'delete-plan-item-only' };

  const title = normalizeTitle(itemTitle);
  if (
    title.includes('등원하지 않습니다') ||
    title.startsWith('등원 예정:') ||
    title.startsWith('하원 예정:')
  ) {
    return { kind: 'clear-schedule' };
  }

  if (title.startsWith('교시제 적용:')) {
    const patch: Partial<StudentScheduleDoc> = {
      classScheduleId: null,
      classScheduleName: null,
    };
    return {
      kind: 'update-schedule',
      patch,
      nextSchedule: {
        ...schedule,
        ...patch,
      },
    };
  }

  const outings = Array.isArray(schedule.outings) ? schedule.outings : [];
  const outingIndex = outings.findIndex((outing) => matchesOutingTitle(title, outing));
  if (outingIndex >= 0) {
    const nextOutings = outings.filter((_, index) => index !== outingIndex);
    const patch = buildOutingPatch(nextOutings);
    return {
      kind: 'update-schedule',
      patch,
      nextSchedule: {
        ...schedule,
        ...patch,
      },
    };
  }

  return { kind: 'delete-plan-item-only' };
}
