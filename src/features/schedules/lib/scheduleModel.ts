import type {
  StudentScheduleDoc,
  StudentScheduleOuting,
  StudentScheduleSettings,
} from '@/lib/types';
import type { AttendanceAwaySlot, AttendanceScheduleDraft, SavedAttendanceRoutine } from '@/components/dashboard/student-planner/planner-constants';

export const DEFAULT_SCHEDULE_TIMEZONE = 'Asia/Seoul';
const MINUTES_PER_DAY = 24 * 60;
const OVERNIGHT_DEPARTURE_CUTOFF_MINUTES = 6 * 60;

export function parseTimeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

export function formatMinutesAsTime(totalMinutes: number) {
  const normalized = ((Math.round(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export function addMinutesToTime(value: string, minutesToAdd: number) {
  const totalMinutes = parseTimeToMinutes(value);
  if (totalMinutes === null) return value;
  return formatMinutesAsTime(totalMinutes + minutesToAdd);
}

function hasAwaySlotValue(slot: Pick<AttendanceAwaySlot, 'startTime' | 'endTime' | 'reason'>) {
  return Boolean(slot.startTime || slot.endTime || slot.reason?.trim());
}

function getOperationalDepartureMinutes(arrivalMinutes: number, departureMinutes: number) {
  if (departureMinutes > arrivalMinutes) return departureMinutes;
  if (arrivalMinutes > OVERNIGHT_DEPARTURE_CUTOFF_MINUTES && departureMinutes <= OVERNIGHT_DEPARTURE_CUTOFF_MINUTES) {
    return departureMinutes + MINUTES_PER_DAY;
  }
  return departureMinutes;
}

function toOperationalScheduleMinutes(minutes: number, arrivalMinutes: number, operationalDepartureMinutes: number) {
  return operationalDepartureMinutes >= MINUTES_PER_DAY && minutes < arrivalMinutes
    ? minutes + MINUTES_PER_DAY
    : minutes;
}

export function mergeAcademyIntoAwayDraft(draft: AttendanceScheduleDraft): AttendanceScheduleDraft {
  const slots: AttendanceAwaySlot[] = [];
  const academyReason = draft.academyName?.trim() || '학원';

  if (draft.academyStartTime || draft.academyEndTime) {
    slots.push({
      id: 'academy',
      startTime: draft.academyStartTime,
      endTime: draft.academyEndTime,
      reason: academyReason,
    });
  }

  if (draft.awayStartTime || draft.awayEndTime || draft.awayReason?.trim()) {
    slots.push({
      id: 'primary',
      startTime: draft.awayStartTime,
      endTime: draft.awayEndTime,
      reason: draft.awayReason?.trim() || '',
    });
  }

  slots.push(...(draft.awaySlots || []));

  const [primarySlot, ...extraSlots] = slots.filter(hasAwaySlotValue);

  return {
    ...draft,
    academyName: '',
    academyStartTime: '',
    academyEndTime: '',
    awayStartTime: primarySlot?.startTime || '',
    awayEndTime: primarySlot?.endTime || '',
    awayReason: primarySlot?.reason || '',
    awaySlots: extraSlots,
  };
}

export function normalizeOutings(
  primaryAway: AttendanceScheduleDraft,
  extraAwaySlots?: AttendanceAwaySlot[]
): StudentScheduleOuting[] {
  const sourceExtraAwaySlots = extraAwaySlots ?? primaryAway.awaySlots ?? [];
  const mergedDraft = mergeAcademyIntoAwayDraft({
    ...primaryAway,
    awaySlots: sourceExtraAwaySlots,
  });
  const outings = [
    {
      id: 'primary',
      kind: 'outing' as const,
      title: null,
      startTime: mergedDraft.awayStartTime,
      endTime: mergedDraft.awayEndTime,
      reason: mergedDraft.awayReason?.trim() || '',
    },
    ...(mergedDraft.awaySlots || []).map((slot) => ({
      id: slot.id,
      kind: 'outing' as const,
      title: null,
      startTime: slot.startTime,
      endTime: slot.endTime,
      reason: slot.reason?.trim() || '',
    })),
  ];

  return outings
    .filter((slot) => slot.startTime && slot.endTime)
    .map((slot, index) => ({
      id: slot.id || `outing-${index + 1}`,
      kind: slot.kind,
      title: slot.title,
      startTime: slot.startTime,
      endTime: slot.endTime,
      reason: slot.reason || '',
    }));
}

export function validateScheduleDraft(
  draft: AttendanceScheduleDraft,
  extraAwaySlots?: AttendanceAwaySlot[]
) {
  if (draft.isAbsent) return null;

  if (!draft.inTime || !draft.outTime) {
    return '등원 예정 시간과 하원 예정 시간을 모두 입력해 주세요.';
  }

  const arrivalMinutes = parseTimeToMinutes(draft.inTime);
  const departureMinutes = parseTimeToMinutes(draft.outTime);

  if (arrivalMinutes === null || departureMinutes === null) {
    return '시간 형식이 올바르지 않아요.';
  }

  const operationalDepartureMinutes = getOperationalDepartureMinutes(arrivalMinutes, departureMinutes);

  if (arrivalMinutes >= operationalDepartureMinutes) {
    return '등원 예정 시간은 하원 예정 시간보다 빨라야 해요.';
  }

  const mergedDraft = mergeAcademyIntoAwayDraft({
    ...draft,
    awaySlots: extraAwaySlots ?? draft.awaySlots ?? [],
  });
  const rawOutings = [
    {
      startTime: mergedDraft.awayStartTime,
      endTime: mergedDraft.awayEndTime,
      reason: mergedDraft.awayReason,
    },
    ...(mergedDraft.awaySlots || []),
  ].filter(hasAwaySlotValue);

  for (const outing of rawOutings) {
    if (!outing.startTime || !outing.endTime) {
      return '학원 및 외출 시작 시간과 복귀 예정 시간을 모두 입력해 주세요.';
    }
  }

  const outings = normalizeOutings(mergedDraft, mergedDraft.awaySlots || []);
  for (const outing of outings) {
    const rawExcursionStart = parseTimeToMinutes(outing.startTime);
    const rawExcursionEnd = parseTimeToMinutes(outing.endTime);
    if (rawExcursionStart === null || rawExcursionEnd === null) {
      return '학원 및 외출 시간 형식이 올바르지 않아요.';
    }
    const excursionStart = toOperationalScheduleMinutes(rawExcursionStart, arrivalMinutes, operationalDepartureMinutes);
    const excursionEnd = toOperationalScheduleMinutes(rawExcursionEnd, arrivalMinutes, operationalDepartureMinutes);
    if (excursionStart >= excursionEnd) {
      return '시작 시간은 복귀 예정 시간보다 빨라야 해요.';
    }
    if (excursionStart < arrivalMinutes || excursionEnd > operationalDepartureMinutes) {
      return '학원 및 외출 시간은 등원~하원 예정 시간 안에서만 입력할 수 있어요.';
    }
  }

  return null;
}

export function buildScheduleDocFromDraft(params: {
  uid: string;
  studentName: string;
  centerId: string | null;
  dateKey: string;
  draft: AttendanceScheduleDraft;
  extraAwaySlots?: AttendanceAwaySlot[];
  note?: string | null;
  recurrenceSourceId?: string | null;
  recommendedStudyMinutes?: number | null;
  recommendedWeeklyDays?: number | null;
  source?: StudentScheduleDoc['source'];
}): Omit<StudentScheduleDoc, 'createdAt' | 'updatedAt'> {
  const outings = normalizeOutings(params.draft, params.extraAwaySlots || []);
  const primaryOuting = outings[0] || null;

  return {
    uid: params.uid,
    studentName: params.studentName,
    centerId: params.centerId,
    dateKey: params.dateKey,
    timezone: DEFAULT_SCHEDULE_TIMEZONE,
    arrivalPlannedAt: params.draft.inTime,
    departurePlannedAt: params.draft.outTime,
    hasExcursion: outings.length > 0,
    excursionStartAt: primaryOuting?.startTime || null,
    excursionEndAt: primaryOuting?.endTime || null,
    excursionReason: primaryOuting?.reason || null,
    note: params.note?.trim() || null,
    recurrenceSourceId: params.recurrenceSourceId || null,
    status: params.draft.isAbsent ? 'absent' : 'scheduled',
    actualArrivalAt: null,
    actualDepartureAt: null,
    inTime: params.draft.inTime,
    outTime: params.draft.outTime,
    isAbsent: Boolean(params.draft.isAbsent),
    outings,
    classScheduleId: params.draft.classScheduleId || null,
    classScheduleName: params.draft.classScheduleName || null,
    recommendedStudyMinutes: params.recommendedStudyMinutes ?? null,
    recommendedWeeklyDays: params.recommendedWeeklyDays ?? null,
    source: params.source || (params.recurrenceSourceId ? 'regular-routine' : 'manual'),
  };
}

export function buildDraftFromScheduleDoc(schedule?: Partial<StudentScheduleDoc> | null): AttendanceScheduleDraft {
  const outingSlots =
    schedule?.outings?.map((outing) => ({
      id: outing.id,
      startTime: outing.startTime,
      endTime: outing.endTime,
      reason: outing.reason || outing.title || (outing.kind === 'academy' ? '학원' : ''),
    })) || [];
  const fallbackOuting =
    !outingSlots.length && ((schedule as any)?.excursionStartAt || (schedule as any)?.excursionEndAt || (schedule as any)?.excursionReason)
      ? [{
          id: 'legacy-excursion',
          startTime: (schedule as any)?.excursionStartAt || '',
          endTime: (schedule as any)?.excursionEndAt || '',
          reason: (schedule as any)?.excursionReason || '',
        }]
      : [];
  const [firstOuting, ...extraOutings] = [...outingSlots, ...fallbackOuting].filter(hasAwaySlotValue);
  return {
    inTime: schedule?.inTime || (schedule as any)?.arrivalPlannedAt || '09:00',
    outTime: schedule?.outTime || (schedule as any)?.departurePlannedAt || '22:00',
    academyName: '',
    academyStartTime: '',
    academyEndTime: '',
    awayStartTime: firstOuting?.startTime || '',
    awayEndTime: firstOuting?.endTime || '',
    awayReason: firstOuting?.reason || '',
    awaySlots: extraOutings.map((outing) => ({
      id: outing.id,
      startTime: outing.startTime,
      endTime: outing.endTime,
      reason: outing.reason,
    })) || [],
    isAbsent: Boolean(schedule?.isAbsent || (schedule as any)?.status === 'absent'),
    classScheduleId: schedule?.classScheduleId || null,
    classScheduleName: schedule?.classScheduleName || null,
  };
}

export function buildLegacyScheduleTitles(schedule: StudentScheduleDoc) {
  if (schedule.isAbsent) {
    return ['이날 등원하지 않습니다'];
  }

  const titles = [`등원 예정: ${schedule.inTime}`, `하원 예정: ${schedule.outTime}`];
  if (schedule.classScheduleName?.trim()) {
    titles.push(`교시제 적용: ${schedule.classScheduleName.trim()}`);
  }
  schedule.outings.forEach((outing) => {
    titles.push(outing.reason
      ? `학원/외출 예정 · ${outing.reason}: ${outing.startTime} ~ ${outing.endTime}`
      : `학원/외출 예정: ${outing.startTime} ~ ${outing.endTime}`);
  });
  return titles;
}

export function buildScheduleSummary(schedule: AttendanceScheduleDraft, extraAwaySlots: AttendanceAwaySlot[] = []) {
  if (schedule.isAbsent) return '이날은 등원하지 않아요';
  const outings = normalizeOutings(schedule, extraAwaySlots);
  if (outings.length === 0) return `${schedule.inTime} ~ ${schedule.outTime}`;
  const firstOuting = outings[0];
  return `${schedule.inTime} ~ ${schedule.outTime} · 학원/외출 ${firstOuting.startTime} ~ ${firstOuting.endTime}`;
}

export function hydrateSavedRoutine(routine: SavedAttendanceRoutine) {
  return {
    id: routine.id,
    name: routine.name,
    schedule: buildScheduleDocFromDraft({
      uid: '',
      studentName: '',
      centerId: null,
      dateKey: '',
      draft: routine,
      extraAwaySlots: routine.awaySlots || [],
    }),
  };
}

export function parseScheduleSettings(data: any): StudentScheduleSettings {
  const weekdayTemplates = Object.fromEntries(
    Object.entries(data?.weekdayTemplates || {}).map(([weekday, value]) => [weekday, value as StudentScheduleDoc])
  );
  const savedRoutines = Array.isArray(data?.savedRoutines)
    ? data.savedRoutines.map((item: any) => ({
        id: String(item?.id || ''),
        name: String(item?.name || '저장한 루틴'),
        schedule: item?.schedule as StudentScheduleDoc,
      }))
    : [];

  return {
    weekdayTemplates,
    savedRoutines,
    updatedAt: data?.updatedAt,
  };
}
