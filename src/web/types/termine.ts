/**
 * Exam dates as `src/termine/sync.mjs` publishes them (ADR-050): one entry
 * per exam centre whose own course page lists its test dates.
 */

/**
 * What the centre's page says about booking. "unknown" is the usual case:
 * the page shows the date, but registration is in person and the page does
 * not say whether a place is left.
 */
export type TerminStatus = "free" | "few" | "waitlist" | "full" | "soon" | "closed" | "unknown";

/** How a place is booked, when the page says so. */
export type TerminBooking = "online" | "inperson" | "phone" | "written";

export interface TerminSlot {
    /** The centre's own course number; stable while the date is listed. */
    id: string;
    /** Exam day, "YYYY-MM-DD". */
    date: string;
    /** Start, "HH:MM". */
    time?: string;
    until?: string;
    status: TerminStatus;
    booking?: TerminBooking;
    /** The centre's title of the date, e.g. "Einbürgerungstest 7-26". */
    title: string;
    place?: string;
    /** Last day to register, "YYYY-MM-DD", when the page names it. */
    deadline?: string;
    /** The date on the centre's website. */
    url: string;
}

export interface TerminCentre {
    id: string;
    /** Upper-case state code, e.g. "BY". */
    state: string;
    city: string;
    name: string;
    plz?: string;
    /** Other towns the same centre serves (a district's Volkshochschule). */
    towns?: string[];
    /** The page of the centre that lists the dates. */
    url: string;
    /** ISO time of the last successful read; null when the centre never answered. */
    checkedAt: string | null;
    /** False when the latest read failed: `slots` are then from `checkedAt`. */
    ok: boolean;
    slots: TerminSlot[];
}

export interface TermineData {
    version: 1;
    /** ISO time of the run that wrote the file. */
    generatedAt: string;
    centres: TerminCentre[];
}

/**
 * A centre as the registry of the dates sync names it
 * (`src/termine/sources.json`): enough to list it before its dates arrive,
 * or when they cannot be loaded. The registry holds no date.
 */
export type RegistryCentre = Pick<TerminCentre, "id" | "state" | "city" | "name" | "plz" | "towns" | "url">;
