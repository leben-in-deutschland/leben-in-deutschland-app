import type { TerminCentre, TerminSlot, TerminStatus, TermineData } from "@/types/termine";
import { isBookable, upcomingSlots } from "./termine-logic";
import { TERMIN_STATUSES } from "./termine-store";

/**
 * The learner's watch list for exam dates (ADR-050): the centres to keep an
 * eye on, and what the learner was last told about each of their dates, so
 * every opening is announced once. It lives under its own key on the
 * device, apart from the learner record, and is never sent anywhere.
 *
 * `detectAlerts` is pure; the storage functions below it follow
 * `notice-store.ts`.
 */

export const TERMINE_WATCH_KEY = "lid:termine-watch";

/** More than this many centres is a list, not a watch. */
export const MAX_WATCHED = 12;

export type KnownSlot = {
    status: TerminStatus;
    /** Exam day, so entries of past dates can be dropped. */
    date: string;
};

export type TermineWatch = {
    /** Ids of the watched centres, oldest first. */
    centres: string[];
    /** Last announced state of each date of a watched centre, by `slotKey`. */
    known: Record<string, KnownSlot>;
};

export const EMPTY_WATCH: TermineWatch = Object.freeze({ centres: Object.freeze([]) as unknown as string[], known: Object.freeze({}) });

/**
 * "open": a place can be booked now (a new bookable date, or a date that
 * became bookable). "new": the centre published a date whose places are not
 * known yet or whose registration has not started.
 */
export type TermineAlertKind = "open" | "new";

export type TermineAlert = {
    kind: TermineAlertKind;
    centre: TerminCentre;
    /** The earliest date the alert is about. */
    slot: TerminSlot;
    /** Further dates of the same centre with the same news. */
    more: number;
};

/** States of a newly published date that are worth a "new date" note. A full or closed one is not news. */
const NEWS_WORTHY: readonly TerminStatus[] = ["unknown", "soon", "waitlist"];

export function slotKey(centreId: string, slotId: string): string {
    return `${centreId}/${slotId}`;
}

export function isWatched(watch: TermineWatch, centreId: string): boolean {
    return watch.centres.includes(centreId);
}

function snapshot(centre: TerminCentre, today: string): Record<string, KnownSlot> {
    const known: Record<string, KnownSlot> = {};
    for (const slot of upcomingSlots(centre, today)) {
        known[slotKey(centre.id, slot.id)] = { status: slot.status, date: slot.date };
    }
    return known;
}

/**
 * Adds a centre. Its current dates count as already seen, so the learner is
 * told about what changes from now on, not about what the screen shows.
 * Returns the same list when the centre is watched already or the list is full.
 */
export function watchCentre(watch: TermineWatch, centre: TerminCentre, today: string): TermineWatch {
    if (isWatched(watch, centre.id) || watch.centres.length >= MAX_WATCHED) {
        return watch;
    }
    return { centres: [...watch.centres, centre.id], known: { ...watch.known, ...snapshot(centre, today) } };
}

export function unwatchCentre(watch: TermineWatch, centreId: string): TermineWatch {
    if (!isWatched(watch, centreId)) {
        return watch;
    }
    const prefix = `${centreId}/`;
    return {
        centres: watch.centres.filter((id) => id !== centreId),
        known: Object.fromEntries(Object.entries(watch.known).filter(([key]) => !key.startsWith(prefix))),
    };
}

function sameKnown(a: Record<string, KnownSlot>, b: Record<string, KnownSlot>): boolean {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => b[key]?.status === a[key].status && b[key]?.date === a[key].date);
}

/**
 * Compares the file with what the learner was last told and returns the
 * news - at most one alert per centre, bookable places first - together
 * with the watch list to store. The same list object comes back when there
 * is nothing to remember.
 *
 * A centre whose last read failed is skipped: its dates are not confirmed,
 * and what is known about it stays as it is. A date that disappears from
 * the file is remembered until its day has passed, so a listing that
 * flickers does not alert twice. A centre that is no longer in the file is
 * dropped from the list.
 */
