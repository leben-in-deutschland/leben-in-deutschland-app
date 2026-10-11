import { describe, expect, it } from "vitest";
import { binomialAtLeast, computeReadiness } from "@/utils/readiness-logic";
import { getRelevantQuestions } from "@/utils/question-bank";
import { DEFAULT_PREFERENCES } from "@/utils/user-defaults";
import type { ExamType, MockTestProgress, User, UserQuestionProgress } from "@/types/user";

/** Minimal record as older app versions wrote it: none of the 2.1 fields. */
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

function withExamType(examType: ExamType, overrides: Partial<User> = {}): User {
    return makeUser({ preferences: { ...DEFAULT_PREFERENCES, examType }, ...overrides });
}

function progress(
    num: string,
    answeredCorrectly: boolean | null,
    extra: Partial<UserQuestionProgress> = {},
): UserQuestionProgress {
    return {
        num,
        answeredCorrectly,
        skipped: answeredCorrectly === null,
        answerSelected: answeredCorrectly === null ? null : answeredCorrectly ? "a" : "b",
        flagged: false,
        ...extra,
    };
}

/** The Berlin catalogue in catalogue order: 300 general questions, then BE-1 to BE-10. */
const BE_NUMS = getRelevantQuestions("BE").map((question) => question.num);

/** The first `known` catalogue questions answered right, the next `wrong` ones answered wrong. */
function catalogueProgress(known: number, wrong = 0): UserQuestionProgress[] {
    return BE_NUMS.slice(0, known + wrong).map((num, index) => progress(num, index < known));
}

interface MockOptions {
    passed?: boolean;
    cancelled?: boolean;
    /** Questions stored in the record (33 for a complete exam). */
    questions?: number;
}

/** A mock exam whose first `correct` questions were answered right. */
function mock(correct: number, options: MockOptions = {}): MockTestProgress {
    const count = options.questions ?? 33;
    return {
        datetime: "2026-10-01T10:00:00.000Z",
        timeTake: "1500",
        passed: options.passed ?? correct >= 17,
        cancelled: options.cancelled ?? false,
        questions: Array.from({ length: count }, (_, index) => progress(String(index + 1), index < correct)),
    };
}

function deepFreeze<T>(value: T): T {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const key of Object.keys(value as object)) {
            deepFreeze((value as Record<string, unknown>)[key]);
        }
    }
    return value;
}

/** For tail probabilities far below the absolute precision of toBeCloseTo. */
function expectRelativelyClose(actual: number, expected: number, digits = 9): void {
    expect(actual / expected).toBeCloseTo(1, digits);
}

