import { describe, expect, it } from "vitest";
import type { Question } from "@/types/question";
import type { MockTestProgress, ReviewItem, User, UserDailyProgress, UserQuestionProgress } from "@/types/user";
import { dayKey, parseDayKey } from "@/utils/date-utils";
import {
    applyMockToUser,
    gradeMock,
    mockScore,
    recordAnswer,
    recordSkip,
    toggleFlag,
    type GradeOptions,
} from "@/utils/practice-logic";
import type { AnswerOption } from "@/utils/question-bank";

/* "Today" is Friday 2026-10-09; all dates are local times. */
const TODAY = "2026-10-09";
const YESTERDAY = "2026-10-08";
const NOW = new Date(2026, 9, 9, 14, 30);
const STARTED = new Date(2026, 9, 9, 10, 0, 0);
/** 25 minutes and 30 seconds after STARTED. */
const FINISHED = new Date(2026, 9, 9, 10, 25, 30);

/** The format older app versions stored: `Date.toDateString()`, e.g. "Fri Oct 09 2026". */
function legacyDate(day: string): string {
    return parseDayKey(day).toDateString();
}

function makeQuestion(num: string, solution: AnswerOption = "a"): Question {
    return {
        num,
        id: `id-${num}`,
        question: `Question ${num}`,
        a: "A",
        b: "B",
        c: "C",
        d: "D",
        solution,
        image: "",
        category: "General",
    };
}

/** A record as older app versions stored it: none of the fields added in 2.1. */
function makeUser(overrides: Partial<User> = {}): User {
    return {
        id: "test-user",
        state: { stateName: "Berlin", stateCode: "BE" },
        dailyProgress: [],
        questionProgress: [],
        testProgress: [],
        appLanguage: "de",
        appFirstTimeOpenDateTime: new Date(2026, 0, 1),
        lastReviewPromptDateTime: null,
        reviewNoCount: 0,
        userReviewed: false,
        ...overrides,
    };
}

function progress(num: string, overrides: Partial<UserQuestionProgress> = {}): UserQuestionProgress {
    return { num, answeredCorrectly: null, skipped: false, answerSelected: null, flagged: false, ...overrides };
}

/** A stored daily entry in the legacy shape; `answered` only when given. */
function daily(day: string, overrides: Partial<UserDailyProgress> = {}): UserDailyProgress {
    return { date: legacyDate(day), attempted: 0, correct: 0, incorrect: 0, skipped: 0, flagged: 0, ...overrides };
}

function item(num: string, box: number, due: string, lastReviewed = "2026-10-01"): ReviewItem {
    return { num, box, due, lastReviewed };
}

function entryFor(user: User, day: string): UserDailyProgress | undefined {
    return user.dailyProgress.find((entry) => dayKey(new Date(entry.date)) === day);
}

/** Freezes a value and everything inside it, so any write throws in strict mode. */
function deepFreeze<T>(value: T): T {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const child of Object.values(value as Record<string, unknown>)) {
            deepFreeze(child);
        }
    }
    return value;
}

function gradeOptions(overrides: Partial<GradeOptions> = {}): GradeOptions {
    return { passMark: 17, examType: "einbuergerung", timed: true, startedAt: STARTED, finishedAt: FINISHED, ...overrides };
}

/** A full exam: 30 general questions and 3 Berlin questions, all with solution "a". */
function examQuestions(): Question[] {
    return [
        ...Array.from({ length: 30 }, (_, i) => makeQuestion(String(i + 1), "a")),
        ...["BE-1", "BE-2", "BE-3"].map((num) => makeQuestion(num, "a")),
    ];
}

function answersFor(
    questions: Question[],
    pick: (index: number) => AnswerOption | null | undefined,
): Record<string, AnswerOption | null | undefined> {
    const answers: Record<string, AnswerOption | null | undefined> = {};
    questions.forEach((question, index) => {
        answers[question.num] = pick(index);
    });
    return answers;
}

/** The first `correct` questions answered right ("a"), every other one wrong ("b"). */
function answersWith(questions: Question[], correct: number): Record<string, AnswerOption | null | undefined> {
    return answersFor(questions, (index) => (index < correct ? "a" : "b"));
}

/** A graded exam: "1" right, "2" wrong, "3" unanswered, "4" right; "2" and "4" flagged in the exam. */
function sampleMock(): MockTestProgress {
    const questions = [makeQuestion("1", "a"), makeQuestion("2", "b"), makeQuestion("3", "c"), makeQuestion("4", "d")];
    return gradeMock(questions, { "1": "a", "2": "c", "4": "d" }, ["2", "4"], gradeOptions());
}