export function detectAlerts(watch: TermineWatch, data: TermineData | null, today: string): { alerts: TermineAlert[]; watch: TermineWatch } {
    if (!data || watch.centres.length === 0) {
        return { alerts: [], watch };
    }
    const byId = new Map(data.centres.map((centre) => [centre.id, centre]));
    // A centre that left the file left the registry: it cannot be watched any more.
    const centres = watch.centres.filter((id) => byId.has(id));
    const known: Record<string, KnownSlot> = {};
    for (const [key, entry] of Object.entries(watch.known)) {
        if (entry.date >= today && centres.some((id) => key.startsWith(`${id}/`))) {
            known[key] = entry;
        }
    }
    const alerts: TermineAlert[] = [];
    for (const id of centres) {
        const centre = byId.get(id);
        if (!centre || !centre.ok) {
            continue;
        }
        const opened: TerminSlot[] = [];
        const published: TerminSlot[] = [];
        for (const slot of upcomingSlots(centre, today)) {
            const key = slotKey(centre.id, slot.id);
            const before = watch.known[key];
            if (isBookable(slot.status) && (!before || !isBookable(before.status))) {
                opened.push(slot);
            } else if (!before && NEWS_WORTHY.includes(slot.status)) {
                published.push(slot);
            }
            known[key] = { status: slot.status, date: slot.date };
        }
        const news = opened.length > 0 ? opened : published;
        if (news.length > 0) {
            alerts.push({ kind: opened.length > 0 ? "open" : "new", centre, slot: news[0], more: news.length - 1 });
        }
    }
    const unchanged = centres.length === watch.centres.length && sameKnown(known, watch.known);
    return { alerts, watch: unchanged ? watch : { centres, known } };
}

/* ------------------------------------------------------------------ */
/*  Storage                                                            */
/* ------------------------------------------------------------------ */

const listeners = new Set<() => void>();
let lastRaw: string | null | undefined;
let lastWatch: TermineWatch = EMPTY_WATCH;

function parseWatch(raw: string | null): TermineWatch {
    if (!raw) {
        return EMPTY_WATCH;
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) {
            return EMPTY_WATCH;
        }
        const record = parsed as Record<string, unknown>;
        const centres = Array.isArray(record.centres) ? record.centres.filter((id): id is string => typeof id === "string" && id !== "").slice(0, MAX_WATCHED) : [];
        const known: Record<string, KnownSlot> = {};
        if (typeof record.known === "object" && record.known !== null) {
            for (const [key, value] of Object.entries(record.known as Record<string, unknown>)) {
                const entry = value as Partial<KnownSlot> | null;
                if (entry && typeof entry.date === "string" && TERMIN_STATUSES.includes(entry.status as TerminStatus)) {
                    known[key] = { status: entry.status as TerminStatus, date: entry.date };
                }
            }
        }
        return centres.length === 0 ? EMPTY_WATCH : { centres: Array.from(new Set(centres)), known };
    } catch {
        return EMPTY_WATCH;
    }
}

/** The stored watch list. Same object while the stored text is unchanged, as `useSyncExternalStore` requires. */
export function readWatch(): TermineWatch {
    if (typeof window === "undefined") {
        return EMPTY_WATCH;
    }
    let raw: string | null;
    try {
        raw = window.localStorage.getItem(TERMINE_WATCH_KEY);
    } catch {
        raw = null;
    }
    if (raw !== lastRaw) {
        lastRaw = raw;
        lastWatch = parseWatch(raw);
    }
    return lastWatch;
}

export function subscribeWatch(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/**
 * Stores the watch list on this device and tells every subscriber. Returns
 * false when storage fails; then nothing changed, and nobody is told - a
 * subscriber that stores in answer would be called for ever.
 */
export function writeWatch(watch: TermineWatch): boolean {
    try {
        if (watch.centres.length === 0) {
            window.localStorage.removeItem(TERMINE_WATCH_KEY);
        } else {
            window.localStorage.setItem(TERMINE_WATCH_KEY, JSON.stringify(watch));
        }
    } catch {
        return false;
    }
    lastRaw = undefined;
    listeners.forEach((listener) => listener());
    return true;
}
