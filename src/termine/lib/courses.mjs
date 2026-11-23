// From the courses a page lists to the exam dates the app shows: only the
// test itself (no preparation course), only days that are still ahead, in a
// stable order and a stable shape.
import { isClock, isDay } from "./dates.mjs";
import { BOOKINGS, STATUSES, titleVerdict } from "./status.mjs";

const EXAM =
    /einb(ü|ue)rgerungstest|test\W{0,3}einb(ü|ue)rgerung|(test|pr(ü|ue)fung)\W{0,6}leben in deutschland|leben[- ]in[- ]deutschland[- ]?test|\blid\b[- ]?test|test\W{0,3}lid\b/i;
/**
 * A course about the test is not the test, the test that ends an integration
 * or orientation course ("oK") is for its participants only, and an
 * appointment to register ("Anmeldung: Einbürgerungstest und …", "Termin
 * Anmeldung zum …") is not an exam day. "Einbürgerungstest - Anmeldung nur
 * persönlich" stays an exam: there the registration is a remark, not the
 * subject.
 */
const NOT_EXAM =
    /vorbereit|training|übung|uebung|kurs(es)?\b|\(o\.?\s?k\.?\)|\binfo|beratung|sprechstunde|vortrag|workshop|\blernen\b|lerngruppe|fragestunde|anmeldung (zum|zur|für)|^\W*(termin\s+)?anmeld(ung|etermin|etag)/i;

/**
 * What an adapter reads from one block of a course page.
 * @typedef {{ id: string, url: string, title: string, date: string, time: string | null, until: string | null, deadline: string | null, status: string, statusText: string, booking: string | null, place: string }} Course
 *
 * One exam date as the app receives it; optional fields are left out when the page does not name them.
 * @typedef {{ id: string, date: string, time?: string, until?: string, status: string, booking?: string, title: string, place?: string, deadline?: string, url: string }} Slot
 */

export const MAX_SLOTS = 40;
const MAX_TITLE = 90;
const MAX_PLACE = 70;

/** True for the citizenship test itself ("Einbürgerungstest", "Test Leben in Deutschland"). */
export function isExamTitle(title) {
    const text = String(title ?? "");
    return EXAM.test(text) && !NOT_EXAM.test(text);
}

function clip(text, limit) {
    const value = String(text ?? "").trim();
    return value.length <= limit ? value : `${value.slice(0, limit - 1).trimEnd()}…`;
}

/** Slots in the order the app lists them: by day, then time, then number. */
export function compareSlots(a, b) {
    return a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.id.localeCompare(b.id);
}

/**
 * The exam dates among `courses` from `today` on. A course without a
 * readable day, with an unknown status word or without a link is dropped
 * rather than repaired.
 *
 * @param {Partial<Course>[]} courses
 * @param {{ today?: string, limit?: number }} [options]
 * @returns {Slot[]}
 */
export function toSlots(courses, { today, limit = MAX_SLOTS } = {}) {
    const slots = [];
    const seen = new Set();
    for (const course of courses ?? []) {
        if (!course || !isExamTitle(course.title) || !isDay(course.date) || (today && course.date < today)) {
            continue;
        }
        if (!STATUSES.includes(course.status) || typeof course.url !== "string" || !/^https?:\/\//.test(course.url)) {
            continue;
        }
        const id = String(course.id ?? "").trim() || `${course.date}T${course.time ?? ""}`;
        if (seen.has(id)) {
            continue;
        }
        seen.add(id);
        // Built in the order the file lists the fields.
        const slot = { id, date: course.date };
        if (isClock(course.time)) {
            slot.time = course.time;
            if (isClock(course.until)) {
                slot.until = course.until;
            }
        }
        // What a title says about places can close a date, never open one: "Einbürgerungstest - AUSGEBUCHT".
        const titled = titleVerdict(course.title);
        slot.status = course.status !== "closed" && titled ? titled : course.status;
        if (BOOKINGS.includes(course.booking)) {
            slot.booking = course.booking;
        }
        slot.title = clip(course.title, MAX_TITLE);
        // Some pages print "—" where no place is set: a place needs a letter or a digit.
        if (/[\p{L}\p{N}]/u.test(String(course.place ?? ""))) {
            slot.place = clip(course.place, MAX_PLACE);
        }
        if (isDay(course.deadline) && course.deadline <= course.date) {
            slot.deadline = course.deadline;
        }
        slot.url = course.url;
        slots.push(slot);
    }
    return slots.sort(compareSlots).slice(0, limit);
}
