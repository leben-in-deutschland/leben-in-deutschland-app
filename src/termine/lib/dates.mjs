// German dates and times as the course pages print them ("Fr. 27.11.2026",
// "27. November 2026", "Sa. 28.11.", "13:00 - 14:00 Uhr", "12.30 Uhr",
// "10 Uhr"), turned into "YYYY-MM-DD" and "HH:MM", and the exam day told
// apart from the days of registration. Exam days are calendar days in
// Germany, so "today" is always Europe/Berlin, whatever the zone of the
// machine that runs the sync.

const MONTHS = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
const MONTH_NAMES = "Januar|Februar|März|Maerz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember";
/** Sunday = 0, as `Date#getUTCDay` counts. "Sonnabend" is the Saturday of northern Germany. */
const WEEKDAYS = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6, sonntag: 0, montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonnabend: 6 };
const WEEKDAY_WORDS = "montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonnabend|sonntag|mo|di|mi|do|fr|sa|so";

/** What does not follow a year: the price of "28.11. 30,00 €", the time of "28.11. 09:00". */
const NOT_A_YEAR = "(?![\\d:]|[.,]\\d)";
/** Two digits are no year either in front of "Uhr": the hour of "28.11.10 Uhr" and of "28.11.10-12 Uhr". */
const NOT_AN_HOUR = "(?!\\s*Uhr\\b|\\s*(?:-|–|—|bis)\\s*\\d{1,2}(?:[.:]\\d\\d)?\\s*Uhr\\b)";
/**
 * "27.11.2026", "27. 11. 2026", "27.11.26", "27. November 2026" - or
 * "27.11." without a year. Two digits are a year only directly behind the
 * dot; a space may only stand in front of all four.
 */
const DATE = new RegExp(`(?<![\\d.])(\\d{1,2})\\.\\s?(?:(\\d{1,2})\\.(?:\\s?((?:19|20)\\d{2})${NOT_A_YEAR}|(\\d{2})${NOT_A_YEAR}${NOT_AN_HOUR})?|(${MONTH_NAMES})\\s+(\\d{4})(?!\\d))`, "i");
/** The weekday in front of a date: "Sa. 28.11.", "Samstag, den 28.11." - but not the "so" of "also". */
const WEEKDAY_BEFORE = new RegExp(`(?<![a-zäöüß])(${WEEKDAY_WORDS})\\.?\\s?,?\\s*(?:de[nm]\\s+)?$`, "i");

const AN_HOUR = "(?:[01]?\\d|2[0-3])";
const A_MINUTE = "(?:[0-5]\\d)";
const HOUR = `(${AN_HOUR})`;
const MINUTE = `(${A_MINUTE})`;
const UHR = "\\s*Uhr\\b";
const TO = "\\s*(?:-|–|—|bis)\\s*";
/** Not the tail of a number ("25,00"), a date or another time; a comma in front is fine (",08:30"). */
const FRESH = "(?<![\\d.:]|\\d,)";
/** Where a clock time may start; the one that comes first in the text counts. */
const TIME_STARTS = [
    // "13:00": a colon always makes a time.
    new RegExp(`${FRESH}${HOUR}:${MINUTE}(?!\\d)`, "i"),
    // "12.30 Uhr", "9.00 - 10.30 Uhr": a dot does only with "Uhr" behind the time or behind the range it opens -
    // "Raum 1.12" and the "08.01." of another date are no times.
    new RegExp(`${FRESH}${HOUR}\\.${MINUTE}(?=${UHR}|${TO}${AN_HOUR}[.:]${A_MINUTE}${UHR})`, "i"),
    // "10 Uhr", "8 - 9.30 Uhr": a bare hour needs "Uhr" as well.
    new RegExp(`${FRESH}${HOUR}(?=${UHR}|${TO}${AN_HOUR}(?:[.:]${A_MINUTE})?${UHR})`, "i"),
    // "05.02.27, 10.30": directly behind the date a dot is enough.
    new RegExp(`(?<=^[\\s,;]*(?:(?:um|ab|von)\\s+)?)${HOUR}\\.${MINUTE}(?![\\d.])`, "i"),
];
/** The end of a range behind a start: "- 14:00", "bis 10.30", "Uhr - 11 Uhr". */
const TIME_UNTIL = new RegExp(`^(?:${UHR})?${TO}(?:${HOUR}:${MINUTE}(?!\\d)|${HOUR}\\.${MINUTE}(?![\\d.])|${HOUR}(?=${UHR}))`, "i");

/** Between a registration word and its day: "Anmeldeschluss: Fr.", "Anmeldung bis einschließlich", "Anmeldeschluss ist der". */
const FILLER = `(?:[\\s:.,–-]|\\b(?:ist|war|der|den|dem|am|zum|einschließlich|einschl|spätestens|bis|${WEEKDAY_WORDS})\\b)`;
const REGISTERING = "anmeld(?:ung(?:en)?|en|bar)\\b[^.\\d]{0,24}";
/** Words in front of a date that make it the end of registration, not the exam day. */
const DEADLINE = new RegExp(`(?:anmeldeschluss|anmeldefrist|anmeldeende|meldeschluss|${REGISTERING}\\bbis|\\bbis (?:zum|spätestens))${FILLER}{0,14}$`, "i");
/** Words in front of a date that make it the start of registration. */
const OPENING = new RegExp(`(?:anmeldebeginn|anmeldestart|anmeldezeitraum|anmeldephase|${REGISTERING}\\b(?:ab|vom|von)|\\bbuchbar (?:erst )?ab)${FILLER}{0,14}$`, "i");
/** "01.11. - 08.01.": what stands between the two days of a registration period. */
const PERIOD = new RegExp(`^\\s*(?:-|–|—|bis)\\s*(?:zum\\s+)?(?:(?:${WEEKDAY_WORDS})\\.?\\s?,?\\s*)?$`, "i");
/** The second day of "03.09. - 05.09.2026". */
const SECOND_DAY = new RegExp(`^\\s*(?:-|–|—|bis)\\s*(?:(?:${WEEKDAY_WORDS})\\.?\\s?,?\\s*)?\\d{1,2}\\.\\s?(?:\\d{1,2}\\.\\s?(?:\\d{4}|\\d{2})?|(?:${MONTH_NAMES})(?:\\s+\\d{4})?)`, "i");
/** Where the text behind an exam day turns to something else: another date, or registration. */
const NEXT_TOPIC = /\d{1,2}\.\s?\d{1,2}\.|anmeld/i;
/** How far behind the day its time may stand. */
const TIME_WINDOW = 60;
/** How close a second mention of the same day must follow to count as the same statement. */
const SAME_DAY_GAP = 40;

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

