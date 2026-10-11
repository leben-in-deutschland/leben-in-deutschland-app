import { describe, expect, it } from "vitest";
import type { MockTestProgress, User } from "@/types/user";
import {
    achievementOverview,
    answerBreakdown,
    answerState,
    calendarWeeks,
    daysToNextFreeze,
    latestProgress,
    masteryDistribution,
    mockHistory,
    mockTrend,
    monthLabels,
    monthName,
    shortDate,
    stateMastery,
    topicMastery,
    weekdayName,
} from "@/components/progress/progress-stats";
import { addDays, parseDayKey } from "@/utils/date-utils";
import { getCategoryCounts, getQuestion, getRelevantQuestions, getStateQuestions, normalizeCategory } from "@/utils/question-bank";
import { activityCalendar } from "@/utils/streak-logic";
import { passMarkFor } from "@/utils/user-defaults";

/*
 * The progress page reads records written by version 2.0 as they are:
 * `answeredCorrectly: null`, `answerSelected: ""`, duplicate entries for one
 * question, `dailyProgress.date` as `Date.toDateString()`, and mock exams
 * without pass mark, exam type, or timer flag.
 */

const TODAY = "2026-10-09";
const BE_QUESTIONS = getRelevantQuestions("BE");
const BE_NUMS = BE_QUESTIONS.map((question) => question.num);
const BE_STATE_NUMS = getStateQuestions("BE").map((question) => question.num);

function legacyDate(day: string): string {
    return parseDayKey(day).toDateString();
}

function legacyMock(datetime: string, correctCount: number, overrides: Partial<MockTestProgress> = {}): MockTestProgress {
    const nums = [...BE_NUMS.slice(100, 130), ...BE_STATE_NUMS.slice(0, 3)];
    return {
        datetime,
        timeTake: "1543",
        passed: correctCount >= 17,
        cancelled: false,
        questions: nums.map((num, index) => {
            const question = getQuestion(num)!;
            if (index >= 30) {
                return { answeredCorrectly: false, answerSelected: "", num, skipped: false, flagged: false };
            }
            const correct = index < correctCount;
            const wrongOption = question.solution === "a" ? "b" : "a";
            return { answeredCorrectly: correct, answerSelected: correct ? question.solution : wrongOption, num, skipped: false, flagged: false };
        }),
        ...overrides,
    };
}

/** A 2.0 record: no preferences, streak, schedule, or achievements. */
const LEGACY_USER = {
    state: { stateCode: "BE", stateName: "Berlin" },
    dailyProgress: [
        { attempted: 12, date: legacyDate(addDays(TODAY, -9)), correct: 8, incorrect: 3, skipped: 1, flagged: 1 },
        { attempted: 20, date: legacyDate(addDays(TODAY, -2)), correct: 15, incorrect: 5, skipped: 0, flagged: 0 },
        { attempted: 35, date: legacyDate(addDays(TODAY, -1)), correct: 24, incorrect: 9, skipped: 2, flagged: 0 },
        { attempted: 4, date: legacyDate(TODAY), correct: 3, incorrect: 1, skipped: 0, flagged: 0 },
    ],
    questionProgress: [
        // Current entry first; a stale duplicate of the same question follows.
        { num: BE_NUMS[0], answeredCorrectly: true, answerSelected: "a", skipped: false, flagged: false },
        { num: BE_NUMS[0], answeredCorrectly: false, answerSelected: "b", skipped: false, flagged: false },
        { num: BE_NUMS[1], answeredCorrectly: false, answerSelected: "c", skipped: false, flagged: true },
        // Skipped in 2.0: no answer, skipped flag set.
        { num: BE_NUMS[2], answeredCorrectly: null, answerSelected: "", skipped: true, flagged: false },
        // Opened without answering in 2.0.
        { num: BE_NUMS[3], answeredCorrectly: null, answerSelected: null, skipped: false, flagged: false },
        // Only flagged, never answered.
        { num: BE_NUMS[4], answeredCorrectly: null, answerSelected: "", skipped: false, flagged: true },
        { num: BE_STATE_NUMS[0], answeredCorrectly: true, answerSelected: "d", skipped: false, flagged: false },
        { num: BE_STATE_NUMS[1], answeredCorrectly: false, answerSelected: "a", skipped: false, flagged: false },
        // A question from another state is not part of the catalogue.
        { num: getStateQuestions("BY")[0].num, answeredCorrectly: true, answerSelected: "a", skipped: false, flagged: false },
    ],
    id: "",
    testProgress: [
        legacyMock("2026-09-20T10:00:00.000Z", 14),
        legacyMock("2026-09-27T10:00:00.000Z", 20, { timeTake: "" }),
        legacyMock("2026-10-01T10:00:00.000Z", 5, { cancelled: true, passed: false }),
        legacyMock("2026-10-05T10:00:00.000Z", 25, { timeTake: "900.7" }),
    ],
    appLanguage: "de",
    appFirstTimeOpenDateTime: "2026-09-01T08:00:00.000Z",
    lastReviewPromptDateTime: null,
    reviewNoCount: 0,
    userReviewed: false,
} as unknown as User;

