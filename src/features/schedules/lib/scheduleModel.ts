import type {
  StudentScheduleDoc,
  StudentScheduleOuting,
  StudentScheduleSettings,
} from '@/lib/types';
import type { AttendanceAwaySlot, AttendanceScheduleDraft, SavedAttendanceRoutine } from '@/components/dashboard/student-planner/planner-constants';

export const DEFAULT_SCHEDULE_TIMEZONE = 'Asia/Seoul';

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

export function normalizeOutings(
  primaryAway: Pick<
    AttendanceScheduleDraft,
    'academyName' | 'academyStartTime' | 'academyEndTime' | 'awayStartTime' | 'awayEndTime' | 'awayReason'
  >,
  extraAwaySlots: AttendanceAwaySlot[] = []
): StudentScheduleOuting[] {
  const outings = [
    {
      id: 'academy',
      kind: 'academy' as const,
      title: primaryAway.academyName?.trim() || '학원',
      startTime: primaryAway.academyStartTime,
      endTime: primaryAway.academyEndTime,
      reason: primaryAway.academyName?.trim() || '학원',
    },
    {
      id: 'primary',
      kind: 'outing' as const,
      title: null,
      startTime: primaryAway.awayStartTime,
      endTime: primaryAway.awayEndTime,
      reason: primaryAway.awayReason?.trim() || '',
    },
    ...extraAwaySlots.map((slot) => ({
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
  extraAwaySlots: AttendanceAwaySlot[] = []
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

  if (arrivalMinutes >= departureMinutes) {
    return '등원 예정 시간은 하원 예정 시간보다 빨라야 해요.';
  }

  const hasAcademySchedule = Boolean(
    draft.academyName?.trim() ||
    draft.academyStartTime ||
    draft.academyEndTime
  );
  if (hasAcademySchedule && (!draft.academyStartTime || !draft.academyEndTime)) {
    return '학원 시작 시간과 종료 시간을 모두 입력해 주세요.';
  }

  const outings = normalizeOutings(draft, extraAwaySlots);
  for (const outing of outings) {
    const excursionStart = parseTimeToMinutes(outing.startTime);
    const excursionEnd = parseTimeToMinutes(outing.endTime);
    if (excursionStart === null || excursionEnd === null) {
      return '외출 시간 형식이 올바르지 않아요.';
    }
    if (excursionStart >= excursionEnd) {
      return '외출 시작 시간은 복귀 예정 시간보다 빨라야 해요.';
    }
    if (excursionStart < arrivalMinutes || excursionEnd > departureMinutes) {
      return '외출 시간은 등원~하원 예정 시간 안에서만 입력할 수 있어요.';
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
  const academyOuting = schedule?.outings?.find((outing) => outing.kind === 'academy') || null;
  const regularOutings = (schedule?.outings || []).filter((outing) => outing.kind !== 'academy');
  const firstOuting = regularOutings[0];
  return {
    inTime: schedule?.inTime || (schedule as any)?.arrivalPlannedAt || '09:00',
    outTime: schedule?.outTime || (schedule as any)?.departurePlannedAt || '22:00',
    academyName: academyOuting?.title || academyOuting?.reason || '',
    academyStartTime: academyOuting?.startTime || '',
    academyEndTime: academyOuting?.endTime || '',
    awayStartTime: firstOuting?.startTime || (schedule as any)?.excursionStartAt || '',
    awayEndTime: firstOuting?.endTime || (schedule as any)?.excursionEndAt || '',
    awayReason: firstOuting?.reason || (schedule as any)?.excursionReason || '',
    awaySlots: regularOutings.slice(1).map((outing) => ({
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
    if (outing.kind === 'academy') {
      titles.push(`학원 일정 · ${outing.title || outing.reason || '학원'}: ${outing.startTime} ~ ${outing.endTime}`);
      return;
    }

    titles.push(outing.reason
      ? `외출 예정 · ${outing.reason}: ${outing.startTime} ~ ${outing.endTime}`
      : `외출 예정: ${outing.startTime} ~ ${outing.endTime}`);
  });
  return titles;
}

export function buildScheduleSummary(schedule: AttendanceScheduleDraft, extraAwaySlots: AttendanceAwaySlot[] = []) {
  if (schedule.isAbsent) return '이날은 등원하지 않아요';
  const outings = normalizeOutings(schedule, extraAwaySlots);
  if (outings.length === 0) return `${schedule.inTime} ~ ${schedule.outTime}`;
  const firstOuting = outings[0];
  if (firstOuting.kind === 'academy') {
    return `${schedule.inTime} ~ ${schedule.outTime} · 학원 ${firstOuting.startTime} ~ ${firstOuting.endTime}`;
  }
  return `${schedule.inTime} ~ ${schedule.outTime} · 외출 ${firstOuting.startTime} ~ ${firstOuting.endTime}`;
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
