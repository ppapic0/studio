"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKoreanPublicHolidayInfoByDateKey = getKoreanPublicHolidayInfoByDateKey;
exports.isAutonomousAttendanceDateKey = isAutonomousAttendanceDateKey;
const DANGI_LUNAR_FORMATTER = typeof Intl !== "undefined"
    ? new Intl.DateTimeFormat("ko-KR-u-ca-dangi", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        timeZone: "Asia/Seoul",
    })
    : null;
const holidayCache = new Map();
const ADDITIONAL_PUBLIC_HOLIDAYS_BY_DATE_KEY = {
    "2026-06-03": { name: "제9회 전국동시지방선거일" },
};
function toCalendarDateKey(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function fromCalendarDateKey(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    if (!year || !month || !day)
        return null;
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    return Number.isFinite(date.getTime()) ? date : null;
}
function addDays(date, amount) {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + amount);
    return next;
}
function getDangiLunarParts(date) {
    var _a, _b;
    if (!DANGI_LUNAR_FORMATTER)
        return null;
    try {
        const parts = DANGI_LUNAR_FORMATTER.formatToParts(date);
        const month = Number((_a = parts.find((part) => part.type === "month")) === null || _a === void 0 ? void 0 : _a.value);
        const day = Number((_b = parts.find((part) => part.type === "day")) === null || _b === void 0 ? void 0 : _b.value);
        if (!Number.isFinite(month) || !Number.isFinite(day))
            return null;
        return { month, day };
    }
    catch (_c) {
        return null;
    }
}
function getLunarHolidayName(date) {
    const lunar = getDangiLunarParts(date);
    if (!lunar)
        return null;
    if (lunar.month === 1 && (lunar.day === 1 || lunar.day === 2))
        return "설날";
    if (lunar.month === 8 && lunar.day >= 14 && lunar.day <= 16)
        return "추석";
    if (lunar.month === 4 && lunar.day === 8)
        return "부처님오신날";
    const tomorrowLunar = getDangiLunarParts(addDays(date, 1));
    if ((tomorrowLunar === null || tomorrowLunar === void 0 ? void 0 : tomorrowLunar.month) === 1 && tomorrowLunar.day === 1)
        return "설날 연휴";
    return null;
}
function upsertHoliday(holidays, date, rule) {
    const key = toCalendarDateKey(date);
    const existing = holidays.get(key);
    holidays.set(key, Object.assign(Object.assign({}, rule), { name: existing ? `${existing.name}·${rule.name}` : rule.name }));
}
function getNextSubstituteDate(startDate, occupiedKeys) {
    let candidate = new Date(startDate);
    for (let guard = 0; guard < 14; guard += 1) {
        const key = toCalendarDateKey(candidate);
        if (candidate.getUTCDay() !== 0 && !occupiedKeys.has(key))
            return candidate;
        candidate = addDays(candidate, 1);
    }
    return candidate;
}
function addSubstituteHoliday(holidays, occupiedKeys, sourceDates, name) {
    const orderedSourceDates = sourceDates
        .slice()
        .sort((left, right) => left.getTime() - right.getTime());
    const lastSourceDate = orderedSourceDates[orderedSourceDates.length - 1];
    if (!lastSourceDate)
        return;
    const substituteDate = getNextSubstituteDate(addDays(lastSourceDate, 1), occupiedKeys);
    const key = toCalendarDateKey(substituteDate);
    occupiedKeys.add(key);
    holidays.set(key, {
        name: `${name} 대체공휴일`,
        isSubstitute: true,
    });
}
function buildKoreanPublicHolidayMap(year) {
    const holidays = new Map();
    [
        ["01-01", "신정", null],
        ["03-01", "삼일절", "single-weekend"],
        ["05-01", "근로자의 날", null],
        ["05-05", "어린이날", "single-weekend"],
        ["06-06", "현충일", null],
        ["08-15", "광복절", "single-weekend"],
        ["10-03", "개천절", "single-weekend"],
        ["10-09", "한글날", "single-weekend"],
        ["12-25", "성탄절", "single-weekend"],
    ].forEach(([monthDay, name, substituteRule]) => {
        const date = fromCalendarDateKey(`${year}-${monthDay}`);
        if (!date)
            return;
        upsertHoliday(holidays, date, {
            name: String(name),
            substituteRule: substituteRule,
        });
    });
    Object.entries(ADDITIONAL_PUBLIC_HOLIDAYS_BY_DATE_KEY)
        .filter(([dateKey]) => dateKey.startsWith(`${year}-`))
        .forEach(([dateKey, holiday]) => {
        const date = fromCalendarDateKey(dateKey);
        if (!date)
            return;
        upsertHoliday(holidays, date, holiday);
    });
    for (let month = 0; month < 12; month += 1) {
        const cursor = new Date(Date.UTC(year, month, 1, 12, 0, 0, 0));
        while (cursor.getUTCFullYear() === year && cursor.getUTCMonth() === month) {
            const lunarHolidayName = getLunarHolidayName(cursor);
            if (lunarHolidayName) {
                upsertHoliday(holidays, cursor, {
                    name: lunarHolidayName,
                    substituteRule: lunarHolidayName.includes("설날") || lunarHolidayName === "추석"
                        ? "lunar-family"
                        : "single-weekend",
                });
            }
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    }
    const occupiedKeys = new Set(holidays.keys());
    const singleSubstituteTargets = [...holidays.entries()]
        .map(([dateKey, rule]) => ({ date: fromCalendarDateKey(dateKey), rule }))
        .filter((item) => Boolean(item.date))
        .filter(({ date, rule }) => rule.substituteRule === "single-weekend" && (date.getUTCDay() === 0 || date.getUTCDay() === 6));
    singleSubstituteTargets.forEach(({ date, rule }) => {
        addSubstituteHoliday(holidays, occupiedKeys, [date], rule.name);
    });
    ["설날", "추석"].forEach((familyName) => {
        const familyDates = [...holidays.entries()]
            .filter(([, rule]) => rule.substituteRule === "lunar-family" && rule.name.includes(familyName))
            .map(([dateKey]) => fromCalendarDateKey(dateKey))
            .filter((date) => Boolean(date))
            .sort((left, right) => left.getTime() - right.getTime());
        if (familyDates.some((date) => date.getUTCDay() === 0)) {
            addSubstituteHoliday(holidays, occupiedKeys, familyDates, familyName);
        }
    });
    return new Map([...holidays.entries()].map(([dateKey, rule]) => [
        dateKey,
        Object.assign({ name: rule.name }, (rule.isSubstitute ? { isSubstitute: true } : {})),
    ]));
}
function getKoreanPublicHolidayInfoByDateKey(dateKey) {
    var _a;
    const date = dateKey ? fromCalendarDateKey(dateKey) : null;
    if (!date || !Number.isFinite(date.getTime()))
        return null;
    const year = date.getUTCFullYear();
    if (!holidayCache.has(year)) {
        holidayCache.set(year, buildKoreanPublicHolidayMap(year));
    }
    return ((_a = holidayCache.get(year)) === null || _a === void 0 ? void 0 : _a.get(dateKey || "")) || null;
}
function isAutonomousAttendanceDateKey(dateKey) {
    const date = dateKey ? fromCalendarDateKey(dateKey) : null;
    return Boolean(date && (date.getUTCDay() === 0 || getKoreanPublicHolidayInfoByDateKey(dateKey)));
}
//# sourceMappingURL=koreanPublicHolidays.js.map