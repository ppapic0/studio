type StudySessionLike = {
  durationMinutes?: unknown;
  durationSeconds?: unknown;
  startTime?: unknown;
  endTime?: unknown;
};

type StudyAttendanceStatus = 'studying' | 'away' | 'break' | 'absent' | string | null | undefined;

function toDateSafe(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  }
  if (typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    const millis = (value as { toMillis: () => number }).toMillis();
    const date = new Date(millis);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
}

export function getStudySessionDurationMinutes(session: StudySessionLike): number {
  const directMinutes = Number(session.durationMinutes ?? 0);
  if (Number.isFinite(directMinutes) && directMinutes > 0) {
    return Math.max(0, Math.round(directMinutes));
  }

  const directSeconds = Number(session.durationSeconds ?? 0);
  if (Number.isFinite(directSeconds) && directSeconds > 0) {
    return Math.max(1, Math.ceil(directSeconds / 60));
  }

  const startAt = toDateSafe(session.startTime);
  const endAt = toDateSafe(session.endTime);
  if (!startAt || !endAt) return 0;

  const diffMs = endAt.getTime() - startAt.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;
  return Math.max(1, Math.ceil(diffMs / 60000));
}

export function sumStudySessionDurationMinutes(sessions: StudySessionLike[] | null | undefined): number {
  return Math.max(
    0,
    Math.round((sessions || []).reduce((sum, session) => sum + getStudySessionDurationMinutes(session), 0))
  );
}

export function getLiveStudySessionDurationMinutes(input: {
  status?: StudyAttendanceStatus;
  lastCheckInAt?: unknown;
  nowMs?: number;
  dayStartMs?: number;
  rounding?: 'floor' | 'ceil';
}): number {
  if (input.status !== 'studying') return 0;

  const checkedAt = toDateSafe(input.lastCheckInAt);
  if (!checkedAt) return 0;

  const nowMs = Number.isFinite(input.nowMs) ? Number(input.nowMs) : Date.now();
  const dayStartMs = Number.isFinite(input.dayStartMs) ? Number(input.dayStartMs) : checkedAt.getTime();
  const startMs = Math.max(checkedAt.getTime(), dayStartMs);
  const diffMs = nowMs - startMs;
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 0;

  const rawMinutes = diffMs / 60000;
  return Math.max(0, input.rounding === 'floor' ? Math.floor(rawMinutes) : Math.ceil(rawMinutes));
}

export function getEffectiveTodayStudyMinutes(input: {
  sessions?: StudySessionLike[] | null;
  persistedMinutes?: number | null;
  manualAdjustmentMinutes?: number | null;
  status?: StudyAttendanceStatus;
  lastCheckInAt?: unknown;
  nowMs?: number;
  dayStartMs?: number;
}): number {
  const sessionMinutes = sumStudySessionDurationMinutes(input.sessions);
  const persistedMinutes = Number(input.persistedMinutes ?? 0);
  const baseMinutes = sessionMinutes > 0
    ? sessionMinutes
    : Number.isFinite(persistedMinutes)
      ? Math.max(0, Math.round(persistedMinutes))
      : 0;
  const adjustmentMinutes = Number(input.manualAdjustmentMinutes ?? 0);
  const liveMinutes = getLiveStudySessionDurationMinutes({
    status: input.status,
    lastCheckInAt: input.lastCheckInAt,
    nowMs: input.nowMs,
    dayStartMs: input.dayStartMs,
  });

  return Math.max(
    0,
    Math.round(baseMinutes + (Number.isFinite(adjustmentMinutes) ? adjustmentMinutes : 0) + liveMinutes)
  );
}
