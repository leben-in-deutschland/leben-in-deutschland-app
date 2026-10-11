import { describe, expect, it } from "vitest";
import {
    answerStates,
    buildExamQuestions,
    buildReviewEntries,
    durationOf,
    elapsedSeconds,
    examHistorySummary,
    examTypeOf,
    filterReviewEntries,
    findExam,
    openItems,
    pickExamQuestions,
    recentExams,
    remainingSeconds,
    resultStatus,
    reviewCounts,
    scoreRatio,
    shuffle,
    timerTone,
    topicBreakdown,
    wasTimed,
} from "@/components/mock/exam-logic";
import { categories, type Question } from "@/types/question";
import type { MockTestProgress } from "@/types/user";
import { getQuestion, getRelevantQuestions, getStateQuestions, isStateQuestion, normalizeCategory } from "@/utils/question-bank";

const BE_GENERAL = getRelevantQuestions("BE").filter((question) => !isStateQuestion(question.num, "BE"));
const BE_STATE = getStateQuestions("BE");

/** Deterministic stand-in for Math.random. */
function seeded(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

function question(num: string, category: string, solution: Question["solution"] = "a"): Question {
    return { num, id: num, question: `Q ${num}`, a: "A", b: "B", c: "C", d: "D", solution, image: "-", category } as Question;
}

/** A mock exam the way version 2.0 stored it: no pass mark, exam type, or timer flag. */
function legacyExam(datetime: string, passed: boolean, cancelled = false): MockTestProgress {
    const nums = [...BE_GENERAL.slice(0, 30), ...BE_STATE.slice(0, 3)].map((entry) => entry.num);
    return {
        datetime,
        timeTake: "1543",
        passed,
        cancelled,
        questions: nums.map((num, index) => {
            const source = getQuestion(num)!;
            if (index % 11 === 10) {
                return { answeredCorrectly: false, answerSelected: "", num, skipped: index % 2 === 0, flagged: false };
            }
            const correct = passed ? index % 5 !== 0 : index % 3 === 0;
            const wrong = source.solution === "a" ? "b" : "a";
            return { answeredCorrectly: correct, answerSelected: correct ? source.solution : wrong, num, skipped: false, flagged: index === 4 };
        }),
    };
}

describe("shuffle", () => {
    it("keeps every item exactly once and does not touch the input", () => {
        const input = ["a", "b", "c", "d", "e"];
        const output = shuffle(input, seeded(7));
        expect(output).toHaveLength(5);
        expect([...output].sort()).toEqual([...input].sort());
        expect(input).toEqual(["a", "b", "c", "d", "e"]);
    });

    it("is deterministic for the same random source", () => {
        const items = Array.from({ length: 20 }, (_, i) => i);
        expect(shuffle(items, seeded(3))).toEqual(shuffle(items, seeded(3)));
        expect(shuffle(items, seeded(3))).not.toEqual(shuffle(items, seeded(4)));
    });
});

describe("pickExamQuestions", () => {
    it("picks 30 general and 3 state questions from the Berlin catalogue", () => {
        const picked = pickExamQuestions(BE_GENERAL, BE_STATE, seeded(1));
        expect(picked).toHaveLength(33);
        expect(picked.slice(0, 30).every((entry) => !isStateQuestion(entry.num, "BE"))).toBe(true);
        expect(picked.slice(30).every((entry) => isStateQuestion(entry.num, "BE"))).toBe(true);
    });

    it("never repeats a question", () => {
        for (let seed = 0; seed < 20; seed++) {
            const picked = pickExamQuestions(BE_GENERAL, BE_STATE, seeded(seed));
            expect(new Set(picked.map((entry) => entry.num)).size).toBe(picked.length);
        }
    });

    it("uses the whole pool before it is random", () => {
        const first = pickExamQuestions(BE_GENERAL, BE_STATE, seeded(11)).map((entry) => entry.num);
        const second = pickExamQuestions(BE_GENERAL, BE_STATE, seeded(12)).map((entry) => entry.num);
        expect(first).not.toEqual(second);
        expect(pickExamQuestions(BE_GENERAL, BE_STATE, seeded(11)).map((entry) => entry.num)).toEqual(first);
    });

    it("gives a shorter exam when a pool is smaller than requested", () => {
        const general = [question("1", "General"), question("2", "General")];
        const state = [question("BE-1", "General")];
        expect(pickExamQuestions(general, state, seeded(1))).toHaveLength(3);
        expect(pickExamQuestions([], [], seeded(1))).toEqual([]);
    });

    it("drops duplicates across both pools", () => {
        const shared = question("5", "General");
        const picked = pickExamQuestions([shared, question("6", "General")], [shared, question("BE-2", "General")], seeded(2));
        expect(picked.map((entry) => entry.num).sort()).toEqual(["5", "6", "BE-2"]);
    });

    it("honours custom counts", () => {
        expect(pickExamQuestions(BE_GENERAL, BE_STATE, seeded(1), 5, 1)).toHaveLength(6);
    });
});

describe("buildExamQuestions", () => {
    it("builds a full 33-question exam for a state", () => {
        const exam = buildExamQuestions("BE", seeded(5));
        expect(exam).toHaveLength(33);
        expect(exam.filter((entry) => isStateQuestion(entry.num, "BE"))).toHaveLength(3);
        expect(new Set(exam.map((entry) => entry.num)).size).toBe(33);
    });

    it("falls back to general questions only without a state", () => {
        const exam = buildExamQuestions("", seeded(5));
        expect(exam).toHaveLength(30);
    });
});

describe("timer helpers", () => {
    const start = new Date("2026-10-09T10:00:00.000Z");

    it("measures elapsed seconds and never goes negative", () => {
        expect(elapsedSeconds(start, start.getTime() + 90_500)).toBe(90);
        expect(elapsedSeconds(start, start.getTime() - 5_000)).toBe(0);
        expect(elapsedSeconds(start.getTime(), start.getTime() + 1_000)).toBe(1);
    });

    it("clamps the remaining time at zero", () => {
        expect(remainingSeconds(start, start.getTime())).toBe(3600);
        expect(remainingSeconds(start, start.getTime() + 3_599_000)).toBe(1);
        expect(remainingSeconds(start, start.getTime() + 4_000_000)).toBe(0);
        expect(remainingSeconds(start, start.getTime() + 30_000, 60)).toBe(30);
    });

    it("turns warning under five minutes and danger under one", () => {
        expect(timerTone(3600)).toBe("default");
        expect(timerTone(300)).toBe("default");
        expect(timerTone(299)).toBe("warning");
        expect(timerTone(60)).toBe("warning");
        expect(timerTone(59)).toBe("danger");
        expect(timerTone(0)).toBe("danger");
    });
});

describe("openItems", () => {
    const questions = [question("1", "General"), question("2", "General"), question("3", "General"), question("4", "General")];

    it("counts answered, unanswered, and flagged questions with their first positions", () => {
        const result = openItems(questions, { "1": "a", "3": "c" }, new Set(["3", "4"]));
        expect(result).toEqual({ answered: 2, unanswered: 2, flagged: 2, firstUnanswered: 1, firstFlagged: 2 });
    });

    it("reports -1 when nothing is open", () => {
        const result = openItems(questions, { "1": "a", "2": "b", "3": "c", "4": "d" }, new Set());
        expect(result.unanswered).toBe(0);
        expect(result.firstUnanswered).toBe(-1);
        expect(result.firstFlagged).toBe(-1);
    });
});

describe("stored exam helpers", () => {
    const legacy = legacyExam("2026-10-01T17:12:00.000Z", true);

    it("reads legacy exams as timed Einbürgerungstest with their duration", () => {
        expect(examTypeOf(legacy)).toBe("einbuergerung");
        expect(wasTimed(legacy)).toBe(true);
        expect(durationOf(legacy)).toBe(1543);
    });

    it("handles empty durations and explicit fields", () => {
        expect(durationOf({ ...legacy, timeTake: "" })).toBe(0);
        expect(durationOf({ ...legacy, timeTake: "abc" })).toBe(0);
        expect(examTypeOf({ ...legacy, passMark: 15 })).toBe("lid");
        expect(examTypeOf({ ...legacy, examType: "lid", passMark: 17 })).toBe("lid");
        expect(wasTimed({ ...legacy, timed: false })).toBe(false);
    });

    it("lists finished exams newest first and leaves out cancelled ones", () => {
        const user = {
            testProgress: [
                legacyExam("2026-10-01T17:12:00.000Z", false),
                legacyExam("2026-10-03T09:30:00.000Z", false, true),
                legacyExam("2026-10-07T19:05:00.000Z", true),
                legacyExam("2026-09-20T19:05:00.000Z", true),
                legacyExam("2026-09-21T19:05:00.000Z", false),
                legacyExam("2026-09-22T19:05:00.000Z", true),
                legacyExam("2026-09-23T19:05:00.000Z", true),
            ],
        };
        const recent = recentExams(user, 5);
        expect(recent).toHaveLength(5);
        expect(recent.map((test) => test.datetime)).toEqual([
            "2026-10-07T19:05:00.000Z",
            "2026-10-01T17:12:00.000Z",
            "2026-09-23T19:05:00.000Z",
            "2026-09-22T19:05:00.000Z",
            "2026-09-21T19:05:00.000Z",
        ]);
        expect(recent.some((test) => test.cancelled)).toBe(false);
        expect(examHistorySummary(user)).toEqual({ passed: 4, total: 6 });
        expect(recentExams(undefined)).toEqual([]);
        expect(examHistorySummary({ testProgress: undefined as unknown as MockTestProgress[] })).toEqual({ passed: 0, total: 0 });
    });

    it("finds an exam by raw or encoded datetime", () => {
        const user = { testProgress: [legacy] };
        expect(findExam(user, legacy.datetime)).toBe(legacy);
        expect(findExam(user, encodeURIComponent(legacy.datetime))).toBe(legacy);
        expect(findExam(user, "2020-01-01T00:00:00.000Z")).toBeUndefined();
        expect(findExam(user, null)).toBeUndefined();
        expect(findExam(user, "%E0%A4%A")).toBeUndefined();
    });

    it("tells passed, failed, and cancelled apart", () => {
        expect(resultStatus(legacy)).toBe("passed");
        expect(resultStatus({ ...legacy, passed: false })).toBe("failed");
        expect(resultStatus({ ...legacy, passed: false, cancelled: true })).toBe("cancelled");
    });

    it("turns the score into a ratio", () => {
        expect(scoreRatio(legacy)).toBeCloseTo(24 / 33);
        expect(scoreRatio({ ...legacy, questions: [] })).toBe(0);
    });
});

describe("buildReviewEntries", () => {
    const legacy = legacyExam("2026-10-01T17:12:00.000Z", true);

    it("treats empty answers as unanswered like mockScore does", () => {
        const entries = buildReviewEntries(legacy);
        expect(entries).toHaveLength(33);
        const unanswered = entries.filter((entry) => !entry.answered);
        expect(unanswered).toHaveLength(3);
        expect(unanswered.every((entry) => entry.selected === null && !entry.correct)).toBe(true);
        expect(entries.filter((entry) => entry.correct)).toHaveLength(24);
        expect(entries.filter((entry) => entry.flagged).map((entry) => entry.num)).toEqual([legacy.questions[4].num]);
        expect(entries.every((entry) => entry.question !== undefined)).toBe(true);
    });

    it("handles null answers and questions that left the catalogue", () => {
        const test: MockTestProgress = {
            ...legacy,
            questions: [
                { num: "999999", answeredCorrectly: null, answerSelected: null, skipped: false, flagged: true },
                { num: legacy.questions[0].num, answeredCorrectly: true, answerSelected: legacy.questions[0].answerSelected, skipped: false, flagged: false },
            ],
        };
        const [missing, present] = buildReviewEntries(test);
        expect(missing.question).toBeUndefined();
        expect(missing.answered).toBe(false);
        expect(missing.flagged).toBe(true);
        expect(missing.category).toBe("General");
        expect(present.question?.num).toBe(legacy.questions[0].num);
        expect(present.correct).toBe(true);
        expect(present.category).toBe(normalizeCategory(present.question?.category));
    });

    it("accepts a custom lookup", () => {
        const custom = question("42", "Elections", "c");
        const test: MockTestProgress = {
            ...legacy,
            questions: [{ num: "42", answeredCorrectly: false, answerSelected: "b", skipped: false, flagged: false }],
        };
        const [entry] = buildReviewEntries(test, () => custom);
        expect(entry.question).toBe(custom);
        expect(entry.answered).toBe(true);
        expect(entry.correct).toBe(false);
        expect(entry.category).toBe("Elections");
    });
});

describe("review filters, topics, and answer states", () => {
    const test: MockTestProgress = {
        datetime: "2026-10-09T10:00:00.000Z",
        timeTake: "600",
        passed: false,
        cancelled: false,
        passMark: 17,
        examType: "einbuergerung",
        timed: true,
        questions: [
            { num: "1", answeredCorrectly: true, answerSelected: "a", skipped: false, flagged: false },
            { num: "2", answeredCorrectly: false, answerSelected: "b", skipped: false, flagged: true },
            { num: "3", answeredCorrectly: false, answerSelected: "", skipped: true, flagged: true },
            { num: "4", answeredCorrectly: true, answerSelected: "a", skipped: false, flagged: false },
            { num: "5", answeredCorrectly: false, answerSelected: "d", skipped: false, flagged: false },
        ],
    };
    const bank: Record<string, Question> = {
        "1": question("1", "Elections"),
        "2": question("2", "Rights & Freedoms"),
        "3": question("3", "Elections"),
        "4": question("4", "History & Geography"),
        "5": question("5", "Rights & Freedoms"),
    };
    const entries = buildReviewEntries(test, (num) => bank[num]);

    it("filters by wrong, unanswered, and flagged", () => {
        expect(filterReviewEntries(entries, "all").map((entry) => entry.num)).toEqual(["1", "2", "3", "4", "5"]);
        expect(filterReviewEntries(entries, "wrong").map((entry) => entry.num)).toEqual(["2", "5"]);
        expect(filterReviewEntries(entries, "unanswered").map((entry) => entry.num)).toEqual(["3"]);
        expect(filterReviewEntries(entries, "flagged").map((entry) => entry.num)).toEqual(["2", "3"]);
        expect(reviewCounts(entries)).toEqual({ all: 5, wrong: 2, unanswered: 1, flagged: 2 });
    });

    it("groups correct answers per topic in catalogue order", () => {
        const topics = topicBreakdown(entries);
        expect(topics).toEqual([
            { category: "Rights & Freedoms", correct: 0, total: 2 },
            { category: "History & Geography", correct: 1, total: 1 },
            { category: "Elections", correct: 1, total: 2 },
        ]);
        const order = topics.map((stat) => categories.indexOf(stat.category));
        expect(order).toEqual([...order].sort((a, b) => a - b));
        expect(topicBreakdown([])).toEqual([]);
    });

    it("grades the chosen answer, reveals the solution, and dims the rest", () => {
        const [right, wrong, open] = entries;
        expect(answerStates(right)).toEqual({ a: "correct", b: "dimmed", c: "dimmed", d: "dimmed" });
        expect(answerStates(wrong)).toEqual({ a: "reveal", b: "wrong", c: "dimmed", d: "dimmed" });
        expect(answerStates(open)).toEqual({ a: "reveal", b: "dimmed", c: "dimmed", d: "dimmed" });
    });

    it("dims everything when the question is unknown", () => {
        const [entry] = buildReviewEntries({ ...test, questions: [test.questions[1]] }, () => undefined);
        expect(answerStates(entry)).toEqual({ a: "dimmed", b: "wrong", c: "dimmed", d: "dimmed" });
    });
});
