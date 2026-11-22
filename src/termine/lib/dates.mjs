// German dates and times as the course pages print them ("Fr. 27.11.2026",
// "27. November 2026", "Sa. 28.11.", "13:00 - 14:00 Uhr", "12.30 Uhr"),
// turned into "YYYY-MM-DD" and "HH:MM". Exam days are calendar days in
// Germany, so "today" is always Europe/Berlin, whatever the zone of the
// machine that runs the sync.

const MONTHS = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
const MONTH_NAMES = "Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember";
/** Sunday = 0, as `Date#getUTCDay` counts. */
const WEEKDAYS = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };

/** A year that is not the hour of a time: the "09" of "28.11. 09:00" is no year. */
const YEAR = "(\\d{4}|\\d{2})(?![\\d:]|\\.\\d)";
/** "27.11.2026", "27.11.26", "27. 11. 2026", "27. November 2026" - or "27.11." without a year. */
const DATE = new RegExp(`(?<![\\d.])(\\d{1,2})\\.\\s?(?:(\\d{1,2})\\.(?:\\s?${YEAR})?|(${MONTH_NAMES})\\s+(\\d{4})(?!\\d))`, "i");
const WEEKDAY_BEFORE = /(mo|di|mi|do|fr|sa|so)(?:ntag|enstag|ttwoch|nnerstag|eitag|mstag|nnabend)?\.?,?\s*$/i;

/** A minute count that is not the middle of a date: "12.30" but not the "05.09" of "05.09.2026". */
const MINUTES = "([0-5]\\d)(?!\\d|\\.\\d)";
const TIME = new RegExp(`(?<![\\d.:])([01]?\\d|2[0-3])[:.]${MINUTES}(?:\\s*(?:Uhr)?\\s*(?:-|–|—|bis)\\s*([01]?\\d|2[0-3])[:.]${MINUTES})?`);

function pad(value) {
    return String(value).padStart(2, "0");
}

/** True for a real calendar day (no 31.02.). */
function isRealDay(year, month, day) {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function monthNumber(name) {
    const index = MONTHS.indexOf(name.toLowerCase().replace("maerz", "märz"));
    return index < 0 ? Number.NaN : index + 1;
}

function dayNumber(day) {
    const [year, month, date] = day.split("-").map(Number);
    return Date.UTC(year, month - 1, date) / 86_400_000;
}

/**
 * The year of a date printed without one ("Sa. 28.11."): the year around
 * `today` in which that day falls on the printed weekday. Without a weekday,
 * or when no nearby year fits, there is no answer - a guess could turn a
 * finished exam into an upcoming one.
 */
function inferYear(day, month, weekday, today) {
    if (weekday === undefined || !today) {
        return null;
    }
    const thisYear = Number(today.slice(0, 4));
    let best = null;
    for (const year of [thisYear - 1, thisYear, thisYear + 1]) {
        if (!isRealDay(year, month, day) || new Date(Date.UTC(year, month - 1, day)).getUTCDay() !== weekday) {
            continue;
        }
        const distance = Math.abs(dayNumber(`${year}-${pad(month)}-${pad(day)}`) - dayNumber(today));
        if (best === null || distance < best.distance) {
            best = { year, distance };
        }
    }
    return best?.year ?? null;
}

/**
 * The first German date in `text` at or after `from` as
 * { date: "YYYY-MM-DD", index, end }, or null. Two-digit years mean 20xx.
 * A date without a year counts only when `today` ("YYYY-MM-DD") is given
 * and a weekday stands in front of it. Impossible days are skipped.
 *
 * @param {string} text
 * @param {number} [from]
 * @param {string | null} [today]
 * @returns {{ date: string, index: number, end: number } | null}
 */
export function findDate(text, from = 0, today = null) {
    const source = String(text ?? "");
    let offset = from;
    while (offset < source.length) {
        const match = DATE.exec(source.slice(offset));
        if (!match) {
            return null;
        }
        const index = offset + match.index;
        const end = index + match[0].length;
        offset = end;
        const day = Number(match[1]);
        const month = match[4] ? monthNumber(match[4]) : Number(match[2]);
        const yearText = match[4] ? match[5] : match[3];
        let year;
        if (yearText) {
            year = yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText);
        } else {
            const weekday = WEEKDAY_BEFORE.exec(source.slice(Math.max(0, index - 14), index))?.[1].toLowerCase();
            year = inferYear(day, month, weekday === undefined ? undefined : WEEKDAYS[weekday], today);
        }
        if (year !== null && isRealDay(year, month, day)) {
            return { date: `${year}-${pad(month)}-${pad(day)}`, index, end };
        }
    }
    return null;
}

/**
 * The first clock time in `text` at or after `from` as
 * { time: "HH:MM", until: "HH:MM" | null, index, end }, or null.
 * "12.30 Uhr" counts as a time; the "05.09" of a second date does not.
 *
 * @param {string} text
 * @param {number} [from]
 * @returns {{ time: string, until: string | null, index: number, end: number } | null}
 */
export function findTime(text, from = 0) {
    const match = TIME.exec(String(text ?? "").slice(from));
    if (!match) {
        return null;
    }
    return {
        time: `${pad(match[1])}:${match[2]}`,
        until: match[3] ? `${pad(match[3])}:${match[4]}` : null,
        index: from + match.index,
        end: from + match.index + match[0].length,
    };
}

/** "YYYY-MM-DD" of `now` on a wall clock in Germany. */
export function berlinDay(now = new Date()) {
    const parts = {};
    for (const { type, value } of new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now)) {
        parts[type] = value;
    }
    return `${parts.year}-${parts.month}-${parts.day}`;
}

/** True for "YYYY-MM-DD" naming a real day. */
export function isDay(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
    return Boolean(match) && isRealDay(Number(match[1]), Number(match[2]), Number(match[3]));
}

/** True for "HH:MM" on a 24-hour clock. */
export function isClock(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? ""));
}

/** `day` ("YYYY-MM-DD") moved by a number of calendar days. */
export function addDays(day, count) {
    const [year, month, date] = day.split("-").map(Number);
    const moved = new Date(Date.UTC(year, month - 1, date + count));
    return `${moved.getUTCFullYear()}-${pad(moved.getUTCMonth() + 1)}-${pad(moved.getUTCDate())}`;
}