describe("binomialAtLeast", () => {
    it("is exactly one half for 33 fair trials and k = 17 (symmetry, no middle term)", () => {
        expect(binomialAtLeast(33, 0.5, 17)).toBeCloseTo(0.5, 14);
    });

    it.each([
        { n: 33, p: 0.5, k: 15, expected: 0.7565748791676015 },
        { n: 33, p: 0.25, k: 17, expected: 0.0009509599956171567 },
        { n: 33, p: 0.25, k: 15, expected: 0.008438697738270471 },
        { n: 33, p: 0.75, k: 17, expected: 0.9990490400043829 },
        { n: 33, p: 0.75, k: 15, expected: 0.9999314333410592 },
        { n: 33, p: 0.6, k: 17, expected: 0.8789013078056245 },
        { n: 33, p: 0.7, k: 17, expected: 0.9921793376606215 },
        { n: 10, p: 0.3, k: 3, expected: 0.6172172136 },
        { n: 3, p: 0.2, k: 2, expected: 0.104 },
        { n: 2, p: 0.5, k: 1, expected: 0.75 },
        { n: 1, p: 0.3, k: 1, expected: 0.3 },
    ])("matches the exact value for n = $n, p = $p, k = $k", ({ n, p, k, expected }) => {
        expect(binomialAtLeast(n, p, k)).toBeCloseTo(expected, 12);
    });

    it("returns 1 when k <= 0, whatever p is", () => {
        for (const k of [0, -1, -Infinity]) {
            for (const p of [0, 0.3, 1]) {
                expect(binomialAtLeast(33, p, k)).toBe(1);
            }
        }
        expect(binomialAtLeast(0, 0.5, 0)).toBe(1);
    });

    it("returns 0 when k > n", () => {
        expect(binomialAtLeast(33, 0.9, 34)).toBe(0);
        expect(binomialAtLeast(33, 1, 34)).toBe(0);
        expect(binomialAtLeast(0, 0.5, 1)).toBe(0);
        expect(binomialAtLeast(33, 0.5, Infinity)).toBe(0);
    });

    it("handles p = 0 and p = 1", () => {
        expect(binomialAtLeast(33, 0, 1)).toBe(0);
        expect(binomialAtLeast(33, 0, 0)).toBe(1);
        expect(binomialAtLeast(33, 1, 17)).toBe(1);
        expect(binomialAtLeast(33, 1, 33)).toBe(1);
    });

    it("treats p outside 0..1 as 0 or 1 and invalid input as no chance", () => {
        expect(binomialAtLeast(33, -0.2, 1)).toBe(0);
        expect(binomialAtLeast(33, 1.5, 33)).toBe(1);
        expect(binomialAtLeast(33, Number.NaN, 1)).toBe(0);
        expect(binomialAtLeast(33, 0.5, Number.NaN)).toBe(0);
        expect(binomialAtLeast(Number.NaN, 0.5, 1)).toBe(0);
    });

    it("rounds n down and k up to whole numbers", () => {
        expect(binomialAtLeast(33.9, 0.5, 16.2)).toBeCloseTo(binomialAtLeast(33, 0.5, 17), 15);
        expect(binomialAtLeast(33, 0.5, 16.2)).toBeCloseTo(0.5, 14);
    });

    it("keeps relative precision far out in the tails", () => {
        expectRelativelyClose(binomialAtLeast(33, 0.01, 33), 1e-66);
        expectRelativelyClose(binomialAtLeast(33, 0.01, 30), 5.29912954e-57);
        expectRelativelyClose(binomialAtLeast(33, 0.5, 33), 2 ** -33);
        expect(binomialAtLeast(33, 0.5, 1)).toBeCloseTo(1 - 2 ** -33, 14);
    });

    it("keeps full precision just below 1", () => {
        // 1 - P(X >= k) = P(X <= k - 1), compared against exact lower tails.
        expectRelativelyClose(1 - binomialAtLeast(33, 0.75, 15), 6.856665894084025e-5);
        expectRelativelyClose(1 - binomialAtLeast(33, 0.9, 17), 2.395946682807042e-9, 6);
        expect(binomialAtLeast(33, 0.9, 26)).toBeCloseTo(1 - 0.014101795875119387, 15);
        expect(binomialAtLeast(33, 0.9, 2)).toBe(1);
    });

    it("stays finite and accurate for large n, where plain coefficients overflow", () => {
        expect(binomialAtLeast(2000, 0.5, 1000)).toBeCloseTo(0.5089195055729272, 10);
        expect(binomialAtLeast(5000, 0.5, 2500)).toBeCloseTo(0.50564161374774, 10);
        expect(binomialAtLeast(2000, 0.3, 500)).toBeCloseTo(0.9999996939676451, 10);
        expectRelativelyClose(binomialAtLeast(2000, 0.3, 700), 8.394586640059429e-7, 8);
    });

    it("adds up with the lower tail to 1", () => {
        // P(X <= k - 1) = P(n - X >= n - k + 1), and n - X ~ Binomial(n, 1 - p).
        for (const [n, p, k] of [
            [33, 0.37, 17],
            [33, 0.8, 15],
            [20, 0.1, 3],
            [7, 0.5, 4],
        ]) {
            expect(binomialAtLeast(n, p, k) + binomialAtLeast(n, 1 - p, n - k + 1)).toBeCloseTo(1, 13);
        }
    });

    it("falls as k grows and rises with p, always within 0..1", () => {
        const ps = [0.001, 0.1, 0.25, 0.5, 0.625, 0.9, 0.999];
        for (const p of ps) {
            let previous = Infinity;
            for (let k = 0; k <= 34; k++) {
                const value = binomialAtLeast(33, p, k);
                expect(value).toBeGreaterThanOrEqual(0);
                expect(value).toBeLessThanOrEqual(1);
                expect(value).toBeLessThanOrEqual(previous);
                previous = value;
            }
        }
        for (const k of [1, 15, 17, 33]) {
            for (let i = 1; i < ps.length; i++) {
                expect(binomialAtLeast(33, ps[i], k)).toBeGreaterThanOrEqual(binomialAtLeast(33, ps[i - 1], k));
            }
        }
    });
});