describe("latestProgress and answerState", () => {
    it("uses the first entry of a question and reads 2.0 answer shapes", () => {
        const latest = latestProgress(LEGACY_USER);
        expect(latest.get(BE_NUMS[0])?.answeredCorrectly).toBe(true);
        expect(answerState(latest.get(BE_NUMS[0]))).toBe("correct");
        expect(answerState(latest.get(BE_NUMS[1]))).toBe("wrong");
        expect(answerState(latest.get(BE_NUMS[2]))).toBe("skipped");
        expect(answerState(latest.get(BE_NUMS[3]))).toBe("skipped");
        expect(answerState(latest.get(BE_NUMS[4]))).toBe("unanswered");
        expect(answerState(undefined)).toBe("unanswered");
    });

    it("tolerates a record without questionProgress", () => {
        expect(latestProgress({ ...LEGACY_USER, questionProgress: undefined as unknown as User["questionProgress"] }).size).toBe(0);
    });
});

describe("topicMastery", () => {
    it("lists every catalogue topic and counts latest answers only", () => {
        const topics = topicMastery(LEGACY_USER);
        const counts = getCategoryCounts("BE");
        expect(topics.map((topic) => topic.category)).toEqual(counts.map((count) => count.category));
        expect(topics.reduce((sum, topic) => sum + topic.total, 0)).toBe(BE_QUESTIONS.length);

        const first = normalizeCategory(getQuestion(BE_NUMS[0])!.category);
        const topic = topics.find((item) => item.category === first)!;
        expect(topic.known).toBeGreaterThanOrEqual(1);

        const known = topics.reduce((sum, item) => sum + item.known, 0);
        const wrong = topics.reduce((sum, item) => sum + item.wrong, 0);
        expect(known).toBe(2);
        expect(wrong).toBe(2);
        expect(topics.every((item) => item.answered === item.known + item.wrong)).toBe(true);
    });
});

describe("answerBreakdown", () => {
    it("partitions the catalogue and counts flags separately", () => {
        const breakdown = answerBreakdown(LEGACY_USER);
        expect(breakdown.total).toBe(BE_QUESTIONS.length);
        expect(breakdown.correct).toBe(2);
        expect(breakdown.wrong).toBe(2);
        expect(breakdown.skipped).toBe(2);
        expect(breakdown.unanswered).toBe(BE_QUESTIONS.length - 6);
        expect(breakdown.flagged).toBe(2);
        expect(breakdown.correct + breakdown.wrong + breakdown.skipped + breakdown.unanswered).toBe(breakdown.total);
    });
});