describe("recordAnswer", () => {
    it("records a first correct answer", () => {
        const result = recordAnswer(makeUser(), makeQuestion("1", "a"), "a", NOW);

        expect(result.correct).toBe(true);
        expect(result.user.questionProgress).toEqual([
            { num: "1", answeredCorrectly: true, answerSelected: "a", skipped: false, flagged: false },
        ]);
        expect(result.user.dailyProgress).toEqual([
            { date: "Fri Oct 09 2026", attempted: 1, correct: 1, incorrect: 0, skipped: 0, flagged: 0, answered: 1 },
        ]);
        expect(result.user.reviewSchedule).toEqual([{ num: "1", box: 2, due: "2026-10-11", lastReviewed: TODAY }]);
    });

    it("records a first wrong answer", () => {
        const result = recordAnswer(makeUser(), makeQuestion("1", "a"), "c", NOW);

        expect(result.correct).toBe(false);
        expect(result.user.questionProgress).toEqual([
            { num: "1", answeredCorrectly: false, answerSelected: "c", skipped: false, flagged: false },
        ]);
        expect(result.user.dailyProgress).toEqual([daily(TODAY, { attempted: 1, incorrect: 1, answered: 1 })]);
        expect(result.user.reviewSchedule).toEqual([{ num: "1", box: 1, due: TODAY, lastReviewed: TODAY }]);
    });

    it.each<[string, Partial<UserQuestionProgress> | null, AnswerOption, Partial<UserDailyProgress>]>([
        ["a first correct answer", null, "a", { correct: 4, incorrect: 2 }],
        ["a first wrong answer", null, "b", { correct: 3, incorrect: 3 }],
        ["a correct answer to a known question", { answeredCorrectly: true, answerSelected: "a" }, "a", { correct: 3, incorrect: 2 }],
        ["a wrong answer to a known question", { answeredCorrectly: true, answerSelected: "a" }, "b", { correct: 2, incorrect: 3 }],
        ["a correct answer after a wrong one", { answeredCorrectly: false, answerSelected: "b" }, "a", { correct: 4, incorrect: 2 }],
        ["a wrong answer after a wrong one", { answeredCorrectly: false, answerSelected: "b" }, "c", { correct: 3, incorrect: 3 }],
        ["a correct answer after a skip", { answeredCorrectly: null, skipped: true }, "a", { correct: 4, incorrect: 2 }],
        ["a wrong answer after a skip", { answeredCorrectly: null, skipped: true }, "d", { correct: 3, incorrect: 3 }],
        ["a correct answer to a flagged question", { answeredCorrectly: null, flagged: true }, "a", { correct: 4, incorrect: 2 }],
    ])("counts %s like the legacy statistics", (_label, previous, option, counts) => {
        const user = makeUser({
            questionProgress: previous ? [progress("7", previous)] : [],
            dailyProgress: [daily(TODAY, { attempted: 6, correct: 3, incorrect: 2, skipped: 1, answered: 5 })],
        });

        const result = recordAnswer(user, makeQuestion("7", "a"), option, NOW);

        expect(result.correct).toBe(option === "a");
        expect(result.user.dailyProgress).toEqual([
            daily(TODAY, { attempted: 7, skipped: 1, answered: 6, ...counts }),
        ]);
    });

    it("never lets the daily correct count drop below zero", () => {
        // The question became known on an earlier day; today nothing was correct yet.
        const yesterday = daily(YESTERDAY, { attempted: 1, correct: 1, answered: 1 });
        const user = makeUser({
            questionProgress: [progress("7", { answeredCorrectly: true, answerSelected: "a" })],
            dailyProgress: [yesterday, daily(TODAY, { attempted: 2, incorrect: 2, answered: 2 })],
        });

        const { user: next } = recordAnswer(user, makeQuestion("7", "a"), "d", NOW);

        expect(entryFor(next, TODAY)).toEqual(daily(TODAY, { attempted: 3, correct: 0, incorrect: 3, answered: 3 }));
        expect(next.dailyProgress[0]).toBe(yesterday);
    });

    it("starts the answered counter from correct + incorrect on entries written before 2.1", () => {
        const user = makeUser({ dailyProgress: [daily(TODAY, { attempted: 9, correct: 4, incorrect: 3, skipped: 2 })] });

        const { user: next } = recordAnswer(user, makeQuestion("12", "b"), "b", NOW);

        expect(next.dailyProgress).toEqual([
            daily(TODAY, { attempted: 10, correct: 5, incorrect: 3, skipped: 2, answered: 8 }),
        ]);
    });

    it("keeps counting from a stored answered value", () => {
        const user = makeUser({ dailyProgress: [daily(TODAY, { attempted: 12, correct: 2, incorrect: 1, answered: 11 })] });

        const { user: next } = recordAnswer(user, makeQuestion("12", "b"), "a", NOW);

        expect(next.dailyProgress).toEqual([daily(TODAY, { attempted: 13, correct: 2, incorrect: 2, answered: 12 })]);
    });

    it("adds an entry for today in the Date.toDateString format and keeps earlier days", () => {
        const yesterday = daily(YESTERDAY, { attempted: 3, correct: 3, answered: 3 });
        const user = makeUser({ dailyProgress: [yesterday] });

        const { user: next } = recordAnswer(user, makeQuestion("1"), "a", NOW);

        expect(next.dailyProgress).toHaveLength(2);
        expect(next.dailyProgress[0]).toBe(yesterday);
        expect(next.dailyProgress[1].date).toBe("Fri Oct 09 2026");
        expect(next.dailyProgress[1].date).toBe(new Date(2026, 9, 9).toDateString());
    });

    it("finds today's entry when it was stored as an ISO string", () => {
        const iso = new Date(2026, 9, 9, 12, 0).toISOString();
        const user = makeUser({ dailyProgress: [{ ...daily(TODAY, { attempted: 1, correct: 1, answered: 1 }), date: iso }] });

        const { user: next } = recordAnswer(user, makeQuestion("1"), "a", NOW);

        expect(next.dailyProgress).toEqual([
            { date: iso, attempted: 2, correct: 2, incorrect: 0, skipped: 0, flagged: 0, answered: 2 },
        ]);
    });

    it("updates only the first entry when a day was stored twice", () => {
        const first = daily(TODAY, { attempted: 1, correct: 1, answered: 1 });
        const second = { ...daily(TODAY, { attempted: 2, incorrect: 2 }), date: new Date(2026, 9, 9, 8, 0).toISOString() };
        const user = makeUser({ dailyProgress: [first, second] });

        const { user: next } = recordAnswer(user, makeQuestion("1"), "a", NOW);

        expect(next.dailyProgress).toEqual([daily(TODAY, { attempted: 2, correct: 2, answered: 2 }), second]);
        expect(next.dailyProgress[1]).toBe(second);
    });

    it("skips stored entries with unreadable dates", () => {
        const broken = { ...daily(TODAY, { attempted: 4 }), date: "not a date" };
        const user = makeUser({ dailyProgress: [broken] });

        const { user: next } = recordAnswer(user, makeQuestion("1"), "a", NOW);

        expect(next.dailyProgress).toEqual([broken, daily(TODAY, { attempted: 1, correct: 1, answered: 1 })]);
    });

    it("groups answers by the local day of `now`", () => {
        const lateEvening = new Date(2026, 9, 9, 23, 59, 59);
        const afterMidnight = new Date(2026, 9, 10, 0, 0, 1);

        const first = recordAnswer(makeUser(), makeQuestion("1"), "a", lateEvening).user;
        const second = recordAnswer(first, makeQuestion("2"), "a", afterMidnight).user;

        expect(second.dailyProgress.map((entry) => entry.date)).toEqual(["Fri Oct 09 2026", "Sat Oct 10 2026"]);
        expect(second.dailyProgress.map((entry) => entry.answered)).toEqual([1, 1]);
        expect(second.reviewSchedule?.map((entry) => entry.lastReviewed)).toEqual([TODAY, "2026-10-10"]);
    });

    it("matches stored days on daylight-saving change days", () => {
        // Clocks in Germany go back on 2026-10-25 and forward on 2026-03-29.
        const autumn = makeUser({ dailyProgress: [daily("2026-10-25", { attempted: 1, correct: 1, answered: 1 })] });

        const lateAutumn = recordAnswer(autumn, makeQuestion("1"), "a", new Date(2026, 9, 25, 23, 30)).user;
        const spring = recordAnswer(makeUser(), makeQuestion("1"), "a", new Date(2026, 2, 29, 12, 0)).user;

        expect(lateAutumn.dailyProgress).toEqual([daily("2026-10-25", { attempted: 2, correct: 2, answered: 2 })]);
        expect(spring.dailyProgress.map((entry) => entry.date)).toEqual(["Sun Mar 29 2026"]);
    });

    it("keeps the flag and clears the skip mark of an earlier entry", () => {
        const user = makeUser({ questionProgress: [progress("5", { flagged: true, skipped: true })] });

        const { user: next } = recordAnswer(user, makeQuestion("5", "d"), "d", NOW);

        expect(next.questionProgress).toEqual([
            { num: "5", answeredCorrectly: true, answerSelected: "d", skipped: false, flagged: true },
        ]);
    });

    it("replaces the entry in place and leaves the other questions alone", () => {
        const first = progress("1", { answeredCorrectly: true, answerSelected: "a" });
        const second = progress("2", { answeredCorrectly: true, answerSelected: "b" });
        const third = progress("BE-3", { flagged: true });
        const user = makeUser({ questionProgress: [first, second, third] });

        const { user: next } = recordAnswer(user, makeQuestion("2", "b"), "c", NOW);

        expect(next.questionProgress.map((entry) => entry.num)).toEqual(["1", "2", "BE-3"]);
        expect(next.questionProgress[0]).toBe(first);
        expect(next.questionProgress[2]).toBe(third);
        expect(next.questionProgress[1]).toEqual({
            num: "2",
            answeredCorrectly: false,
            answerSelected: "c",
            skipped: false,
            flagged: false,
        });
    });

    it("moves the question through the review schedule", () => {
        const other = item("9", 3, "2026-10-12");
        const due = item("4", 2, TODAY);
        const user = makeUser({ reviewSchedule: [other, due] });

        const right = recordAnswer(user, makeQuestion("4", "a"), "a", NOW).user;
        const wrong = recordAnswer(user, makeQuestion("4", "a"), "b", NOW).user;

        expect(right.reviewSchedule).toEqual([other, { num: "4", box: 3, due: "2026-10-13", lastReviewed: TODAY }]);
        expect(right.reviewSchedule?.[0]).toBe(other);
        expect(wrong.reviewSchedule).toEqual([other, { num: "4", box: 1, due: TODAY, lastReviewed: TODAY }]);
    });

    it("does not promote or recount a question answered correctly twice on one day", () => {
        const once = recordAnswer(makeUser(), makeQuestion("4"), "a", NOW).user;
        const twice = recordAnswer(once, makeQuestion("4"), "a", NOW).user;

        expect(twice.reviewSchedule).toEqual([{ num: "4", box: 2, due: "2026-10-11", lastReviewed: TODAY }]);
        expect(twice.dailyProgress).toEqual([daily(TODAY, { attempted: 2, correct: 1, answered: 2 })]);
    });

    it("starts a review schedule for records written before 2.1", () => {
        const user = makeUser();

        const { user: next } = recordAnswer(user, makeQuestion("BE-2", "c"), "c", NOW);

        expect(next.reviewSchedule).toEqual([{ num: "BE-2", box: 2, due: "2026-10-11", lastReviewed: TODAY }]);
        expect(user.reviewSchedule).toBeUndefined();
    });

    it("starts the daily list for damaged records without one", () => {
        const user = makeUser({ dailyProgress: undefined as unknown as UserDailyProgress[] });

        const { user: next } = recordAnswer(user, makeQuestion("1"), "a", NOW);

        expect(next.dailyProgress).toEqual([daily(TODAY, { attempted: 1, correct: 1, answered: 1 })]);
    });

    it("does not change the learner record it receives", () => {
        const user = deepFreeze(
            makeUser({
                questionProgress: [progress("1", { answeredCorrectly: true, answerSelected: "a", flagged: true })],
                dailyProgress: [daily(TODAY, { attempted: 1, correct: 1, answered: 1 })],
                reviewSchedule: [item("1", 2, TODAY, YESTERDAY)],
            }),
        );
        const snapshot = JSON.stringify(user);

        const { user: next } = recordAnswer(user, makeQuestion("1"), "b", NOW);

        expect(JSON.stringify(user)).toBe(snapshot);
        expect(next).not.toBe(user);
        expect(next.questionProgress).not.toBe(user.questionProgress);
        expect(next.dailyProgress).not.toBe(user.dailyProgress);
        expect(next.reviewSchedule).not.toBe(user.reviewSchedule);
        expect(next.testProgress).toBe(user.testProgress);
        expect(next.state).toBe(user.state);
    });
});

