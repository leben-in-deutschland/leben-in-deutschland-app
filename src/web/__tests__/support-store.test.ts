import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EMPTY_SUPPORT, SUPPORT_KEY, readSupport, recordTips } from "@/utils/support-store";

const USER_RECORD = JSON.stringify({ state: { stateCode: "BE" }, schemaVersion: 2, questionProgress: [{ id: "1" }] });

beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("user", USER_RECORD);
});

afterEach(() => {
    window.localStorage.clear();
});

describe("support store", () => {
    it("reads no tips when nothing is stored", () => {
        expect(readSupport()).toEqual(EMPTY_SUPPORT);
    });

    it("counts confirmed tips and stamps the time", () => {
        const first = recordTips(1, new Date("2026-10-10T10:00:00.000Z"));
        expect(first).toEqual({ tips: 1, lastTipAt: "2026-10-10T10:00:00.000Z" });
        const second = recordTips(2, new Date("2026-10-11T09:30:00.000Z"));
        expect(second).toEqual({ tips: 3, lastTipAt: "2026-10-11T09:30:00.000Z" });
        expect(readSupport()).toEqual(second);
        expect(JSON.parse(window.localStorage.getItem(SUPPORT_KEY) ?? "null")).toEqual(second);
    });

    it("ignores counts below one and fractions", () => {
        expect(recordTips(0)).toEqual(EMPTY_SUPPORT);
        expect(recordTips(-3)).toEqual(EMPTY_SUPPORT);
        expect(recordTips(Number.NaN)).toEqual(EMPTY_SUPPORT);
        expect(window.localStorage.getItem(SUPPORT_KEY)).toBeNull();
        expect(recordTips(1.9).tips).toBe(1);
    });

    it("treats damaged or foreign data as no tips", () => {
        for (const raw of ["not json", "null", "[]", "42", '{"tips":"many"}', '{"tips":-2,"lastTipAt":7}']) {
            window.localStorage.setItem(SUPPORT_KEY, raw);
            expect({ raw, record: readSupport() }).toEqual({ raw, record: EMPTY_SUPPORT });
        }
        window.localStorage.setItem(SUPPORT_KEY, '{"tips":2.7,"lastTipAt":"2026-01-01T00:00:00.000Z","extra":true}');
        expect(readSupport()).toEqual({ tips: 2, lastTipAt: "2026-01-01T00:00:00.000Z" });
    });

    it("never touches the learner record", () => {
        recordTips(1);
        recordTips(5);
        expect(window.localStorage.getItem("user")).toBe(USER_RECORD);
        const keys = Array.from({ length: window.localStorage.length }, (_, i) => window.localStorage.key(i)).sort();
        expect(keys).toEqual([SUPPORT_KEY, "user"]);
    });
});
