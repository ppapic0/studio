export type KoreanPublicHolidayInfo = {
  name: string;
  isSubstitute?: boolean;
};

type HolidayRule = KoreanPublicHolidayInfo & {
  substituteRule?: 'single-weekend' | 'lunar-family';
};

const DANGI_LUNAR_FORMATTER =
  typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat('ko-KR-u-ca-dangi', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        timeZone: 'Asia/Seoul',
      })
    : null;

const holidayCache = new Map<number, Map<string, KoreanPublicHolidayInfo>>();

const ADDITIONAL_PUBLIC_HOLIDAYS_BY_DATE_KEY: Record<string, KoreanPublicHolidayInfo> = {
  '2026-06-03': { name: '제9회 전국동시지방선거일' },
};

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isFinite(date.getTime()) ? date : null;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function getDangiLunarParts(date: Date) {
  if (!DANGI_LUNAR_FORMATTER) return null;

  try {
    const parts = DANGI_LUNAR_FORMATTER.formatToParts(date);
    const month = Number(parts.find((part) => part.type === 'month')?.value);
    const day = Number(parts.find((part) => part.type === 'day')?.value);
    if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
    return { month, day };
  } catch {
    return null;
  }
}

function getLunarHolidayName(date: Date) {
  const lunar = getDangiLunarParts(date);
  if (!lunar) return null;

  if (lunar.month === 1 && (lunar.day === 1 || lunar.day === 2)) return '설날';
  if (lunar.month === 8 && lunar.day >= 14 && lunar.day <= 16) return '추석';
  if (lunar.month === 4 && lunar.day === 8) return '부처님오신날';

  const tomorrowLunar = getDangiLunarParts(addDays(date, 1));
  if (tomorrowLunar?.month === 1 && tomorrowLunar.day === 1) return '설날 연휴';

  return null;
}

function upsertHoliday(holidays: Map<string, HolidayRule>, date: Date, rule: HolidayRule) {
  const key = toLocalDateKey(date);
  const existing = holidays.get(key);
  holidays.set(key, {
    ...rule,
    name: existing ? `${existing.name}·${rule.name}` : rule.name,
  });
}

function getNextSubstituteDate(startDate: Date, occupiedKeys: Set<string>) {
  let candidate = new Date(startDate);
  for (let guard = 0; guard < 14; guard += 1) {
    const key = toLocalDateKey(candidate);
    if (candidate.getDay() !== 0 && !occupiedKeys.has(key)) return candidate;
    candidate = addDays(candidate, 1);
  }
  return candidate;
}

function addSubstituteHoliday(
  holidays: Map<string, HolidayRule>,
  occupiedKeys: Set<string>,
  sourceDates: Date[],
  name: string
) {
  const lastSourceDate = sourceDates
    .slice()
    .sort((left, right) => left.getTime() - right.getTime())
    .at(-1);
  if (!lastSourceDate) return;

  const substituteDate = getNextSubstituteDate(addDays(lastSourceDate, 1), occupiedKeys);
  const key = toLocalDateKey(substituteDate);
  occupiedKeys.add(key);
  holidays.set(key, {
    name: `${name} 대체공휴일`,
    isSubstitute: true,
  });
}

