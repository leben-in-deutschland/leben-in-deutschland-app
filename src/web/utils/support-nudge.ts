import type { User } from "@/types/user";
import type { AskRecord, SupportRecord } from "./support-store";

/**
 * When Home may show the one-time thank-you card for the tip jar (PLAN-012).
 *
 * Pure: the clock and storage are passed in. The card is a quiet invitation
 * after a real success, never a popup, and it unlocks nothing.
 */

export type ThanksReason = "mock" | "streak";

/** Days in a row that count as a success moment. */
export const THANKS_STREAK_DAYS = 7;
/** Waiting time after a "not now" before the card may return. */
export const THANKS_RETRY_DAYS = 30;
/** After this many "not now" answers the card never returns. */
export const THANKS_MAX_ASKS = 2;

const DAY_MS = 86_400_000;

/**
 * The success moment that justifies the card, or null. A passed mock exam
 * wins over a streak because it is the stronger "the app helped me" signal.
 */
export function thanksReason(user: User | null | undefined, streakCurrent: number): ThanksReason | null {
    if (!user) {
        return null;
    }
    if (Array.isArray(user.testProgress) && user.testProgress.some((test) => test?.passed === true && !test.cancelled)) {
        return "mock";
    }
    if (Number.isFinite(streakCurrent) && streakCurrent >= THANKS_STREAK_DAYS) {
        return "streak";
    }
    return null;
}

/**
 * False once the learner tipped, after two "not now" answers, or for 30 days
 * after the last "not now". A damaged time stamp counts as long ago.
 */
export function thanksAllowed(support: SupportRecord, ask: AskRecord, now: Date): boolean {
    if (support.tips > 0 || ask.asks >= THANKS_MAX_ASKS) {
        return false;
    }
    if (ask.asks > 0 && ask.lastAskAt) {
        const last = new Date(ask.lastAskAt).getTime();
        if (!Number.isNaN(last) && now.getTime() - last < THANKS_RETRY_DAYS * DAY_MS) {
            return false;
        }
    }
    return true;
}
