import type { TerminBooking, TerminCentre, TerminSlot, TerminStatus, TermineData } from "@/types/termine";
import { isDayKey } from "@/utils/date-utils";
import { createRemoteStore } from "@/utils/remote-cache";

/** Where the downloaded exam dates live. Separate from the learner record, so old versions simply ignore it. */
export const TERMINE_KEY = "lid:termine";

/** The file changes a few times a day: ask again after an hour. */
export const TERMINE_MAX_AGE_MS = 60 * 60 * 1000;

/** After a failed download, wait this long before trying again. */
export const TERMINE_RETRY_MS = 5 * 60 * 1000;

export const TERMINE_VERSION = 1;

export const TERMIN_STATUSES: readonly TerminStatus[] = ["free", "few", "waitlist", "full", "soon", "closed", "unknown"];
const BOOKINGS: readonly TerminBooking[] = ["online", "inperson", "phone", "written"];
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
    return typeof value === "string" && value.trim() !== "";
}

function isWebAddress(value: unknown): value is string {
    return typeof value === "string" && /^https?:\/\/\S+$/.test(value);
}

function isoOrNull(value: unknown): string | null {
    return typeof value === "string" && !Number.isNaN(new Date(value).getTime()) ? value : null;
}

/** True for the file `src/termine/sync.mjs` writes: this version, a time and a list of centres. */
export function isTermineData(value: unknown): value is TermineData {
    return isRecord(value) && value.version === TERMINE_VERSION && isoOrNull(value.generatedAt) !== null && Array.isArray(value.centres);
}

function toSlot(value: unknown): TerminSlot | null {
    if (!isRecord(value) || !isText(value.id) || !isDayKey(value.date) || !isText(value.title) || !isWebAddress(value.url)) {
        return null;
    }
    const slot: TerminSlot = {
        id: value.id,
        date: value.date,
        // A state this version does not know is shown as "ask the centre", never as bookable.
        status: TERMIN_STATUSES.includes(value.status as TerminStatus) ? (value.status as TerminStatus) : "unknown",
        title: value.title,
        url: value.url,
    };
    if (typeof value.time === "string" && CLOCK.test(value.time)) {
        slot.time = value.time;
        if (typeof value.until === "string" && CLOCK.test(value.until)) {
            slot.until = value.until;
        }
    }
    if (BOOKINGS.includes(value.booking as TerminBooking)) {
        slot.booking = value.booking as TerminBooking;
    }
    if (isText(value.place)) {
        slot.place = value.place;
    }
    if (isDayKey(value.deadline)) {
        slot.deadline = value.deadline;
    }
    return slot;
}

function toCentre(value: unknown): TerminCentre | null {
    if (!isRecord(value) || !isText(value.id) || !isText(value.state) || !isText(value.city) || !isText(value.name) || !isWebAddress(value.url)) {
        return null;
    }
    const centre: TerminCentre = {
        id: value.id,
        state: value.state.toUpperCase(),
        city: value.city,
        name: value.name,
        url: value.url,
        checkedAt: isoOrNull(value.checkedAt),
        ok: value.ok === true,
        slots: Array.isArray(value.slots) ? value.slots.map(toSlot).filter((slot): slot is TerminSlot => slot !== null) : [],
    };
    if (isText(value.plz)) {
        centre.plz = value.plz;
    }
    if (Array.isArray(value.towns)) {
        centre.towns = value.towns.filter(isText);
    }
    return centre;
}

/**
 * Keeps what this version can show: an entry that is not a centre or a date
 * is dropped instead of failing the whole file, and a booking state from a
 * newer file becomes "unknown".
 */
export function sanitizeTermine(data: TermineData): TermineData {
    return {
        version: TERMINE_VERSION,
        generatedAt: data.generatedAt,
        centres: data.centres.map(toCentre).filter((centre): centre is TerminCentre => centre !== null),
    };
}

/** The shared cache behind the exam-dates screen and the alerts. */
export const termineStore = createRemoteStore<TermineData>({
    key: TERMINE_KEY,
    isValid: isTermineData,
    maxAgeMs: TERMINE_MAX_AGE_MS,
    retryMs: TERMINE_RETRY_MS,
});
