type StudySessionLike = {
  durationMinutes?: unknown;
  durationSeconds?: unknown;
  startTime?: unknown;
  endTime?: unknown;
};

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