describe("computeReadiness", () => {
    it("scores an empty legacy record as a fresh start", () => {
        const readiness = computeReadiness(makeUser());
        expect(readiness).toEqual({
            score: 0,
            mastery: 0,
            coverage: 0,
            known: 0,
            answered: 0,
            total: 310,
            mockAverage: null,
            recentMocks: 0,
            recentPasses: 0,
            passChance: expect.any(Number),
            status: "start",
        });
        // Pure guessing (1 in 4) against the default pass mark of 17.
        expect(readiness.passChance).toBeCloseTo(0.0009509599956171567, 12);
    });

    it("counts only questions of the learner's catalogue", () => {
        const user = makeUser({
            questionProgress: [
                progress("1", true),
                progress("2", false),
                progress("BE-1", true),
                progress("BY-1", true),
                progress("BY-2", false),
                progress("999", true),
                progress("XX-1", true),
            ],
        });
        const readiness = computeReadiness(user);
        expect(readiness.total).toBe(310);
        expect(readiness.known).toBe(2);
        expect(readiness.answered).toBe(3);
        expect(readiness.mastery).toBeCloseTo(2 / 310, 15);
        expect(readiness.coverage).toBeCloseTo(3 / 310, 15);
    });

    it("follows the learner's current state", () => {
        const questionProgress = [progress("1", true), progress("BE-1", true), progress("BY-1", true), progress("BY-2", false)];
        const bavaria = computeReadiness(makeUser({ state: { stateName: "Bayern", stateCode: "BY" }, questionProgress }));
        expect(bavaria.total).toBe(310);
        expect(bavaria.known).toBe(2);
        expect(bavaria.answered).toBe(3);
    });

    it("uses only the general questions when no state is set", () => {
        const user = makeUser({
            state: { stateName: "", stateCode: "" },
            questionProgress: [progress("1", true), progress("BE-1", true)],
        });
        const readiness = computeReadiness(user);
        expect(readiness.total).toBe(300);
        expect(readiness.known).toBe(1);
        expect(readiness.answered).toBe(1);
    });

    it("counts right answers as known, wrong ones as answered, and skips as neither", () => {
        const user = makeUser({
            questionProgress: [
                progress("1", true),
                progress("2", false),
                progress("3", null),
                progress("4", null, { skipped: false, flagged: true }),
                // Skipped after a right answer: the answer stays on record.
                progress("5", true, { skipped: true }),
            ],
        });
        const readiness = computeReadiness(user);
        expect(readiness.known).toBe(2);
        expect(readiness.answered).toBe(3);
    });

    it("counts a duplicated question once, using its first entry (the one the app updates)", () => {
        const user = makeUser({
            questionProgress: [progress("1", true), progress("1", false), progress("2", false), progress("2", true)],
        });
        const readiness = computeReadiness(user);
        expect(readiness.known).toBe(1);
        expect(readiness.answered).toBe(2);
    });

    it("skips broken entries of older records", () => {
        const user = makeUser({
            questionProgress: [
                null as unknown as UserQuestionProgress,
                { num: "1", skipped: false, answerSelected: null, flagged: false } as unknown as UserQuestionProgress,
                progress("2", true),
            ],
            testProgress: [null as unknown as MockTestProgress],
        });
        const readiness = computeReadiness(user);
        expect(readiness.known).toBe(1);
        expect(readiness.answered).toBe(1);
        expect(readiness.recentMocks).toBe(0);
        expect(readiness.mockAverage).toBeNull();
    });

    it("caps the score at 85 without mock exams, even when every question is known", () => {
        const readiness = computeReadiness(makeUser({ questionProgress: catalogueProgress(310) }));
        expect(readiness.known).toBe(310);
        expect(readiness.mastery).toBe(1);
        expect(readiness.coverage).toBe(1);
        expect(readiness.score).toBe(85);
        expect(readiness.status).toBe("close");
        expect(readiness.passChance).toBe(1);
    });

    it("scales mastery by 0.85 without mock exams", () => {
        const half = computeReadiness(makeUser({ questionProgress: catalogueProgress(155) }));
        expect(half.mastery).toBe(0.5);
        expect(half.coverage).toBe(0.5);
        expect(half.score).toBe(43); // round(42.5)
        expect(half.status).toBe("building");
        // Known: 1, unknown: guessed 1 in 4.
        expect(half.passChance).toBeCloseTo(binomialAtLeast(33, 0.625, 17), 14);

        const allTried = computeReadiness(makeUser({ questionProgress: catalogueProgress(155, 155) }));
        expect(allTried.mastery).toBe(0.5);
        expect(allTried.coverage).toBe(1);
        expect(allTried.score).toBe(43);
    });

    it("blends mastery (70%) with the recent mock average (30%)", () => {
        const user = makeUser({
            questionProgress: catalogueProgress(155),
            testProgress: [mock(33), mock(0), mock(33)],
        });
        const readiness = computeReadiness(user);
        expect(readiness.recentMocks).toBe(3);
        expect(readiness.recentPasses).toBe(2);
        expect(readiness.mockAverage).toBeCloseTo(2 / 3, 15);
        expect(readiness.score).toBe(55);
        expect(readiness.status).toBe("building");
        const questionChance = 0.5 * (0.5 + 0.5 * 0.25) + 0.5 * (2 / 3);
        expect(readiness.passChance).toBeCloseTo(binomialAtLeast(33, questionChance, 17), 14);
    });

    it("lets a weak catalogue and strong mocks meet in the middle", () => {
        expect(computeReadiness(makeUser({ testProgress: [mock(33)] })).score).toBe(30);
        expect(computeReadiness(makeUser({ questionProgress: catalogueProgress(310), testProgress: [mock(0)] })).score).toBe(70);
    });

    it("scores a mock exam as its right answers out of 33", () => {
        // An incomplete record still counts against all 33 questions.
        const short = computeReadiness(makeUser({ testProgress: [mock(11, { questions: 11 })] }));
        expect(short.mockAverage).toBeCloseTo(1 / 3, 15);

        // A broken record with more than 33 right answers is capped.
        const broken = computeReadiness(
            makeUser({ questionProgress: catalogueProgress(310), testProgress: [mock(40, { questions: 40 })] }),
        );
        expect(broken.mockAverage).toBe(1);
        expect(broken.score).toBe(100);
    });

    it("ignores cancelled mock exams", () => {
        const user = makeUser({
            testProgress: [mock(33), mock(0, { cancelled: true, passed: true })],
        });
        const readiness = computeReadiness(user);
        expect(readiness.recentMocks).toBe(1);
        expect(readiness.mockAverage).toBe(1);
        expect(readiness.recentPasses).toBe(1);

        const onlyCancelled = computeReadiness(
            makeUser({ questionProgress: catalogueProgress(310), testProgress: [mock(33, { cancelled: true })] }),
        );
        expect(onlyCancelled.recentMocks).toBe(0);
        expect(onlyCancelled.mockAverage).toBeNull();
        expect(onlyCancelled.score).toBe(85);
    });

    it("counts mock exams without a cancelled flag", () => {
        const legacy = { ...mock(22), cancelled: undefined } as unknown as MockTestProgress;
        const readiness = computeReadiness(makeUser({ testProgress: [legacy] }));
        expect(readiness.recentMocks).toBe(1);
        expect(readiness.mockAverage).toBeCloseTo(22 / 33, 15);
        expect(readiness.recentPasses).toBe(1);
    });

    it("uses only the last three mock exams that were not cancelled", () => {
        const user = makeUser({
            testProgress: [mock(33), mock(33), mock(0), mock(33, { cancelled: true }), mock(11), mock(22)],
        });
        const readiness = computeReadiness(user);
        expect(readiness.recentMocks).toBe(3);
        // 0, 11, and 22 right answers.
        expect(readiness.mockAverage).toBeCloseTo(1 / 3, 15);
        expect(readiness.recentPasses).toBe(1);
    });

    it("uses fewer than three mock exams when that is all there is", () => {
        const readiness = computeReadiness(makeUser({ testProgress: [mock(33), mock(22)] }));
        expect(readiness.recentMocks).toBe(2);
        expect(readiness.mockAverage).toBeCloseTo(55 / 66, 15);
        expect(readiness.recentPasses).toBe(2);
    });

    it("takes passes from the stored result", () => {
        const failedRecords = computeReadiness(makeUser({ testProgress: [mock(20, { passed: false }), mock(20, { passed: false })] }));
        expect(failedRecords.recentPasses).toBe(0);

        const lidPasses = computeReadiness(makeUser({ testProgress: [mock(15, { passed: true }), mock(15, { passed: true })] }));
        expect(lidPasses.recentPasses).toBe(2);
    });

    it.each([
        { known: 0, score: 0, status: "start" },
        { known: 144, score: 39, status: "start" },
        { known: 145, score: 40, status: "building" },
        { known: 253, score: 69, status: "building" },
        { known: 254, score: 70, status: "close" },
        { known: 308, score: 84, status: "close" },
        { known: 310, score: 85, status: "close" },
    ])("is $status with a score of $score ($known questions known, no mocks)", ({ known, score, status }) => {
        const readiness = computeReadiness(makeUser({ questionProgress: catalogueProgress(known) }));
        expect(readiness.score).toBe(score);
        expect(readiness.status).toBe(status);
    });

    it("is ready only with a score of at least 85 and two recent passes", () => {
        const all = catalogueProgress(310);
        const ready = (testProgress: MockTestProgress[]) =>
            computeReadiness(makeUser({ questionProgress: all, testProgress }));

        const threePasses = ready([mock(17), mock(17), mock(17)]);
        expect(threePasses.score).toBe(85);
        expect(threePasses.status).toBe("ready");

        const twoPasses = ready([mock(17, { passed: true }), mock(17, { passed: false }), mock(17, { passed: true })]);
        expect(twoPasses.score).toBe(85);
        expect(twoPasses.status).toBe("ready");

        const onePass = ready([mock(17, { passed: false }), mock(17, { passed: false }), mock(17, { passed: true })]);
        expect(onePass.score).toBe(85);
        expect(onePass.status).toBe("close");

        // 84.5 rounds up to 85.
        const roundedUp = ready([mock(16, { passed: true }), mock(16, { passed: true }), mock(16, { passed: true })]);
        expect(roundedUp.score).toBe(85);
        expect(roundedUp.status).toBe("ready");

        const justBelow = ready([mock(15, { passed: true }), mock(15, { passed: true }), mock(15, { passed: true })]);
        expect(justBelow.score).toBe(84);
        expect(justBelow.status).toBe("close");

        const perfect = ready([mock(33), mock(33)]);
        expect(perfect.score).toBe(100);
        expect(perfect.status).toBe("ready");
        expect(perfect.passChance).toBe(1);
    });

    it("never reaches ready without a passed mock exam, even with a perfect catalogue", () => {
        const readiness = computeReadiness(
            makeUser({ questionProgress: catalogueProgress(310), testProgress: [mock(33, { passed: false })] }),
        );
        expect(readiness.score).toBe(100);
        expect(readiness.status).toBe("close");
    });

    it("uses the pass mark of the learner's exam type by default", () => {
        const questionProgress = catalogueProgress(155);
        const questionChance = 0.5 + 0.5 * 0.25;

        const legacy = computeReadiness(makeUser({ questionProgress }));
        const einbuergerung = computeReadiness(withExamType("einbuergerung", { questionProgress }));
        const lid = computeReadiness(withExamType("lid", { questionProgress }));

        expect(legacy.passChance).toBeCloseTo(binomialAtLeast(33, questionChance, 17), 14);
        expect(einbuergerung.passChance).toBeCloseTo(binomialAtLeast(33, questionChance, 17), 14);
        expect(lid.passChance).toBeCloseTo(binomialAtLeast(33, questionChance, 15), 14);
        expect(lid.passChance).toBeGreaterThan(einbuergerung.passChance);
    });

    it("lets an explicit pass mark override the exam type", () => {
        const questionProgress = catalogueProgress(155);
        const lidUser = withExamType("lid", { questionProgress });
        const einbuergerungUser = withExamType("einbuergerung", { questionProgress });

        expect(computeReadiness(lidUser, 17).passChance).toBe(computeReadiness(einbuergerungUser).passChance);
        expect(computeReadiness(einbuergerungUser, 15).passChance).toBe(computeReadiness(lidUser).passChance);
        expect(computeReadiness(einbuergerungUser, 15).passChance).toBeGreaterThan(
            computeReadiness(einbuergerungUser, 17).passChance,
        );
    });

    it("keeps the score and status independent of the pass mark", () => {
        const user = makeUser({ questionProgress: catalogueProgress(254), testProgress: [mock(20), mock(25)] });
        const strict = computeReadiness(user, 17);
        const lenient = computeReadiness(user, 15);
        expect(lenient.score).toBe(strict.score);
        expect(lenient.status).toBe(strict.status);
        expect(lenient.passChance).toBeGreaterThan(strict.passChance);
    });

    it("always returns a whole-number score between 0 and 100", () => {
        const users = [
            makeUser(),
            makeUser({ questionProgress: catalogueProgress(17, 40) }),
            makeUser({ questionProgress: catalogueProgress(201, 9), testProgress: [mock(5), mock(31)] }),
            makeUser({ questionProgress: catalogueProgress(310), testProgress: [mock(33), mock(33), mock(33)] }),
        ];
        for (const user of users) {
            const { score, passChance } = computeReadiness(user);
            expect(Number.isInteger(score)).toBe(true);
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
            expect(passChance).toBeGreaterThanOrEqual(0);
            expect(passChance).toBeLessThanOrEqual(1);
        }
    });

    it("does not modify the user", () => {
        const user = makeUser({
            preferences: { ...DEFAULT_PREFERENCES, examType: "lid" },
            questionProgress: [...catalogueProgress(100, 20), progress("1", false), progress("BY-1", true)],
            testProgress: [mock(20), mock(10, { cancelled: true }), mock(30)],
        });
        const before = JSON.stringify(user);
        deepFreeze(user);
        expect(() => computeReadiness(user)).not.toThrow();
        expect(JSON.stringify(user)).toBe(before);
    });
});
