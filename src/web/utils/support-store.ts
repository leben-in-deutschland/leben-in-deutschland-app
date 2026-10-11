/**
 * How often the learner tipped (see `services/tip-jar.ts`).
 *
 * Kept under its own storage key so that the learner record ("user") is never
 * touched by the tip jar: old app versions, exports, and imports do not know
 * this key and simply ignore it. The count only changes what the settings
 * page says; it unlocks nothing.
 */

export const SUPPORT_KEY = "lid:support";

export interface SupportRecord {
    /** Number of tips that Google Play confirmed. */
    tips: number;
    /** ISO date-time of the last confirmed tip, or null. */
    lastTipAt: string | null;
}

export const EMPTY_SUPPORT: SupportRecord = { tips: 0, lastTipAt: null };

function toCount(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** The stored support record. Missing, damaged, or foreign data reads as "no tips". */
export function readSupport(): SupportRecord {
    if (typeof window === "undefined") {
        return EMPTY_SUPPORT;
    }
    let raw: string | null;
    try {
        raw = window.localStorage.getItem(SUPPORT_KEY);
    } catch {
        return EMPTY_SUPPORT;
    }
    if (!raw) {
        return EMPTY_SUPPORT;
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return EMPTY_SUPPORT;
        }
        const { tips, lastTipAt } = parsed as Record<string, unknown>;
        return { tips: toCount(tips), lastTipAt: typeof lastTipAt === "string" ? lastTipAt : null };
    } catch {
        return EMPTY_SUPPORT;
    }
}

/**
 * Adds `count` confirmed tips (anything below 1 adds nothing) and stamps the
 * time. Returns the new record; storage failures are swallowed so the thanks
 * can still be shown for this session.
 */
export function recordTips(count: number, now: Date = new Date()): SupportRecord {
    const current = readSupport();
    const added = toCount(count);
    if (added === 0) {
        return current;
    }
    const next: SupportRecord = { tips: current.tips + added, lastTipAt: now.toISOString() };
    try {
        window.localStorage.setItem(SUPPORT_KEY, JSON.stringify(next));
    } catch {
        /* storage unavailable: the count lasts for this session only */
    }
    return next;
}

/* ------------------------------------------------------------------ */
/*  The thank-you card on Home (PLAN-012)                             */
/* ------------------------------------------------------------------ */

export const ASK_KEY = "lid:support-ask";

export interface AskRecord {
    /** How often the learner answered the thank-you card with "not now". */
    asks: number;
    /** ISO date-time of the last "not now", or null. */
    lastAskAt: string | null;
}

export const NEVER_ASKED: AskRecord = { asks: 0, lastAskAt: null };

/** The stored ask record. Missing, damaged, or foreign data reads as "never asked". */
export function readAsk(): AskRecord {
    if (typeof window === "undefined") {
        return NEVER_ASKED;
    }
    let raw: string | null;
    try {
        raw = window.localStorage.getItem(ASK_KEY);
    } catch {
        return NEVER_ASKED;
    }
    if (!raw) {
        return NEVER_ASKED;
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return NEVER_ASKED;
        }
        const { asks, lastAskAt } = parsed as Record<string, unknown>;
        return { asks: toCount(asks), lastAskAt: typeof lastAskAt === "string" ? lastAskAt : null };
    } catch {
        return NEVER_ASKED;
    }
}

/** Counts one "not now" and stamps the time. Storage failures are swallowed. */
export function recordAsk(now: Date = new Date()): AskRecord {
    const current = readAsk();
    const next: AskRecord = { asks: current.asks + 1, lastAskAt: now.toISOString() };
    try {
        window.localStorage.setItem(ASK_KEY, JSON.stringify(next));
    } catch {
        /* storage unavailable: the card stays hidden for this session only */
    }
    return next;
}