describe("recordSkip", () => {
    it("adds a skipped entry for a question seen for the first time", () => {
        const next = recordSkip(makeUser(), makeQuestion("8"), NOW);

        expect(next.questionProgress).toEqual([
            { num: "8", skipped: true, answerSelected: null, flagged: false, answeredCorrectly: null },
        ]);
        expect(next.dailyProgress).toEqual([daily(TODAY, { attempted: 1, skipped: 1 })]);
        expect(next.dailyProgress[0].date).toBe("Fri Oct 09 2026");
    });

    it("marks an earlier entry as skipped and keeps its answer and flag", () => {
        const user = makeUser({
            questionProgress: [progress("8", { answeredCorrectly: true, answerSelected: "b", flagged: true })],
        });

        const next = recordSkip(user, makeQuestion("8", "b"), NOW);

        expect(next.questionProgress).toEqual([
            { num: "8", answeredCorrectly: true, answerSelected: "b", skipped: true, flagged: true },
        ]);
    });

    it("counts an attempt and a skip but no answer, and leaves the review schedule alone", () => {
        const schedule = [item("8", 1, TODAY, YESTERDAY)];
        const user = makeUser({
            dailyProgress: [daily(TODAY, { attempted: 4, correct: 2, incorrect: 1, skipped: 1, flagged: 1, answered: 3 })],
            reviewSchedule: schedule,
        });

        const next = recordSkip(user, makeQuestion("8"), NOW);

        expect(next.dailyProgress).toEqual([
            daily(TODAY, { attempted: 5, correct: 2, incorrect: 1, skipped: 2, flagged: 1, answered: 3 }),
        ]);
        expect(next.reviewSchedule).toBe(schedule);
    });

    it("does not start the answered counter on entries written before 2.1", () => {
        const user = makeUser({ dailyProgress: [daily(TODAY, { attempted: 3, correct: 2, incorrect: 1 })] });

        const next = recordSkip(user, makeQuestion("8"), NOW);

        expect(next.dailyProgress[0]).not.toHaveProperty("answered");
        expect(next.dailyProgress).toEqual([daily(TODAY, { attempted: 4, correct: 2, incorrect: 1, skipped: 1 })]);
    });

    it("does not change the learner record it receives", () => {
        const user = deepFreeze(
            makeUser({
                questionProgress: [progress("8", { answeredCorrectly: false, answerSelected: "c" })],
                dailyProgress: [daily(TODAY, { attempted: 1, incorrect: 1, answered: 1 })],
            }),
        );
        const snapshot = JSON.stringify(user);

        const next = recordSkip(user, makeQuestion("8"), NOW);

        expect(JSON.stringify(user)).toBe(snapshot);
        expect(next).not.toBe(user);
        expect(next.questionProgress[0]).not.toBe(user.questionProgress[0]);
    });
});

