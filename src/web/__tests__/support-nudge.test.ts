/*
 * The rules behind the one-time thank-you card on Home (PLAN-012): which
 * success moment justifies it, when "not now" and a tip silence it, and how
 * the ask record survives damaged storage.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { MockTestProgress, User } from "@/types/user";
import { THANKS_MAX_ASKS, THANKS_RETRY_DAYS, THANKS_STREAK_DAYS, thanksAllowed, thanksReason } from "@/utils/support-nudge";
import { ASK_KEY, EMPTY_SUPPORT, NEVER_ASKED, readAsk, recordAsk } from "@/utils/support-store";
import { createNewUser } from "@/utils/user-defaults";

const BERLIN = { code: "BE", name: "Berlin" } as const;

function user(tests: MockTestProgress[] = []): User {
    return { ...createNewUser({ state: BERLIN as never, language: "de" }, new Date("2026-10-01T08:00:00Z")), testProgress: tests };
}

function mock(passed: boolean, cancelled = false): MockTestProgress {
    return { datetime: "2026-10-10T10:00:00.000Z", timeTake: "00:10:00", passed, cancelled, questions: [] };
}

const NOW = new Date("2026-10-11T09:00:00.000Z");

function daysAgo(days: number): string {
    return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

describe("thanksReason", () => {
    it("needs a learner record", () => {
        expect(thanksReason(null, 30)).toBeNull();
        expect(thanksReason(undefined, 30)).toBeNull();
    });

    it("stays quiet without a success moment", () => {
        expect(thanksReason(user(), 0)).toBeNull();
        expect(thanksReason(user([mock(false)]), THANKS_STREAK_DAYS - 1)).toBeNull();
        expect(thanksReason(user([mock(true, true)]), 0)).toBeNull();
        expect(thanksReason(user(), Number.NaN)).toBeNull();
    });

    it("prefers a passed mock exam over a streak", () => {
        expect(thanksReason(user([mock(false), mock(true)]), 0)).toBe("mock");
        expect(thanksReason(user([mock(true)]), 40)).toBe("mock");
    });

    it("accepts a seven-day streak", () => {
        expect(thanksReason(user(), THANKS_STREAK_DAYS)).toBe("streak");
        expect(thanksReason(user([mock(false)]), 12)).toBe("streak");
    });

    it("survives a record without the test list", () => {
        const damaged = { ...user(), testProgress: undefined } as unknown as User;
        expect(thanksReason(damaged, THANKS_STREAK_DAYS)).toBe("streak");
    });
});

describe("thanksAllowed", () => {
    it("allows a first ask", () => {
        expect(thanksAllowed(EMPTY_SUPPORT, NEVER_ASKED, NOW)).toBe(true);
    });

    it("never asks a learner who tipped", () => {
        expect(thanksAllowed({ tips: 1, lastTipAt: daysAgo(400) }, NEVER_ASKED, NOW)).toBe(false);
    });

    it("waits thirty days after a 'not now'", () => {
        expect(thanksAllowed(EMPTY_SUPPORT, { asks: 1, lastAskAt: daysAgo(1) }, NOW)).toBe(false);
        expect(thanksAllowed(EMPTY_SUPPORT, { asks: 1, lastAskAt: daysAgo(THANKS_RETRY_DAYS - 1) }, NOW)).toBe(false);
        expect(thanksAllowed(EMPTY_SUPPORT, { asks: 1, lastAskAt: daysAgo(THANKS_RETRY_DAYS) }, NOW)).toBe(true);
    });

    it("gives up after the second 'not now'", () => {
        expect(thanksAllowed(EMPTY_SUPPORT, { asks: THANKS_MAX_ASKS, lastAskAt: daysAgo(900) }, NOW)).toBe(false);
        expect(thanksAllowed(EMPTY_SUPPORT, { asks: 7, lastAskAt: null }, NOW)).toBe(false);
    });

    it("treats a damaged or missing time stamp as long ago", () => {
        expect(thanksAllowed(EMPTY_SUPPORT, { asks: 1, lastAskAt: "yesterday" }, NOW)).toBe(true);
        expect(thanksAllowed(EMPTY_SUPPORT, { asks: 1, lastAskAt: null }, NOW)).toBe(true);
    });
});

describe("ask record", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    afterEach(() => {
        window.localStorage.clear();
    });

    it("reads 'never asked' when nothing is stored", () => {
        expect(readAsk()).toEqual(NEVER_ASKED);
    });

    it("counts each 'not now' and stamps the time", () => {
        expect(recordAsk(NOW)).toEqual({ asks: 1, lastAskAt: NOW.toISOString() });
        const later = new Date("2026-11-15T07:00:00.000Z");
        expect(recordAsk(later)).toEqual({ asks: 2, lastAskAt: later.toISOString() });
        expect(readAsk()).toEqual({ asks: 2, lastAskAt: later.toISOString() });
        expect(JSON.parse(window.localStorage.getItem(ASK_KEY) ?? "null")).toEqual({ asks: 2, lastAskAt: later.toISOString() });
    });

    it("treats damaged or foreign data as 'never asked'", () => {
        for (const raw of ["not json", "null", "[]", "42", '{"asks":"many"}', '{"asks":-2,"lastAskAt":7}']) {
            window.localStorage.setItem(ASK_KEY, raw);
            expect({ raw, record: readAsk() }).toEqual({ raw, record: NEVER_ASKED });
        }
    });

    it("keeps the learner record out of it", () => {
        window.localStorage.setItem("user", '{"schemaVersion":2}');
        recordAsk(NOW);
        expect(window.localStorage.getItem("user")).toBe('{"schemaVersion":2}');
    });
});
