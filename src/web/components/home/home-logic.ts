import type { EvaluationData } from "@/types/evaluation";
import type { MockTestProgress } from "@/types/user";
import { daysBetween, isDayKey, parseGermanDate } from "@/utils/date-utils";

/**
 * Small pure helpers of the home screen. Everything that needs a clock or
 * storage receives its input as an argument so it can be tested.
 */

export type GreetingKey = "greet_morning" | "greet_afternoon" | "greet_evening";

/** Greeting for an hour of the day (0 to 23), same cut-offs as version 2.0. */
export function greetingKey(hour: number): GreetingKey {
    if (hour < 12) {
        return "greet_morning";
    }
    if (hour < 18) {
        return "greet_afternoon";
    }
    return "greet_evening";
}

export type ExamCountdown =
    | { kind: "none" }
    | { kind: "today"; examDate: string }
    | { kind: "tomorrow"; examDate: string }
    | { kind: "upcoming"; examDate: string; days: number }
    | { kind: "past"; examDate: string; daysAgo: number };

/** Where the learner stands relative to their exam day; both values are "YYYY-MM-DD" day keys. */
export function examCountdown(today: string, examDate: string | null | undefined): ExamCountdown {
    if (!isDayKey(examDate)) {
        return { kind: "none" };
    }
    const days = daysBetween(today, examDate);
    if (days === 0) {
        return { kind: "today", examDate };
    }
    if (days === 1) {
        return { kind: "tomorrow", examDate };
    }
    if (days < 0) {
        return { kind: "past", examDate, daysAgo: -days };
    }
    return { kind: "upcoming", examDate, days };
}

function finishedMocks(tests: MockTestProgress[] | undefined): MockTestProgress[] {
    return (tests ?? []).filter((test) => Boolean(test) && test.cancelled !== true);
}

/** The most recent mock exams that were not cancelled, newest first. */
export function recentMocks(tests: MockTestProgress[] | undefined, limit = 3): MockTestProgress[] {
    const finished = finishedMocks(tests);
    return finished.slice(Math.max(0, finished.length - limit)).reverse();
}

/** Passed and finished (not cancelled) mock exams. */
export function mockSummary(tests: MockTestProgress[] | undefined): { passed: number; total: number } {
    const finished = finishedMocks(tests);
    return { passed: finished.filter((test) => test.passed === true).length, total: finished.length };
}

/** Local midnight of a BAMF "DD.MM.YYYY" value (a trailing time is ignored); null when unreadable. */
export function parseEvaluationDate(value: string | undefined): Date | null {
    const datePart = (value ?? "").trim().split(" ")[0];
    if (!/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(datePart)) {
        return null;
    }
    const date = parseGermanDate(datePart);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** Exam date under evaluation and the last sync of the bundled BAMF data. */
export function evaluationDates(data: EvaluationData): { examDate: Date | null; lastChecked: Date | null } {
    return { examDate: parseEvaluationDate(data.examDate), lastChecked: parseEvaluationDate(data.lastSyncAt) };
}

/** The pass card plays its light sweep once per day and session after the goal is met. */
export function shouldCelebrateGoal(goalMet: boolean, today: string, lastCelebrated: string | null): boolean {
    return goalMet && lastCelebrated !== today;
}

/** True when the record never stored a real first-open time (missing values are normalised to epoch 0). */
export function needsFirstOpenStamp(value: Date | string | null | undefined): boolean {
    if (value === null || value === undefined) {
        return true;
    }
    const time = new Date(value).getTime();
    return Number.isNaN(time) || time <= 0;
}