describe("toggleFlag", () => {
    it("flags a question seen for the first time", () => {
        const result = toggleFlag(makeUser(), makeQuestion("BE-4"), NOW);

        expect(result.flagged).toBe(true);
        expect(result.user.questionProgress).toEqual([
            { num: "BE-4", skipped: false, answerSelected: null, flagged: true, answeredCorrectly: null },
        ]);
        expect(result.user.dailyProgress).toEqual([daily(TODAY, { flagged: 1 })]);
    });

    it("unflags a flagged question and keeps the rest of its entry", () => {
        const user = makeUser({
            questionProgress: [progress("3", { answeredCorrectly: false, answerSelected: "d", flagged: true })],
            dailyProgress: [daily(TODAY, { attempted: 2, incorrect: 1, skipped: 1, flagged: 2, answered: 1 })],
        });

        const result = toggleFlag(user, makeQuestion("3"), NOW);

        expect(result.flagged).toBe(false);
        expect(result.user.questionProgress).toEqual([
            { num: "3", answeredCorrectly: false, answerSelected: "d", skipped: false, flagged: false },
        ]);
        expect(result.user.dailyProgress).toEqual([
            daily(TODAY, { attempted: 2, incorrect: 1, skipped: 1, flagged: 1, answered: 1 }),
        ]);
    });

    it("flags an answered question without counting an attempt or a skip", () => {
        const user = makeUser({
            questionProgress: [progress("3", { answeredCorrectly: true, answerSelected: "a" })],
            dailyProgress: [daily(TODAY, { attempted: 3, correct: 3, answered: 3 })],
        });

        const result = toggleFlag(user, makeQuestion("3"), NOW);

        expect(result.flagged).toBe(true);
        expect(result.user.questionProgress[0]).toEqual(
            progress("3", { answeredCorrectly: true, answerSelected: "a", flagged: true }),
        );
        expect(result.user.dailyProgress).toEqual([daily(TODAY, { attempted: 3, correct: 3, flagged: 1, answered: 3 })]);
    });

    it("never lets the flagged counter drop below zero", () => {
        // Flagged yesterday, unflagged today.
        const yesterday = daily(YESTERDAY, { flagged: 1 });
        const user = makeUser({ questionProgress: [progress("3", { flagged: true })], dailyProgress: [yesterday] });

        const result = toggleFlag(user, makeQuestion("3"), NOW);

        expect(result.flagged).toBe(false);
        expect(result.user.dailyProgress).toEqual([yesterday, daily(TODAY)]);
        expect(result.user.dailyProgress[0]).toBe(yesterday);
    });

    it("returns to the start when toggled twice", () => {
        const once = toggleFlag(makeUser(), makeQuestion("3"), NOW);
        const twice = toggleFlag(once.user, makeQuestion("3"), NOW);

        expect(once.flagged).toBe(true);
        expect(twice.flagged).toBe(false);
        expect(twice.user.questionProgress).toEqual([progress("3")]);
        expect(twice.user.dailyProgress).toEqual([daily(TODAY)]);
    });

    it("leaves the review schedule and the learner record it receives alone", () => {
        const schedule = [item("3", 4, "2026-10-15")];
        const user = deepFreeze(
            makeUser({
                questionProgress: [progress("3", { answeredCorrectly: true, answerSelected: "a" })],
                dailyProgress: [daily(TODAY, { attempted: 1, correct: 1, answered: 1 })],
                reviewSchedule: schedule,
            }),
        );
        const snapshot = JSON.stringify(user);

        const result = toggleFlag(user, makeQuestion("3"), NOW);

        expect(JSON.stringify(user)).toBe(snapshot);
        expect(result.user).not.toBe(user);
        expect(result.user.reviewSchedule).toBe(schedule);
    });
});