function buildKoreanPublicHolidayMap(year: number) {
  const holidays = new Map<string, HolidayRule>();

  [
    ['01-01', '신정', null],
    ['03-01', '삼일절', 'single-weekend'],
    ['05-01', '근로자의 날', null],
    ['05-05', '어린이날', 'single-weekend'],
    ['06-06', '현충일', null],
    ['08-15', '광복절', 'single-weekend'],
    ['10-03', '개천절', 'single-weekend'],
    ['10-09', '한글날', 'single-weekend'],
    ['12-25', '성탄절', 'single-weekend'],
  ].forEach(([monthDay, name, substituteRule]) => {
    const date = fromLocalDateKey(`${year}-${monthDay}`);
    if (!date) return;
    upsertHoliday(holidays, date, {
      name: String(name),
      substituteRule: substituteRule as HolidayRule['substituteRule'],
    });
  });

  Object.entries(ADDITIONAL_PUBLIC_HOLIDAYS_BY_DATE_KEY)
    .filter(([dateKey]) => dateKey.startsWith(`${year}-`))
    .forEach(([dateKey, holiday]) => {
      const date = fromLocalDateKey(dateKey);
      if (!date) return;
      upsertHoliday(holidays, date, holiday);
    });

  for (let month = 0; month < 12; month += 1) {
    const cursor = new Date(year, month, 1);
    while (cursor.getFullYear() === year && cursor.getMonth() === month) {
      const lunarHolidayName = getLunarHolidayName(cursor);
      if (lunarHolidayName) {
        upsertHoliday(holidays, cursor, {
          name: lunarHolidayName,
          substituteRule:
            lunarHolidayName.includes('설날') || lunarHolidayName === '추석'
              ? 'lunar-family'
              : 'single-weekend',
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const occupiedKeys = new Set(holidays.keys());
  const singleSubstituteTargets = [...holidays.entries()]
    .map(([dateKey, rule]) => ({ date: fromLocalDateKey(dateKey), rule }))
    .filter((item): item is { date: Date; rule: HolidayRule } => Boolean(item.date))
    .filter(({ date, rule }) => rule.substituteRule === 'single-weekend' && (date.getDay() === 0 || date.getDay() === 6));

  singleSubstituteTargets.forEach(({ date, rule }) => {
    addSubstituteHoliday(holidays, occupiedKeys, [date], rule.name);
  });

  ['설날', '추석'].forEach((familyName) => {
    const familyDates = [...holidays.entries()]
      .filter(([, rule]) => rule.substituteRule === 'lunar-family' && rule.name.includes(familyName))
      .map(([dateKey]) => fromLocalDateKey(dateKey))
      .filter((date): date is Date => Boolean(date))
      .sort((left, right) => left.getTime() - right.getTime());
    if (familyDates.some((date) => date.getDay() === 0)) {
      addSubstituteHoliday(holidays, occupiedKeys, familyDates, familyName);
    }
  });

  return new Map(
    [...holidays.entries()].map(([dateKey, rule]) => [
      dateKey,
      {
        name: rule.name,
        ...(rule.isSubstitute ? { isSubstitute: true } : {}),
      },
    ])
  );
}

export function getKoreanPublicHolidayInfo(date?: Date | null): KoreanPublicHolidayInfo | null {
  if (!date || !Number.isFinite(date.getTime())) return null;
  const year = date.getFullYear();
  const dateKey = toLocalDateKey(date);

  if (!holidayCache.has(year)) {
    holidayCache.set(year, buildKoreanPublicHolidayMap(year));
  }

  return holidayCache.get(year)?.get(dateKey) || null;
}

export function getKoreanPublicHolidayInfoByDateKey(dateKey?: string | null) {
  const date = dateKey ? fromLocalDateKey(dateKey) : null;
  return getKoreanPublicHolidayInfo(date);
}

export function isKoreanPublicHoliday(date?: Date | null) {
  return Boolean(getKoreanPublicHolidayInfo(date));
}

export function isAutonomousAttendanceDate(date?: Date | null) {
  return Boolean(date && (date.getDay() === 0 || isKoreanPublicHoliday(date)));
}

export function isAutonomousAttendanceDateKey(dateKey?: string | null) {
  const date = dateKey ? fromLocalDateKey(dateKey) : null;
  return isAutonomousAttendanceDate(date);
}

export function getAutonomousAttendanceDayName(date?: Date | null) {
  if (!date) return '자율등원일';
  const holidayInfo = getKoreanPublicHolidayInfo(date);
  if (holidayInfo) return holidayInfo.name;
  if (date.getDay() === 0) return '일요일';
  return '자율등원일';
}

export function getAutonomousAttendanceDayNotice(date?: Date | null) {
  const dayName = getAutonomousAttendanceDayName(date);
  return `${dayName} 자율등원입니다. 자율로 등원하세요 !`;
}