describe("masteryDistribution", () => {
    it("treats a record without a review schedule as all new", () => {
        const distribution = masteryDistribution(LEGACY_USER);
        expect(distribution.total).toBe(BE_QUESTIONS.length);
        expect(distribution.new).toBe(BE_QUESTIONS.length);
        expect(distribution.learning + distribution.known + distribution.mastered).toBe(0);
    });

    it("reads review boxes when present", () => {
        const user: User = {
            ...LEGACY_USER,
            reviewSchedule: [
                { num: BE_NUMS[0], box: 1, due: TODAY, lastReviewed: TODAY },
                { num: BE_NUMS[1], box: 3, due: TODAY, lastReviewed: TODAY },
                { num: BE_NUMS[2], box: 5, due: TODAY, lastReviewed: TODAY },
            ],
        };
        const distribution = masteryDistribution(user);
        expect(distribution.new).toBe(BE_QUESTIONS.length - 3);
        expect(distribution.learning).toBe(1);
        expect(distribution.known).toBe(1);
        expect(distribution.mastered).toBe(1);
    });
});

describe("mock exams", () => {
    it("lists exams newest first with 2.0 pass marks, durations, and status", () => {
        const history = mockHistory(LEGACY_USER);
        expect(history.map((entry) => entry.test.datetime)).toEqual([
            "2026-10-05T10:00:00.000Z",
            "2026-10-01T10:00:00.000Z",
            "2026-09-27T10:00:00.000Z",
            "2026-09-20T10:00:00.000Z",
        ]);
        expect(history.map((entry) => entry.status)).toEqual(["passed", "cancelled", "passed", "failed"]);
        expect(history.every((entry) => entry.passMark === passMarkFor("einbuergerung"))).toBe(true);
        expect(history.map((entry) => entry.seconds)).toEqual([900, 1543, 0, 1543]);
        expect(history[0].score).toEqual({ correct: 25, wrong: 5, unanswered: 3, total: 33 });
    });

    it("derives the status from the score when `passed` is missing", () => {
        const user = {
            ...LEGACY_USER,
            testProgress: [legacyMock("2026-10-06T10:00:00.000Z", 17, { passed: undefined as unknown as boolean })],
        } as User;
        expect(mockHistory(user)[0].status).toBe("passed");
    });

    it("builds the trend from finished exams, oldest first", () => {
        const trend = mockTrend(LEGACY_USER);
        expect(trend.finished).toBe(3);
        expect(trend.passed).toBe(2);
        expect(trend.best).toBe(25);
        expect(trend.average).toBeCloseTo((14 + 20 + 25) / 3);
        expect(trend.points.map((point) => point.correct)).toEqual([14, 20, 25]);
        expect(trend.points.map((point) => point.passed)).toEqual([false, true, true]);
        expect(trend.points[0]).toMatchObject({ total: 33, passMark: 17 });
    });

    it("limits the trend to the most recent exams", () => {
        const trend = mockTrend(LEGACY_USER, 2);
        expect(trend.points.map((point) => point.correct)).toEqual([20, 25]);
        expect(trend.finished).toBe(3);
    });

    it("is empty without exams", () => {
        const trend = mockTrend({ ...LEGACY_USER, testProgress: [] });
        expect(trend).toEqual({ points: [], finished: 0, passed: 0, best: 0, average: null });
        expect(mockHistory({ ...LEGACY_USER, testProgress: undefined as unknown as User["testProgress"] })).toEqual([]);
    });
});

describe("stateMastery", () => {
    it("marks the ten state questions", () => {
        const result = stateMastery(LEGACY_USER);
        expect(result.total).toBe(10);
        expect(result.known).toBe(1);
        expect(result.questions[0].state).toBe("correct");
        expect(result.questions[1].state).toBe("wrong");
        expect(result.questions[2].state).toBe("unanswered");
    });
});