describe("gradeMock", () => {
    it("grades answered, wrong, and unanswered questions in exam order", () => {
        const questions = [makeQuestion("12", "c"), makeQuestion("3", "a"), makeQuestion("BE-2", "d"), makeQuestion("40", "b")];

        const test = gradeMock(questions, { "12": "c", "3": "b", "BE-2": null }, ["3", "BE-2"], gradeOptions());

        expect(test.questions).toEqual([
            { num: "12", answeredCorrectly: true, answerSelected: "c", skipped: false, flagged: false },
            { num: "3", answeredCorrectly: false, answerSelected: "b", skipped: false, flagged: true },
            { num: "BE-2", answeredCorrectly: false, answerSelected: "", skipped: true, flagged: true },
            { num: "40", answeredCorrectly: false, answerSelected: "", skipped: true, flagged: false },
        ]);
    });

    it("stores the start time, the duration, and the exam settings", () => {
        const test = gradeMock([makeQuestion("1")], { "1": "a" }, [], gradeOptions({ passMark: 15, examType: "lid", timed: false }));

        expect(test).toEqual({
            datetime: STARTED.toISOString(),
            timeTake: "1530",
            passed: false,
            cancelled: false,
            questions: [{ num: "1", answeredCorrectly: true, answerSelected: "a", skipped: false, flagged: false }],
            passMark: 15,
            examType: "lid",
            timed: false,
        });
    });

    it.each<[number, number, boolean]>([
        [17, 17, true],
        [17, 16, false],
        [17, 15, false],
        [17, 33, true],
        [15, 15, true],
        [15, 14, false],
        [15, 16, true],
    ])("with pass mark %i and %i correct answers sets passed to %s", (passMark, correct, passed) => {
        const questions = examQuestions();

        const test = gradeMock(questions, answersWith(questions, correct), [], gradeOptions({ passMark }));

        expect(test.passed).toBe(passed);
        expect(test.passMark).toBe(passMark);
        expect(test.questions.filter((entry) => entry.answeredCorrectly).length).toBe(correct);
    });

    it("counts unanswered questions as not correct", () => {
        const questions = examQuestions();

        const seventeen = gradeMock(questions, answersFor(questions, (i) => (i < 17 ? "a" : null)), [], gradeOptions());
        const sixteen = gradeMock(questions, answersFor(questions, (i) => (i < 16 ? "a" : undefined)), [], gradeOptions());

        expect(seventeen.passed).toBe(true);
        expect(sixteen.passed).toBe(false);
        expect(sixteen.questions.filter((entry) => entry.skipped)).toHaveLength(17);
    });

    it("never passes a cancelled exam", () => {
        const questions = examQuestions();

        const test = gradeMock(questions, answersWith(questions, 33), [], gradeOptions({ cancelled: true }));

        expect(test.passed).toBe(false);
        expect(test.cancelled).toBe(true);
        expect(test.questions.every((entry) => entry.answeredCorrectly)).toBe(true);
    });

    it.each<[number, string]>([
        [0, "0"],
        [999, "0"],
        [59_999, "59"],
        [60_000, "60"],
        [3_600_000, "3600"],
        [-5_000, "0"],
    ])("stores %i ms as %s whole seconds", (elapsed, expected) => {
        const test = gradeMock([], {}, [], gradeOptions({ finishedAt: new Date(STARTED.getTime() + elapsed) }));

        expect(test.timeTake).toBe(expected);
    });

    it("ignores answers and flags for questions outside the exam", () => {
        const test = gradeMock([makeQuestion("1")], { "1": "a", "2": "b" }, ["2", "99"], gradeOptions());

        expect(test.questions).toEqual([
            { num: "1", answeredCorrectly: true, answerSelected: "a", skipped: false, flagged: false },
        ]);
    });

    it("grades an exam without questions", () => {
        const test = gradeMock([], {}, [], gradeOptions());

        expect(test.questions).toEqual([]);
        expect(test.passed).toBe(false);
    });

    it("does not change its inputs", () => {
        const questions = deepFreeze(examQuestions());
        const answers = deepFreeze(answersWith(questions, 20));
        const flagged = deepFreeze(["1", "2"]);
        const options = deepFreeze(gradeOptions());

        const test = gradeMock(questions, answers, flagged, options);

        expect(test.questions).toHaveLength(33);
        expect(test.passed).toBe(true);
    });
});

