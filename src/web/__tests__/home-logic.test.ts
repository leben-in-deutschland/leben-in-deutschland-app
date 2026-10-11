import { describe, expect, it } from "vitest";
import {
    evaluationDates,
    examCountdown,
    greetingKey,
    mockSummary,
    needsFirstOpenStamp,
    parseEvaluationDate,
    recentMocks,
    shouldCelebrateGoal,
} from "@/components/home/home-logic";
import type { MockTestProgress } from "@/types/user";

function mock(datetime: string, passed: boolean, cancelled = false): MockTestProgress {
    return { datetime, timeTake: "00:10:00", passed, cancelled, questions: [] };
}

describe("greetingKey", () => {
    it("splits the day into morning, afternoon and evening", () => {
        expect(greetingKey(0)).toBe("greet_morning");
        expect(greetingKey(11)).toBe("greet_morning");
        expect(greetingKey(12)).toBe("greet_afternoon");
        expect(greetingKey(17)).toBe("greet_afternoon");
        expect(greetingKey(18)).toBe("greet_evening");
        expect(greetingKey(23)).toBe("greet_evening");
    });
});

describe("examCountdown", () => {
    const today = "2025-03-10";

    it("returns none without a valid exam date", () => {
        expect(examCountdown(today, null)).toEqual({ kind: "none" });
        expect(examCountdown(today, undefined)).toEqual({ kind: "none" });
        expect(examCountdown(today, "10.03.2025")).toEqual({ kind: "none" });
        expect(examCountdown(today, "2025-02-30")).toEqual({ kind: "none" });
    });

    it("distinguishes today, tomorrow, upcoming and past exams", () => {
        expect(examCountdown(today, "2025-03-10")).toEqual({ kind: "today", examDate: "2025-03-10" });
        expect(examCountdown(today, "2025-03-11")).toEqual({ kind: "tomorrow", examDate: "2025-03-11" });
        expect(examCountdown(today, "2025-04-01")).toEqual({ kind: "upcoming", examDate: "2025-04-01", days: 22 });
        expect(examCountdown(today, "2025-03-01")).toEqual({ kind: "past", examDate: "2025-03-01", daysAgo: 9 });
    });
});

describe("recentMocks and mockSummary", () => {
    const tests = [
        mock("2025-01-01T10:00:00.000Z", false),
        mock("2025-01-02T10:00:00.000Z", true, true),
        mock("2025-01-03T10:00:00.000Z", true),
        mock("2025-01-04T10:00:00.000Z", true),
        mock("2025-01-05T10:00:00.000Z", false),
    ];

    it("returns the newest finished exams first and skips cancelled ones", () => {
        expect(recentMocks(tests).map((test) => test.datetime)).toEqual([
            "2025-01-05T10:00:00.000Z",
            "2025-01-04T10:00:00.000Z",
            "2025-01-03T10:00:00.000Z",
        ]);
        expect(recentMocks(tests, 10)).toHaveLength(4);
        expect(recentMocks(undefined)).toEqual([]);
        expect(recentMocks([])).toEqual([]);
    });

    it("counts passed and finished exams", () => {
        expect(mockSummary(tests)).toEqual({ passed: 2, total: 4 });
        expect(mockSummary(undefined)).toEqual({ passed: 0, total: 0 });
    });
});

describe("evaluation dates", () => {
    it("parses the BAMF day format and ignores a trailing time", () => {
        expect(parseEvaluationDate("05.02.2025")).toEqual(new Date(2025, 1, 5));
        expect(parseEvaluationDate("05.02.2025 11:36:20")).toEqual(new Date(2025, 1, 5));
        expect(parseEvaluationDate("")).toBeNull();
        expect(parseEvaluationDate(undefined)).toBeNull();
        expect(parseEvaluationDate("2025-02-05")).toBeNull();
    });

    it("exposes both dates of the bundled data", () => {
        const dates = evaluationDates({ examDate: "01.02.2025", lastSyncAt: "03.04.2025 08:00:00", history: [] });
        expect(dates.examDate).toEqual(new Date(2025, 1, 1));
        expect(dates.lastChecked).toEqual(new Date(2025, 3, 3));
    });
});

describe("shouldCelebrateGoal", () => {
    it("celebrates a met goal once per day", () => {
        expect(shouldCelebrateGoal(true, "2025-03-10", null)).toBe(true);
        expect(shouldCelebrateGoal(true, "2025-03-10", "2025-03-09")).toBe(true);
        expect(shouldCelebrateGoal(true, "2025-03-10", "2025-03-10")).toBe(false);
        expect(shouldCelebrateGoal(false, "2025-03-10", null)).toBe(false);
    });
});

describe("needsFirstOpenStamp", () => {
    it("detects missing or normalised first-open times", () => {
        expect(needsFirstOpenStamp(undefined)).toBe(true);
        expect(needsFirstOpenStamp(null)).toBe(true);
        expect(needsFirstOpenStamp(new Date(0))).toBe(true);
        expect(needsFirstOpenStamp("not a date")).toBe(true);
        expect(needsFirstOpenStamp(new Date("2025-03-10T08:00:00.000Z"))).toBe(false);
        expect(needsFirstOpenStamp("2025-03-10T08:00:00.000Z")).toBe(false);
    });
});