describe("achievementOverview", () => {
    it("reports progress for a record without achievements", () => {
        const overview = achievementOverview(LEGACY_USER, TODAY);
        expect(overview.total).toBeGreaterThan(0);
        expect(overview.items).toHaveLength(overview.total);
        expect(overview.unlocked).toBe(0);
        for (const item of overview.items) {
            expect(item.progress).toBeGreaterThanOrEqual(0);
            expect(item.progress).toBeLessThanOrEqual(item.def.target);
            expect(item.ratio).toBeGreaterThanOrEqual(0);
            expect(item.ratio).toBeLessThanOrEqual(1);
        }
        const firstMock = overview.items.find((item) => item.def.id === "mock_first")!;
        expect(firstMock.progress).toBe(firstMock.def.target);
        const perfect = overview.items.find((item) => item.def.id === "mock_perfect")!;
        expect(perfect.progress).toBe(25);
        expect(perfect.ratio).toBeCloseTo(25 / 33);
    });

    it("shows unlocked achievements as complete", () => {
        const user: User = { ...LEGACY_USER, achievements: [{ id: "first_answer", unlockedAt: "2026-10-01T10:00:00.000Z" }] };
        const overview = achievementOverview(user, TODAY);
        expect(overview.unlocked).toBe(1);
        const item = overview.items.find((entry) => entry.def.id === "first_answer")!;
        expect(item.unlocked?.unlockedAt).toBe("2026-10-01T10:00:00.000Z");
        expect(item.ratio).toBe(1);
    });
});

describe("calendar helpers", () => {
    it("arranges the last 84 days into Monday-first week columns", () => {
        const days = activityCalendar(LEGACY_USER, TODAY, 84);
        const weeks = calendarWeeks(days);
        expect(weeks.every((week) => week.length === 7)).toBe(true);
        const cells = weeks.flat();
        expect(cells.filter(Boolean)).toHaveLength(84);
        // 2026-07-18 is a Saturday: five empty cells before it.
        expect(days[0].day).toBe("2026-07-18");
        expect(weeks[0].slice(0, 5).every((cell) => cell === null)).toBe(true);
        expect(weeks[0][5]?.day).toBe("2026-07-18");
        // 2026-10-09 is a Friday: two empty cells after it.
        const last = weeks[weeks.length - 1];
        expect(last[4]?.day).toBe(TODAY);
        expect(last[5]).toBeNull();
        expect(last[6]).toBeNull();
        expect(cells.find((cell) => cell?.day === addDays(TODAY, -1))?.status).toBe("done");
    });

    it("returns no columns without days", () => {
        expect(calendarWeeks([])).toEqual([]);
        expect(monthLabels([], "en-US")).toEqual([]);
    });

    it("labels the column where a month begins", () => {
        const weeks = calendarWeeks(activityCalendar(LEGACY_USER, TODAY, 84));
        const labels = monthLabels(weeks, "en-US");
        expect(labels).toHaveLength(weeks.length);
        expect(labels[0]).toBe("Jul");
        expect(labels.filter(Boolean)).toEqual(["Jul", "Aug", "Sep", "Oct"]);
    });

    it("counts days to the next freeze", () => {
        expect(daysToNextFreeze(0)).toBe(7);
        expect(daysToNextFreeze(3)).toBe(4);
        expect(daysToNextFreeze(7)).toBe(7);
        expect(daysToNextFreeze(13)).toBe(1);
        expect(daysToNextFreeze(Number.NaN)).toBe(7);
    });

    it("formats weekday, month, and short dates per language", () => {
        expect(weekdayName(0, "en-US")).toBe("Sunday");
        expect(weekdayName(1, "de-DE")).toBe("Montag");
        expect(weekdayName(6, "de-DE", "short")).toMatch(/^Sa/);
        expect(monthName("2026-10-09", "en-US")).toBe("Oct");
        expect(shortDate("2026-10-09", "de-DE")).toBe("09.10.");
        expect(shortDate("2026-10-09", "en-US")).toBe("10/09");
    });
});
