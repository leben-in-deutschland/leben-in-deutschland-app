import { describe, it, expect } from "vitest";
import {
    addDays,
    atTime,
    dayKey,
    dayRange,
    daysBetween,
    isDayKey,
    isoWeekKey,
    parseDayKey,
    parseGermanDate,
    parseTime,
    startOfWeek,
    weekdayOf,
} from "@/utils/date-utils";

describe("date-utils", () => {
    it("formats local calendar days", () => {
        expect(dayKey(new Date(2026, 9, 9, 23, 59))).toBe("2026-10-09");
        expect(dayKey(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
        expect(dayKey("Thu Oct 08 2026")).toBe("2026-10-08");
    });

    it("parses day keys to local midnight", () => {
        const date = parseDayKey("2026-03-29");
        expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 2, 29, 0]);
    });

    it("validates day keys", () => {
        expect(isDayKey("2026-10-09")).toBe(true);
        expect(isDayKey("2026-02-30")).toBe(false);
        expect(isDayKey("2026-1-9")).toBe(false);
        expect(isDayKey(20261009)).toBe(false);
    });

    it("adds days across months, years, and daylight-saving changes", () => {
        expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
        expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
        expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
        expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
        expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    });

    it("counts calendar days between keys", () => {
        expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
        expect(daysBetween("2026-10-30", "2026-10-24")).toBe(-6);
        expect(daysBetween("2025-12-31", "2026-12-31")).toBe(365);
    });

    it("finds weekdays and Monday-based weeks", () => {
        expect(weekdayOf("2026-10-11")).toBe(0);
        expect(startOfWeek("2026-10-11")).toBe("2026-10-05");
        expect(startOfWeek("2026-10-05")).toBe("2026-10-05");
        expect(dayRange("2026-10-05", "2026-10-07")).toEqual(["2026-10-05", "2026-10-06", "2026-10-07"]);
        expect(dayRange("2026-10-07", "2026-10-05")).toEqual([]);
    });

    it("builds ISO week keys", () => {
        expect(isoWeekKey("2026-10-09")).toBe("2026-W41");
        expect(isoWeekKey("2027-01-01")).toBe("2026-W53");
        expect(isoWeekKey("2026-01-01")).toBe("2026-W01");
        expect(isoWeekKey("2024-12-30")).toBe("2025-W01");
    });

    it("parses times and builds local dates", () => {
        expect(parseTime("07:05")).toEqual([7, 5]);
        expect(parseTime("bad")).toEqual([18, 0]);
        const date = atTime("2026-10-09", "20:30");
        expect([date.getDate(), date.getHours(), date.getMinutes()]).toEqual([9, 20, 30]);
    });

    it("parses BAMF dates", () => {
        const date = parseGermanDate("14.07.2026");
        expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 6, 14]);
    });
});
