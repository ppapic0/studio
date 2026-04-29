export const STUDY_DAY_RESET_HOUR = 1;
export const STUDY_BOX_CARRYOVER_GRACE_MINUTES = 30;

const STUDY_DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function padNumber(value: number) {
  return String(value).padStart(2, '0');
}

export function toKstDate(baseDate: Date = new Date()) {
  const formatted = baseDate.toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
  return new Date(formatted);
}

export function toDateKey(baseDate: Date) {
  return `${baseDate.getFullYear()}-${padNumber(baseDate.getMonth() + 1)}-${padNumber(baseDate.getDate())}`;
}

export function getStudyDayDate(baseDate: Date = new Date()) {
  const kstDate = toKstDate(baseDate);
  if (kstDate.getHours() < STUDY_DAY_RESET_HOUR) {
    kstDate.setDate(kstDate.getDate() - 1);
  }
  kstDate.setHours(0, 0, 0, 0);
  return kstDate;
}

export function getStudyDayKey(baseDate: Date = new Date()) {
  return toDateKey(getStudyDayDate(baseDate));
}

export function getStudyDayWindowForKey(dateKey: string) {
  const startAt = new Date(Date.parse(`${dateKey}T${padNumber(STUDY_DAY_RESET_HOUR)}:00:00+09:00`));
  return {
    startAt,
    endAt: new Date(startAt.getTime() + STUDY_DAY_MS),
  };
}

export function getStudyBoxCarryoverExpiresAtForKey(dateKey: string) {
  const { endAt } = getStudyDayWindowForKey(dateKey);
  return new Date(endAt.getTime() + STUDY_DAY_MS + STUDY_BOX_CARRYOVER_GRACE_MINUTES * MINUTE_MS);
}

export function hasStudyBoxCarryoverExpired(dateKey: string | null | undefined, baseDate: Date = new Date()) {
  if (!dateKey) return true;
  return baseDate.getTime() >= getStudyBoxCarryoverExpiresAtForKey(dateKey).getTime();
}

export function getStudyDayContext(baseDate: Date = new Date()) {
  const nowKst = toKstDate(baseDate);
  const studyDayDate = getStudyDayDate(baseDate);
  const previousStudyDayDate = new Date(studyDayDate);
  previousStudyDayDate.setDate(previousStudyDayDate.getDate() - 1);
  const nextStudyDayDate = new Date(studyDayDate);
  nextStudyDayDate.setDate(nextStudyDayDate.getDate() + 1);
  const dateKey = toDateKey(studyDayDate);
  const previousDateKey = toDateKey(previousStudyDayDate);
  const nextDateKey = toDateKey(nextStudyDayDate);
  const window = getStudyDayWindowForKey(dateKey);

  return {
    nowKst,
    studyDayDate,
    dateKey,
    previousDateKey,
    nextDateKey,
    windowStartAt: window.startAt,
    windowEndAt: window.endAt,
  };
}

export function getTimeRangeOverlapMs(
  rangeStartMs: number,
  rangeEndMs: number,
  windowStartMs: number,
  windowEndMs: number
) {
  if (!Number.isFinite(rangeStartMs) || !Number.isFinite(rangeEndMs)) return 0;
  const overlapStart = Math.max(rangeStartMs, windowStartMs);
  const overlapEnd = Math.min(rangeEndMs, windowEndMs);
  if (overlapEnd <= overlapStart) return 0;
  return overlapEnd - overlapStart;
}

export function getCurrentStudyDayLiveSeconds(sessionStartMs: number, referenceDate: Date = new Date()) {
  if (!Number.isFinite(sessionStartMs) || sessionStartMs <= 0) return 0;
  const { windowStartAt, windowEndAt } = getStudyDayContext(referenceDate);
  const overlapMs = getTimeRangeOverlapMs(
    sessionStartMs,
    referenceDate.getTime(),
    windowStartAt.getTime(),
    windowEndAt.getTime()
  );
  return Math.max(0, Math.floor(overlapMs / 1000));
}