describe("mockScore", () => {
    it("counts correct, wrong, and unanswered questions", () => {
        const questions = [makeQuestion("1", "a"), makeQuestion("2", "b"), makeQuestion("3", "c"), makeQuestion("4", "d")];

        const test = gradeMock(questions, { "1": "a", "2": "a", "3": "c" }, ["4"], gradeOptions());

        expect(mockScore(test)).toEqual({ correct: 2, wrong: 1, unanswered: 1, total: 4 });
    });

    it("adds up to the number of questions of a full exam", () => {
        const questions = examQuestions();
        const answers = answersFor(questions, (i) => (i < 20 ? "a" : i < 30 ? "b" : null));

        expect(mockScore(gradeMock(questions, answers, [], gradeOptions()))).toEqual({
            correct: 20,
            wrong: 10,
            unanswered: 3,
            total: 33,
        });
    });

    it("reads mock exams stored by older versions", () => {
        // Older versions stored only the questions the learner reached. A question
        // flagged without an answer has `skipped: false` and an empty answer.
        const legacy: MockTestProgress = {
            datetime: "2025-03-01T09:00:00.000Z",
            timeTake: "754",
            passed: false,
            cancelled: true,
            questions: [
                { num: "5", answeredCorrectly: true, answerSelected: "a", skipped: false, flagged: false },
                { num: "17", answeredCorrectly: false, answerSelected: "c", skipped: false, flagged: false },
                { num: "88", answeredCorrectly: false, answerSelected: "", skipped: true, flagged: false },
                { num: "120", answeredCorrectly: false, answerSelected: "", skipped: false, flagged: true },
                { num: "BE-7", answeredCorrectly: null, answerSelected: null, skipped: false, flagged: false },
            ],
        };

        expect(mockScore(legacy)).toEqual({ correct: 1, wrong: 1, unanswered: 3, total: 5 });
    });

    it("returns zeros for an exam without questions", () => {
        expect(mockScore(gradeMock([], {}, [], gradeOptions()))).toEqual({ correct: 0, wrong: 0, unanswered: 0, total: 0 });
    });
});

