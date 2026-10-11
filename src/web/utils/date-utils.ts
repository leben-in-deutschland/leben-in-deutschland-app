/**
 * Calendar-day helpers.
 *
 * All learner activity is grouped by local calendar day, written as a
 * "YYYY-MM-DD" day key. Day math goes through Date.UTC so that daylight-saving
 * changes never add or lose a day.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function pad(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
}

/** Local calendar day of a date-like value as "YYYY-MM-DD". */
export function dayKey(value: Date | string | number = new Date()): string {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of a "YYYY-MM-DD" day key. */
export function parseDayKey(key: string): Date {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
}

/** True when the value is a valid "YYYY-MM-DD" day key. */
export function isDayKey(value: unknown): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const date = parseDayKey(value);
    return dayKey(date) === value;
}

function utcDayNumber(key: string): number {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

/** Day key `amount` calendar days after `key` (negative goes back). */
export function addDays(key: string, amount: number): string {
    const date = parseDayKey(key);
    date.setDate(date.getDate() + amount);
    return dayKey(date);
}

/** Whole calendar days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
    return Math.round(utcDayNumber(to) - utcDayNumber(from));
}

/** Weekday of a day key: 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(key: string): number {
    return parseDayKey(key).getDay();
}

/** Monday of the week that contains `key`. */
export function startOfWeek(key: string): string {
    const weekday = weekdayOf(key);
    const offset = weekday === 0 ? -6 : 1 - weekday;
    return addDays(key, offset);
}

/** Day keys from `from` to `to`, both included. Empty when `to` is before `from`. */
export function dayRange(from: string, to: string): string[] {
    const total = daysBetween(from, to);
    const days: string[] = [];
    for (let i = 0; i <= total; i++) {
        days.push(addDays(from, i));
    }
    return days;
}

/**
 * ISO-8601 week key such as "2026-W41". Weeks start on Monday and belong to
 * the year that contains their Thursday.
 */
export function isoWeekKey(key: string): string {
    const thursday = addDays(startOfWeek(key), 3);
    const year = Number(thursday.slice(0, 4));
    const firstThursday = addDays(startOfWeek(`${year}-01-04`), 3);
    const week = Math.floor(daysBetween(firstThursday, thursday) / 7) + 1;
    return `${year}-W${pad(week)}`;
}

/** Date at `time` ("HH:MM") on the local day `key`. */
export function atTime(key: string, time: string): Date {
    const date = parseDayKey(key);
    const [hours, minutes] = parseTime(time);
    date.setHours(hours, minutes, 0, 0);
    return date;
}

/** Hours and minutes of an "HH:MM" string. Invalid input falls back to 18:00. */
export function parseTime(time: string): [number, number] {
    const match = /^(\d{1,2}):(\d{2})$/.exec(time ?? "");
    if (!match) {
        return [18, 0];
    }
    const hours = Math.min(23, Math.max(0, Number(match[1])));
    const minutes = Math.min(59, Math.max(0, Number(match[2])));
    return [hours, minutes];
}

/** Parses the BAMF date format "DD.MM.YYYY" into local midnight. */
export function parseGermanDate(value: string): Date {
    const [day, month, year] = value.split(".").map(Number);
    return new Date(year, month - 1, day);
}
