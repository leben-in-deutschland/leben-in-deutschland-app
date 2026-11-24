import type { RegistryCentre, TerminCentre, TerminSlot, TerminStatus, TermineData } from "@/types/termine";

/**
 * Lists and summaries for the exam-dates screen. Pure: callers pass "today"
 * ("YYYY-MM-DD") and "now".
 */

/** States in which a learner can get a place now. */
export const BOOKABLE: readonly TerminStatus[] = ["free", "few"];

/** A centre's dates at a glance: its best booking state, or "none" without an upcoming date. */
export type CentreSummary = TerminStatus | "none";

/** Best first: a free place counts more than a waiting list, an unclear date more than a full one. */
const RANK: readonly CentreSummary[] = ["free", "few", "waitlist", "soon", "unknown", "full", "closed", "none"];

/** A read older than this is shown as "not confirmed". */
export const STALE_AFTER_MS = 36 * 60 * 60 * 1000;

export function isBookable(status: TerminStatus): boolean {
    return BOOKABLE.includes(status);
}

/** The centre's dates from `today` on, earliest first. */
export function upcomingSlots(centre: TerminCentre, today: string): TerminSlot[] {
    return centre.slots
        .filter((slot) => slot.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "") || a.id.localeCompare(b.id));
}

/**
 * The dates a card shows at once and the ones behind "more dates": the
 * earliest `count`, except that a card which says "places free" shows the
 * earliest bookable date too - in place of the last one when it comes later.
 * Both lists stay in order of day and time.
 */
export function splitSlots(slots: TerminSlot[], count: number): { shown: TerminSlot[]; more: TerminSlot[] } {
    const shown = slots.slice(0, count);
    const bookable = slots.find((slot) => isBookable(slot.status));
    if (bookable && count > 0 && !shown.some((slot) => isBookable(slot.status))) {
        shown[shown.length - 1] = bookable;
    }
    return { shown, more: slots.filter((slot) => !shown.includes(slot)) };
}

export function centreSummary(centre: TerminCentre, today: string): CentreSummary {
    let best: CentreSummary = "none";
    for (const slot of upcomingSlots(centre, today)) {
        if (RANK.indexOf(slot.status) < RANK.indexOf(best)) {
            best = slot.status;
        }
    }
    return best;
}

/** What the search reads of a centre; a registry entry has no dates. */
type Searchable = Pick<TerminCentre, "city" | "name" | "plz" | "towns"> & Partial<Pick<TerminCentre, "slots">>;

/** Every town a centre is found under. */
export function townsOf(centre: Pick<Searchable, "city" | "towns">): string[] {
    return Array.from(new Set([centre.city, ...(centre.towns ?? [])]));
}

function fold(text: string): string {
    return text
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss");
}

/** True when town, postcode, name or a date's place contains the search text ("muenchen" finds "München"). */
export function matchesQuery(centre: Searchable, query: string): boolean {
    const needle = fold(query.trim());
    if (!needle) {
        return true;
    }
    const haystack = [...townsOf(centre), centre.name, centre.plz ?? "", ...(centre.slots ?? []).map((slot) => slot.place ?? "")].join(" ");
    return fold(haystack).includes(needle);
}

export type CentreFilter = {
    /** Upper-case state code, or "" for every state. */
    state: string;
    query: string;
    /** Only centres with a place that can be booked now. */
    bookableOnly: boolean;
};

/** The centres to list: filtered, the best booking state first, then the earliest date, then by town. */
export function listCentres(data: TermineData | null, filter: CentreFilter, today: string): TerminCentre[] {
    if (!data) {
        return [];
    }
    const state = filter.state.toUpperCase();
    return data.centres
        .filter((centre) => (!state || centre.state === state) && matchesQuery(centre, filter.query))
        .map((centre) => ({ centre, summary: centreSummary(centre, today), next: upcomingSlots(centre, today)[0]?.date ?? "9999" }))
        .filter(({ summary }) => !filter.bookableOnly || (summary !== "none" && isBookable(summary)))
        .sort((a, b) => RANK.indexOf(a.summary) - RANK.indexOf(b.summary) || a.next.localeCompare(b.next) || a.centre.city.localeCompare(b.centre.city, "de"))
        .map(({ centre }) => centre);
}

export type TermineCounts = {
    centres: number;
    /** Centres with at least one upcoming date. */
    withDates: number;
    /** Centres with a place that can be booked now. */
    bookable: number;
};

export function countCentres(centres: TerminCentre[], today: string): TermineCounts {
    const summaries = centres.map((centre) => centreSummary(centre, today));
    return {
        centres: centres.length,
        withDates: summaries.filter((summary) => summary !== "none").length,
        bookable: summaries.filter((summary) => summary !== "none" && isBookable(summary)).length,
    };
}

/**
 * The centres the sync reads, for the time the page has no dates: one state
 * ("" = every state) and the search text, by town.
 */
export function listRegistry(registry: RegistryCentre[], filter: Pick<CentreFilter, "state" | "query">): RegistryCentre[] {
    const state = filter.state.toUpperCase();
    return registry
        .filter((centre) => (!state || centre.state === state) && matchesQuery(centre, filter.query))
        .sort((a, b) => a.city.localeCompare(b.city, "de") || a.name.localeCompare(b.name, "de"));
}

/** A state in the registry: how many centres the sync reads there, and in which towns. */
export type StateTowns = { code: string; name: string; centres: number; towns: string[] };

/** The registry by state, in the order of `states`; a state without a centre is left out. */
export function registryByState(registry: RegistryCentre[], states: { code: string; name: string }[]): StateTowns[] {
    return states
        .map((state) => {
            const code = state.code.toUpperCase();
            const centres = registry.filter((centre) => centre.state === code);
            const towns = Array.from(new Set(centres.flatMap(townsOf))).sort((a, b) => a.localeCompare(b, "de"));
            return { code, name: state.name, centres: centres.length, towns };
        })
        .filter((state) => state.centres > 0);
}

/** State codes that have at least one centre in the file. */
export function statesWithCentres(data: TermineData | null): Set<string> {
    return new Set((data?.centres ?? []).map((centre) => centre.state));
}

/** True when the centre's dates are not confirmed: the last read failed or is older than a day and a half. */
export function isUnconfirmed(centre: TerminCentre, now: Date): boolean {
    if (!centre.ok || !centre.checkedAt) {
        return true;
    }
    return now.getTime() - new Date(centre.checkedAt).getTime() > STALE_AFTER_MS;
}