function weekdayBefore(source, index) {
    const word = WEEKDAY_BEFORE.exec(source.slice(Math.max(0, index - 24), index))?.[1].toLowerCase();
    return word === undefined ? undefined : WEEKDAYS[word];
}

/**
 * The first German date in `text` at or after `from` as
 * { date: "YYYY-MM-DD", index, end }, or null. A date without a year counts
 * only when `today` ("YYYY-MM-DD") is given and a weekday stands in front of
 * it. Two digits behind the dot mean 20xx; when the weekday in front does
 * not fall on that day, the date is not readable and is skipped rather
 * than guessed. Impossible days are skipped too.
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
        const month = match[5] ? monthNumber(match[5]) : Number(match[2]);
        const weekday = weekdayBefore(source, index);
        let year;
        if (match[5]) {
            year = Number(match[6]);
        } else if (match[3]) {
            year = Number(match[3]);
        } else if (match[4]) {
            year = 2000 + Number(match[4]);
            if (weekday !== undefined && isRealDay(year, month, day) && new Date(Date.UTC(year, month - 1, day)).getUTCDay() !== weekday) {
                continue;
            }
        } else {
            year = inferYear(day, month, weekday, today);
        }
        if (year !== null && isRealDay(year, month, day)) {
            return { date: `${year}-${pad(month)}-${pad(day)}`, index, end };
        }
    }
    return null;
}

/**
 * The first clock time in `text` at or after `from` as
 * { time: "HH:MM", until: "HH:MM" | null, index, end }, or null. Pass the
 * position right behind a date as `from`: only there does "10.30" count
 * without "Uhr".
 *
 * @param {string} text
 * @param {number} [from]
 * @returns {{ time: string, until: string | null, index: number, end: number } | null}
 */
export function findTime(text, from = 0) {
    const source = String(text ?? "").slice(from);
    let start = null;
    for (const pattern of TIME_STARTS) {
        const match = pattern.exec(source);
        if (match && (start === null || match.index < start.index)) {
            start = match;
        }
    }
    if (!start) {
        return null;
    }
    const end = start.index + start[0].length;
    const tail = TIME_UNTIL.exec(source.slice(end));
    return {
        time: `${pad(start[1])}:${start[2] ?? "00"}`,
        until: tail ? `${pad(tail[1] ?? tail[3] ?? tail[5])}:${tail[2] ?? tail[4] ?? "00"}` : null,
        index: from + start.index,
        end: from + end + (tail ? tail[0].length : 0),
    };
}

/** The text behind an exam day in which its time may stand: the second day of a range aside, up to the next date or registration word. */
function timeWindow(text, from) {
    let rest = text.slice(from, from + TIME_WINDOW);
    const second = SECOND_DAY.exec(rest);
    if (second) {
        rest = rest.slice(second[0].length);
    }
    const stop = rest.search(NEXT_TOPIC);
    return stop < 0 ? rest : rest.slice(0, stop);
}

/**
 * The exam day in the text of one course: the first date that is not about
 * registration, with its time, and the registration deadline when the text
 * names one. "Anmeldeschluss: Fr. 08.01.2027" is a deadline, "Anmeldung ab
 * 25.11." and both ends of "Anmeldezeitraum: 01.11. - 08.01." are not the
 * exam either. Null when no other date is left.
 *
 * @param {string} text
 * @param {string | null} [today]
 * @returns {{ date: string, time: string | null, until: string | null, deadline: string | null } | null}
 */
export function findExamDay(text, today = null) {
    const source = String(text ?? "");
    let day = null;
    let deadline = null;
    /** Where a registration start ended, while the next date may still be the end of that period. */
    let opened = null;
    let from = 0;
    for (;;) {
        const found = findDate(source, from, today);
        if (!found) {
            break;
        }
        const before = source.slice(Math.max(0, found.index - 80), found.index);
        if (DEADLINE.test(before) || (opened !== null && PERIOD.test(source.slice(opened, found.index)))) {
            deadline ??= found.date;
            opened = null;
        } else if (OPENING.test(before)) {
            opened = found.end;
        } else {
            opened = null;
            day ??= found;
        }
        from = found.end;
    }
    if (!day) {
        return null;
    }
    let clock = findTime(timeWindow(source, day.end));
    // "Einbürgerungstest - 11.12.2026 Fr., ab 11.12.2026 um 12:30 Uhr": without a time behind the day, it may stand behind the day's next mention.
    for (let behind = day.end; !clock; ) {
        const again = findDate(source, behind, today);
        if (!again || again.date !== day.date || again.index - behind > SAME_DAY_GAP) {
            break;
        }
        behind = again.end;
        clock = findTime(timeWindow(source, behind));
    }
    return { date: day.date, time: clock?.time ?? null, until: clock?.until ?? null, deadline };
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