describe("applyMockToUser", () => {
    it("adds the exam to the end of the history", () => {
        const earlier = gradeMock(
            [makeQuestion("9")],
            { "9": "a" },
            [],
            gradeOptions({ startedAt: new Date(2026, 9, 1, 9, 0), finishedAt: new Date(2026, 9, 1, 9, 30) }),
        );
        const user = makeUser({ testProgress: [earlier] });
        const test = sampleMock();

        const next = applyMockToUser(user, test, NOW);

        expect(next.testProgress).toHaveLength(2);
        expect(next.testProgress[0]).toBe(earlier);
        expect(next.testProgress[1]).toBe(test);
        expect(user.testProgress).toEqual([earlier]);
    });

    it("counts every exam question as attempted and only answered questions as answers", () => {
        const user = makeUser({
            dailyProgress: [daily(TODAY, { attempted: 5, correct: 2, incorrect: 1, skipped: 2, flagged: 1, answered: 3 })],
        });

        const next = applyMockToUser(user, sampleMock(), NOW);

        expect(next.dailyProgress).toEqual([
            daily(TODAY, { attempted: 9, correct: 4, incorrect: 2, skipped: 2, flagged: 1, answered: 6 }),
        ]);
    });

    it("starts the answered counter from correct + incorrect on entries written before 2.1", () => {
        const user = makeUser({ dailyProgress: [daily(TODAY, { attempted: 6, correct: 3, incorrect: 2, skipped: 1 })] });

        const next = applyMockToUser(user, sampleMock(), NOW);

        expect(next.dailyProgress).toEqual([
            daily(TODAY, { attempted: 10, correct: 5, incorrect: 3, skipped: 1, answered: 8 }),
        ]);
    });

    it("adds an entry for today in the Date.toDateString format", () => {
        const yesterday = daily(YESTERDAY, { attempted: 2, correct: 2, answered: 2 });

        const next = applyMockToUser(makeUser({ dailyProgress: [yesterday] }), sampleMock(), NOW);

        expect(next.dailyProgress).toEqual([yesterday, daily(TODAY, { attempted: 4, correct: 2, incorrect: 1, answered: 3 })]);
        expect(next.dailyProgress[0]).toBe(yesterday);
        expect(next.dailyProgress[1].date).toBe("Fri Oct 09 2026");
    });

    it("updates the progress of answered questions and keeps their practice flags", () => {
        const one = progress("1", { answeredCorrectly: false, answerSelected: "b", skipped: true, flagged: true });
        const two = progress("2", { answeredCorrectly: true, answerSelected: "b" });
        const user = makeUser({ questionProgress: [one, two] });

        const next = applyMockToUser(user, sampleMock(), NOW);

        // Flags set during the exam ("2" and "4") do not become practice flags.
        expect(next.questionProgress).toEqual([
            { num: "1", answeredCorrectly: true, answerSelected: "a", skipped: false, flagged: true },
            { num: "2", answeredCorrectly: false, answerSelected: "c", skipped: false, flagged: false },
            { num: "4", answeredCorrectly: true, answerSelected: "d", skipped: false, flagged: false },
        ]);
    });

    it("leaves unanswered questions untouched", () => {
        const three = progress("3", { answeredCorrectly: true, answerSelected: "c", flagged: true });
        const threeReview = item("3", 4, "2026-10-20");
        const user = makeUser({ questionProgress: [three], reviewSchedule: [threeReview] });

        const next = applyMockToUser(user, sampleMock(), NOW);

        expect(next.questionProgress[0]).toBe(three);
        expect(next.questionProgress.map((entry) => entry.num)).toEqual(["3", "1", "2", "4"]);
        expect(next.reviewSchedule?.[0]).toBe(threeReview);
        expect(next.reviewSchedule?.map((entry) => entry.num)).toEqual(["3", "1", "2", "4"]);
    });

    it("schedules answered questions for review", () => {
        const user = makeUser({ reviewSchedule: [item("1", 2, TODAY), item("2", 4, "2026-10-12")] });

        const next = applyMockToUser(user, sampleMock(), NOW);

        expect(next.reviewSchedule).toEqual([
            { num: "1", box: 3, due: "2026-10-13", lastReviewed: TODAY },
            { num: "2", box: 1, due: TODAY, lastReviewed: TODAY },
            { num: "4", box: 2, due: "2026-10-11", lastReviewed: TODAY },
        ]);
    });

    it("starts a review schedule for records written before 2.1", () => {
        const user = makeUser();

        const next = applyMockToUser(user, sampleMock(), NOW);

        expect(next.reviewSchedule).toEqual([
            { num: "1", box: 2, due: "2026-10-11", lastReviewed: TODAY },
            { num: "2", box: 1, due: TODAY, lastReviewed: TODAY },
            { num: "4", box: 2, due: "2026-10-11", lastReviewed: TODAY },
        ]);
        expect(user.reviewSchedule).toBeUndefined();
    });

    it("only counts attempts for an exam without answers", () => {
        const questions = examQuestions();
        const test = gradeMock(questions, {}, [], gradeOptions({ cancelled: true }));
        const schedule = [item("1", 2, TODAY, YESTERDAY)];
        const user = makeUser({
            questionProgress: [progress("1", { flagged: true })],
            reviewSchedule: schedule,
            dailyProgress: [daily(TODAY, { attempted: 1, correct: 1 })],
        });

        const next = applyMockToUser(user, test, NOW);

        expect(next.testProgress).toEqual([test]);
        expect(next.questionProgress).toBe(user.questionProgress);
        expect(next.reviewSchedule).toBe(schedule);
        expect(next.dailyProgress).toEqual([daily(TODAY, { attempted: 34, correct: 1 })]);
        expect(next.dailyProgress[0]).not.toHaveProperty("answered");
    });

    it("does not add a review schedule to older records when nothing was answered", () => {
        const test = gradeMock([makeQuestion("1")], {}, [], gradeOptions());

        const next = applyMockToUser(makeUser(), test, NOW);

        expect(next).not.toHaveProperty("reviewSchedule");
        expect(next.questionProgress).toEqual([]);
    });

    it("agrees with mockScore", () => {
        const questions = examQuestions();
        const test = gradeMock(questions, answersFor(questions, (i) => (i < 20 ? "a" : i < 30 ? "b" : null)), [], gradeOptions());
        const score = mockScore(test);

        const next = applyMockToUser(makeUser(), test, NOW);

        expect(next.dailyProgress).toEqual([
            daily(TODAY, {
                attempted: score.total,
                correct: score.correct,
                incorrect: score.wrong,
                answered: score.correct + score.wrong,
            }),
        ]);
        expect(next.questionProgress).toHaveLength(score.correct + score.wrong);
        expect(next.reviewSchedule).toHaveLength(score.correct + score.wrong);
    });

    it("does not change the learner record or the exam it receives", () => {
        const user = deepFreeze(
            makeUser({
                questionProgress: [progress("1", { answeredCorrectly: false, answerSelected: "c", flagged: true })],
                dailyProgress: [daily(TODAY, { attempted: 2, correct: 1, incorrect: 1 })],
                reviewSchedule: [item("1", 1, TODAY)],
                testProgress: [],
            }),
        );
        const test = deepFreeze(sampleMock());
        const snapshot = JSON.stringify({ user, test });

        const next = applyMockToUser(user, test, NOW);

        expect(JSON.stringify({ user, test })).toBe(snapshot);
        expect(next).not.toBe(user);
        expect(next.testProgress).not.toBe(user.testProgress);
        expect(next.questionProgress).not.toBe(user.questionProgress);
        expect(next.dailyProgress).not.toBe(user.dailyProgress);
        expect(next.reviewSchedule).not.toBe(user.reviewSchedule);
    });
});
