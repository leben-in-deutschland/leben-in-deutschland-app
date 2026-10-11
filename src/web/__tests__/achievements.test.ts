import { afterEach, describe, expect, it, vi } from "vitest";
import { getTranslations } from "@/data/data";
import type { Question } from "@/types/question";
import type { MockTestProgress, UnlockedAchievement, User, UserDailyProgress, UserQuestionProgress } from "@/types/user";
import {
    ACHIEVEMENTS,
    buildAchievementContext,
    isUnlocked,
    newlyEarned,
    unlockAchievements,
    type AchievementContext,
} from "@/utils/achievements";
import { addDays, parseDayKey } from "@/utils/date-utils";
import {
    getQuestionBank,
    getRelevantQuestions,
    getStateQuestions,
    isGeneralQuestion,
    normalizeCategory,
} from "@/utils/question-bank";
import { computeReadiness, type Readiness } from "@/utils/readiness-logic";
import { computeStreak, type StreakInfo } from "@/utils/streak-logic";
import { DEFAULT_PREFERENCES } from "@/utils/user-defaults";

/* "Today" is Friday 2026-10-09. */
const TODAY = "2026-10-09";
const NOW = new Date(2026, 9, 9, 18, 30);
const EARLIER = "2026-09-01T10:00:00.000Z";

const ALL_IDS = [
    "first_answer",
    "answers_50",
    "answers_150",
    "catalogue_complete",
    "all_known",
    "streak_3",
    "streak_7",
    "streak_30",
    "streak_100",
    "goal_first",
    "goal_7",
    "mock_first",
    "mock_pass",
    "mock_perfect",
    "mock_three_in_row",
    "state_expert",
    "category_master",
    "exam_ready",
];

/** The Berlin catalogue in catalogue order: 300 general questions, then BE-1 to BE-10. */
const BE_NUMS = getRelevantQuestions("BE").map((question) => question.num);
const GENERAL_NUMS = BE_NUMS.filter(isGeneralQuestion);
const BE_STATE_NUMS = getStateQuestions("BE").map((question) => question.num);
const BY_STATE_NUMS = getStateQuestions("BY").map((question) => question.num);
const NO_STATE = { stateName: "", stateCode: "" };

/** Question numbers of every topic in the Berlin catalogue, smallest topic first. */
const TOPICS: string[][] = Array.from(
    getRelevantQuestions("BE")
        .reduce((topics, question) => {
            const topic = normalizeCategory(question.category);
            return topics.set(topic, [...(topics.get(topic) ?? []), question.num]);
        }, new Map<string, string[]>())
        .values(),
).sort((a, b) => a.length - b.length);
const SMALLEST_TOPIC = TOPICS[0];
const LARGEST_TOPIC = TOPICS[TOPICS.length - 1];

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

function answer(
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

/** The first `right` numbers answered right, the next `wrong` ones answered wrong. */
function answers(nums: string[], right: number, wrong = 0): UserQuestionProgress[] {
    return nums.slice(0, right + wrong).map((num, index) => answer(num, index < right));
}

interface MockOptions {
    passed?: boolean;
    cancelled?: boolean;
}

/** A 33-question mock exam whose first `correct` questions were answered right. */
function mock(correct: number, options: MockOptions = {}): MockTestProgress {
    return {
        datetime: "2026-10-01T10:00:00.000Z",
        timeTake: "1500",
        passed: options.passed ?? correct >= 17,
        cancelled: options.cancelled ?? false,
        questions: Array.from({ length: 33 }, (_, index) => answer(String(index + 1), index < correct)),
    };
}

const PASS = mock(30);
const FAIL = mock(10);
const CANCELLED = mock(5, { cancelled: true });

/** A daily entry in the format older app versions stored: `Date.toDateString()`, e.g. "Fri Oct 09 2026". */
function dailyEntry(day: string, answered: number, extra: Partial<UserDailyProgress> = {}): UserDailyProgress {
    return {
        date: parseDayKey(day).toDateString(),
        correct: answered,
        incorrect: 0,
        attempted: answered,
        skipped: 0,
        flagged: 0,
        answered,
        ...extra,
    };
}

/** One entry per day for the `count` days that end on `last`. */
function daysEnding(last: string, count: number, answered: number): UserDailyProgress[] {
    return Array.from({ length: count }, (_, i) => dailyEntry(addDays(last, i - count + 1), answered));
}

function unlocked(...ids: string[]): UnlockedAchievement[] {
    return ids.map((id) => ({ id, unlockedAt: EARLIER }));
}

function contextFor(user: User, overrides: Partial<AchievementContext> = {}): AchievementContext {
    return { ...buildAchievementContext(user, TODAY), ...overrides };
}

function streakInfo(current: number, best = current): StreakInfo {
    return { current, best, todayDone: current > 0, atRisk: false, startDay: null, lastActiveDay: null, freezes: 0 };
}

function readinessWith(status: Readiness["status"]): Readiness {
    return { ...computeReadiness(makeUser()), status };
}

function def(id: string) {
    const found = ACHIEVEMENTS.find((item) => item.id === id);
    if (!found) {
        throw new Error(`Unknown achievement ${id}`);
    }
    return found;
}

function progressOf(id: string, ctx: AchievementContext): number {
    return def(id).progress(ctx);
}

/** Ids newly earned today. */
function earned(user: User, overrides: Partial<AchievementContext> = {}): string[] {
    return newlyEarned(contextFor(user, overrides));
}

/** Ids newly earned today, limited to `ids`. */
function earnedOf(ids: string[], user: User, overrides: Partial<AchievementContext> = {}): string[] {
    return earned(user, overrides).filter((id) => ids.includes(id));
}

/** Freezes the whole object graph, so any mutation throws. */
function deepFreeze<T>(value: T): T {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const key of Object.keys(value)) {
            deepFreeze((value as Record<string, unknown>)[key]);
        }
    }
    return value;
}

describe("ACHIEVEMENTS", () => {
    it("lists the agreed achievements in display order", () => {
        expect(ACHIEVEMENTS.map((item) => item.id)).toEqual(ALL_IDS);
        expect(new Set(ACHIEVEMENTS.map((item) => item.id)).size).toBe(ACHIEVEMENTS.length);
    });

    it.each([
        { id: "first_answer", icon: "sparkles", tier: "bronze", target: 1 },
        { id: "answers_50", icon: "book", tier: "bronze", target: 50 },
        { id: "answers_150", icon: "book", tier: "silver", target: 150 },
        { id: "catalogue_complete", icon: "layers", tier: "gold", target: 310 },
        { id: "all_known", icon: "crown", tier: "gold", target: 310 },
        { id: "streak_3", icon: "flame", tier: "bronze", target: 3 },
        { id: "streak_7", icon: "flame", tier: "silver", target: 7 },
        { id: "streak_30", icon: "flame", tier: "gold", target: 30 },
        { id: "streak_100", icon: "flame", tier: "gold", target: 100 },
        { id: "goal_first", icon: "target", tier: "bronze", target: 1 },
        { id: "goal_7", icon: "target", tier: "silver", target: 7 },
        { id: "mock_first", icon: "clipboard", tier: "bronze", target: 1 },
        { id: "mock_pass", icon: "trophy", tier: "silver", target: 1 },
        { id: "mock_perfect", icon: "star", tier: "gold", target: 33 },
        { id: "mock_three_in_row", icon: "medal", tier: "gold", target: 3 },
        { id: "state_expert", icon: "map-pin", tier: "silver", target: 10 },
        { id: "category_master", icon: "award", tier: "silver", target: 100 },
        { id: "exam_ready", icon: "shield-check", tier: "gold", target: 1 },
    ])("$id: icon $icon, tier $tier, target $target", ({ id, icon, tier, target }) => {
        expect(def(id)).toMatchObject({
            id,
            icon,
            tier,
            target,
            titleKey: `ach_${id}_title`,
            descriptionKey: `ach_${id}_desc`,
        });
    });

    it("has texts for every title, description, and tier in English and German", () => {
        for (const language of ["en", "de"]) {
            const t = getTranslations(language);
            for (const item of ACHIEVEMENTS) {
                expect(t[item.titleKey], `${language}: ${item.titleKey}`).toBeTruthy();
                expect(t[item.descriptionKey], `${language}: ${item.descriptionKey}`).toBeTruthy();
                expect(t[`ach_tier_${item.tier}`], `${language}: ach_tier_${item.tier}`).toBeTruthy();
            }
        }
    });

    it("matches the catalogue and state targets to every federal state's catalogue", () => {
        const stateCodes = Array.from(
            new Set(
                getQuestionBank()
                    .filter((question) => !isGeneralQuestion(question.num))
                    .map((question) => question.num.split("-")[0]),
            ),
        );
        expect(stateCodes).toHaveLength(16);
        for (const code of stateCodes) {
            expect(getRelevantQuestions(code), code).toHaveLength(def("catalogue_complete").target);
            expect(getStateQuestions(code), code).toHaveLength(def("state_expert").target);
        }
    });

    it("shows no progress at all for a new learner with an older record", () => {
        const ctx = contextFor(makeUser());
        for (const item of ACHIEVEMENTS) {
            expect(item.progress(ctx), item.id).toBe(0);
        }
        expect(newlyEarned(ctx)).toEqual([]);
    });
});

describe("answer milestones", () => {
    const IDS = ["first_answer", "answers_50", "answers_150"];

    it("unlocks first_answer with the first answer, right or wrong", () => {
        expect(earnedOf(IDS, makeUser({ questionProgress: [answer("1", false)] }))).toEqual(["first_answer"]);
        expect(earnedOf(IDS, makeUser({ questionProgress: [answer("BE-1", true)] }))).toEqual(["first_answer"]);
    });

    it("does not count skipped or only flagged questions", () => {
        const user = makeUser({
            questionProgress: [answer("1", null), answer("2", null, { skipped: false, flagged: true })],
        });
        expect(progressOf("first_answer", contextFor(user))).toBe(0);
        expect(earned(user)).toEqual([]);
    });

    it("counts a question once, by its first entry", () => {
        const user = makeUser({
            questionProgress: [answer("1", true), answer("1", false), answer("2", null), answer("2", true)],
        });
        expect(progressOf("first_answer", contextFor(user))).toBe(1);
    });

    it("counts only questions of the learner's catalogue", () => {
        expect(progressOf("first_answer", contextFor(makeUser({ questionProgress: answers(BY_STATE_NUMS, 10) })))).toBe(0);
        const mixed = makeUser({
            questionProgress: [...answers(BY_STATE_NUMS, 10), answer("BE-3", false), answer("7", true)],
        });
        expect(progressOf("first_answer", contextFor(mixed))).toBe(2);
    });

    it.each([
        { count: 49, expected: ["first_answer"] },
        { count: 50, expected: ["first_answer", "answers_50"] },
        { count: 149, expected: ["first_answer", "answers_50"] },
        { count: 150, expected: ["first_answer", "answers_50", "answers_150"] },
    ])("unlocks $expected for $count answered questions", ({ count, expected }) => {
        // Right and wrong answers both count.
        const user = makeUser({ questionProgress: answers(BE_NUMS, Math.ceil(count / 2), Math.floor(count / 2)) });
        expect(progressOf("answers_150", contextFor(user))).toBe(count);
        expect(earnedOf(IDS, user)).toEqual(expected);
    });
});

describe("catalogue_complete and all_known", () => {
    it("needs every catalogue question answered once", () => {
        const almost = makeUser({ questionProgress: answers(BE_NUMS, 309) });
        expect(progressOf("catalogue_complete", contextFor(almost))).toBe(309);
        expect(earned(almost)).not.toContain("catalogue_complete");

        const complete = makeUser({ questionProgress: answers(BE_NUMS, 309, 1) });
        expect(progressOf("catalogue_complete", contextFor(complete))).toBe(310);
        expect(progressOf("all_known", contextFor(complete))).toBe(309);
        expect(earned(complete)).toContain("catalogue_complete");
        expect(earned(complete)).not.toContain("all_known");
    });

    it("unlocks all_known once the latest answer of every question is right", () => {
        const user = makeUser({ questionProgress: answers(BE_NUMS, 310) });
        expect(progressOf("all_known", contextFor(user))).toBe(310);
        expect(earned(user)).toEqual(expect.arrayContaining(["catalogue_complete", "all_known"]));
    });

    it("does not let questions of another state complete the catalogue", () => {
        const user = makeUser({ questionProgress: [...answers(GENERAL_NUMS, 300), ...answers(BY_STATE_NUMS, 10)] });
        expect(progressOf("catalogue_complete", contextFor(user))).toBe(300);
        expect(earned(user)).not.toContain("catalogue_complete");
        expect(earned(user)).not.toContain("all_known");
    });

    it("scales the 300 general questions of a learner without a federal state to the target", () => {
        const almost = makeUser({ state: NO_STATE, questionProgress: answers(GENERAL_NUMS, 299) });
        expect(progressOf("catalogue_complete", contextFor(almost))).toBe(308);
        expect(earned(almost)).not.toContain("catalogue_complete");

        const complete = makeUser({ state: NO_STATE, questionProgress: answers(GENERAL_NUMS, 300) });
        expect(progressOf("catalogue_complete", contextFor(complete))).toBe(310);
        expect(earned(complete)).toEqual(expect.arrayContaining(["catalogue_complete", "all_known"]));
    });
});

describe("streak achievements", () => {
    const IDS = ["streak_3", "streak_7", "streak_30", "streak_100"];

    it.each([
        { current: 0, expected: [] },
        { current: 2, expected: [] },
        { current: 3, expected: ["streak_3"] },
        { current: 6, expected: ["streak_3"] },
        { current: 7, expected: ["streak_3", "streak_7"] },
        { current: 29, expected: ["streak_3", "streak_7"] },
        { current: 30, expected: ["streak_3", "streak_7", "streak_30"] },
        { current: 99, expected: ["streak_3", "streak_7", "streak_30"] },
        { current: 100, expected: IDS },
    ])("a streak of $current days unlocks $expected", ({ current, expected }) => {
        expect(earnedOf(IDS, makeUser(), { streak: streakInfo(current) })).toEqual(expected);
    });

    it("counts the best streak after the current one broke", () => {
        const ctx = contextFor(makeUser(), { streak: streakInfo(0, 30) });
        expect(progressOf("streak_100", ctx)).toBe(30);
        expect(newlyEarned(ctx).filter((id) => IDS.includes(id))).toEqual(["streak_3", "streak_7", "streak_30"]);
    });

    it("counts the current streak when the stored best lags behind", () => {
        expect(progressOf("streak_7", contextFor(makeUser(), { streak: streakInfo(7, 2) }))).toBe(7);
    });

    it("reads the streak from older daily records without a streak field", () => {
        const week = makeUser({ dailyProgress: daysEnding(TODAY, 7, 1) });
        expect(week.streak).toBeUndefined();
        expect(earnedOf(IDS, week)).toEqual(["streak_3", "streak_7"]);
        expect(earnedOf(IDS, makeUser({ dailyProgress: daysEnding(TODAY, 6, 1) }))).toEqual(["streak_3"]);
        expect(earnedOf(IDS, makeUser({ dailyProgress: daysEnding(TODAY, 2, 1) }))).toEqual([]);
    });

    it("counts a streak that today has not extended yet", () => {
        const user = makeUser({ dailyProgress: daysEnding(addDays(TODAY, -1), 7, 1) });
        expect(earnedOf(IDS, user)).toEqual(["streak_3", "streak_7"]);
    });

    it("counts a streak across the end of daylight saving time", () => {
        // Germany leaves summer time on 2026-10-25.
        const today = "2026-10-28";
        const user = makeUser({ dailyProgress: daysEnding(today, 7, 1) });
        expect(newlyEarned(buildAchievementContext(user, today))).toEqual(expect.arrayContaining(["streak_7"]));
    });

    it("uses the stored best streak", () => {
        const user = makeUser({ streak: { best: 30, freezes: 0, frozenDays: [], freezeEarnedDays: [] } });
        expect(earnedOf(IDS, user)).toEqual(["streak_3", "streak_7", "streak_30"]);
    });
});

describe("daily goal achievements", () => {
    const IDS = ["goal_first", "goal_7"];

    it("uses the default goal of 10 for older records", () => {
        expect(makeUser().preferences).toBeUndefined();
        expect(earnedOf(IDS, makeUser({ dailyProgress: [dailyEntry(TODAY, 9)] }))).toEqual([]);
        expect(earnedOf(IDS, makeUser({ dailyProgress: [dailyEntry(TODAY, 10)] }))).toEqual(["goal_first"]);
    });

    it("needs 7 days on which the goal was reached for goal_7", () => {
        const six = makeUser({ dailyProgress: [...daysEnding(TODAY, 6, 10), dailyEntry(addDays(TODAY, -6), 9)] });
        expect(progressOf("goal_7", contextFor(six))).toBe(6);
        expect(earnedOf(IDS, six)).toEqual(["goal_first"]);

        // The days do not have to be in a row.
        const seven = makeUser({
            dailyProgress: [0, 2, 5, 9, 20, 40, 100].map((offset) => dailyEntry(addDays(TODAY, -offset), 12)),
        });
        expect(progressOf("goal_7", contextFor(seven))).toBe(7);
        expect(earnedOf(IDS, seven)).toEqual(["goal_first", "goal_7"]);
    });

    it("adds up the entries of one day and counts the day once", () => {
        const user = makeUser({
            dailyProgress: [
                dailyEntry(TODAY, 5),
                dailyEntry(TODAY, 5, { date: new Date(2026, 9, 9, 15, 0).toISOString() }),
            ],
        });
        expect(progressOf("goal_7", contextFor(user))).toBe(1);
        expect(earnedOf(IDS, user)).toEqual(["goal_first"]);
    });

    it("uses correct + incorrect for entries without an answered count", () => {
        const legacy: UserDailyProgress = {
            date: parseDayKey(TODAY).toDateString(),
            correct: 6,
            incorrect: 4,
            attempted: 12,
            skipped: 2,
            flagged: 0,
        };
        expect(earnedOf(IDS, makeUser({ dailyProgress: [legacy] }))).toEqual(["goal_first"]);
        expect(earnedOf(IDS, makeUser({ dailyProgress: [{ ...legacy, incorrect: 3 }] }))).toEqual([]);
    });

    it("measures every day against the current daily goal", () => {
        const dailyProgress = daysEnding(TODAY, 7, 10);
        const withGoal = (dailyGoal: number) =>
            contextFor(makeUser({ dailyProgress, preferences: { ...DEFAULT_PREFERENCES, dailyGoal } }));
        expect(progressOf("goal_7", withGoal(5))).toBe(7);
        expect(progressOf("goal_7", withGoal(10))).toBe(7);
        expect(progressOf("goal_7", withGoal(20))).toBe(0);
    });

    it("falls back to the default goal when the stored goal is unusable", () => {
        const preferences = { ...DEFAULT_PREFERENCES, dailyGoal: 0 };
        const idle = makeUser({
            preferences,
            dailyProgress: [dailyEntry(TODAY, 0), dailyEntry(addDays(TODAY, -1), 0, { attempted: 3, skipped: 3 })],
        });
        expect(progressOf("goal_first", contextFor(idle))).toBe(0);
        expect(progressOf("goal_first", contextFor(makeUser({ preferences, dailyProgress: [dailyEntry(TODAY, 10)] })))).toBe(1);
    });

    it("ignores days after today and unreadable dates", () => {
        const user = makeUser({
            dailyProgress: [
                dailyEntry(addDays(TODAY, 1), 50),
                dailyEntry(TODAY, 50, { date: "not a date" }),
                dailyEntry(TODAY, 50, { date: "" }),
            ],
        });
        expect(progressOf("goal_first", contextFor(user))).toBe(0);
    });

    it("counts each day around the end of daylight saving time", () => {
        const user = makeUser({
            dailyProgress: ["2026-10-24", "2026-10-25", "2026-10-26"].map((day) => dailyEntry(day, 10)),
        });
        expect(progressOf("goal_7", buildAchievementContext(user, "2026-10-26"))).toBe(3);
    });
});

describe("mock exam achievements", () => {
    const IDS = ["mock_first", "mock_pass", "mock_perfect", "mock_three_in_row"];

    it("needs a mock exam that was not cancelled for mock_first", () => {
        expect(earnedOf(IDS, makeUser({ testProgress: [CANCELLED] }))).toEqual([]);
        expect(earnedOf(IDS, makeUser({ testProgress: [FAIL] }))).toEqual(["mock_first"]);
    });

    it("needs a passed mock exam for mock_pass", () => {
        expect(earnedOf(IDS, makeUser({ testProgress: [mock(16)] }))).toEqual(["mock_first"]);
        expect(earnedOf(IDS, makeUser({ testProgress: [mock(17)] }))).toEqual(["mock_first", "mock_pass"]);
        // A "Leben in Deutschland" exam passes with 15; the stored result decides.
        const lid: MockTestProgress = { ...mock(15, { passed: true }), passMark: 15, examType: "lid", timed: false };
        expect(earnedOf(IDS, makeUser({ testProgress: [lid] }))).toEqual(["mock_first", "mock_pass"]);
    });

    it("never counts a cancelled mock exam, even one marked as passed", () => {
        const ctx = contextFor(makeUser({ testProgress: [mock(33, { passed: true, cancelled: true })] }));
        for (const id of IDS) {
            expect(progressOf(id, ctx), id).toBe(0);
        }
    });

    it("needs all 33 answers right in one mock exam for mock_perfect", () => {
        const close = makeUser({ testProgress: [mock(30), mock(32), mock(12)] });
        expect(progressOf("mock_perfect", contextFor(close))).toBe(32);
        expect(earned(close)).not.toContain("mock_perfect");

        const perfect = makeUser({ testProgress: [mock(30), mock(33), mock(12)] });
        expect(progressOf("mock_perfect", contextFor(perfect))).toBe(33);
        expect(earned(perfect)).toContain("mock_perfect");
    });

    it("treats a mock exam record without questions as no correct answers", () => {
        const broken = { ...FAIL, questions: undefined } as unknown as MockTestProgress;
        const ctx = contextFor(makeUser({ testProgress: [broken] }));
        expect(progressOf("mock_perfect", ctx)).toBe(0);
        expect(progressOf("mock_first", ctx)).toBe(1);
    });

    it.each([
        { name: "two passes", tests: [PASS, PASS], run: 2 },
        { name: "three passes", tests: [PASS, PASS, PASS], run: 3 },
        { name: "a fail after three passes", tests: [PASS, PASS, PASS, FAIL], run: 0 },
        { name: "three passes after a fail", tests: [FAIL, PASS, PASS, PASS], run: 3 },
        { name: "a fail between passes", tests: [PASS, PASS, FAIL, PASS, PASS], run: 2 },
        { name: "a cancelled exam between passes", tests: [PASS, PASS, CANCELLED, PASS], run: 3 },
        { name: "a cancelled exam at the end", tests: [PASS, PASS, PASS, CANCELLED], run: 3 },
        { name: "five passes", tests: [PASS, PASS, PASS, PASS, PASS], run: 3 },
    ])("mock_three_in_row counts the current run of passes: $name", ({ tests, run }) => {
        const user = makeUser({ testProgress: tests });
        expect(progressOf("mock_three_in_row", contextFor(user))).toBe(run);
        expect(earned(user).includes("mock_three_in_row")).toBe(run === 3);
    });
});

describe("state_expert", () => {
    it("needs every question of the learner's own state known", () => {
        const nine = makeUser({ questionProgress: answers(BE_STATE_NUMS, 9) });
        expect(progressOf("state_expert", contextFor(nine))).toBe(9);
        expect(earned(nine)).not.toContain("state_expert");

        const ten = makeUser({ questionProgress: answers(BE_STATE_NUMS, 10) });
        expect(progressOf("state_expert", contextFor(ten))).toBe(10);
        expect(earned(ten)).toContain("state_expert");
    });

    it("does not count a state question whose latest answer was wrong", () => {
        const user = makeUser({ questionProgress: answers(BE_STATE_NUMS, 9, 1) });
        expect(progressOf("state_expert", contextFor(user))).toBe(9);
        expect(earned(user)).not.toContain("state_expert");
    });

    it("ignores general questions and questions of other states", () => {
        const user = makeUser({ questionProgress: [...answers(GENERAL_NUMS, 300), ...answers(BY_STATE_NUMS, 10)] });
        expect(progressOf("state_expert", contextFor(user))).toBe(0);
    });

    it("follows a change of federal state", () => {
        const questionProgress = answers(BE_STATE_NUMS, 10);
        expect(earned(makeUser({ questionProgress }))).toContain("state_expert");
        const moved = makeUser({ questionProgress, state: { stateName: "Bayern", stateCode: "BY" } });
        expect(progressOf("state_expert", contextFor(moved))).toBe(0);
    });

    it("cannot be earned without a federal state", () => {
        const user = makeUser({ state: NO_STATE, questionProgress: answers(GENERAL_NUMS, 300) });
        expect(progressOf("state_expert", contextFor(user))).toBe(0);
        expect(earned(user)).not.toContain("state_expert");
    });
});

describe("category_master", () => {
    it("unlocks once every question of one topic is known", () => {
        const [first, ...rest] = SMALLEST_TOPIC;
        const partly = makeUser({ questionProgress: [answer(first, true), ...rest.map((num) => answer(num, false))] });
        expect(progressOf("category_master", contextFor(partly))).toBe(Math.round(100 / SMALLEST_TOPIC.length));
        expect(earned(partly)).not.toContain("category_master");

        const all = makeUser({ questionProgress: answers(SMALLEST_TOPIC, SMALLEST_TOPIC.length) });
        expect(progressOf("category_master", contextFor(all))).toBe(100);
        expect(earned(all)).toContain("category_master");
    });

    it("reports the best topic as a whole percentage", () => {
        const user = makeUser({
            questionProgress: [...answers(SMALLEST_TOPIC, 1), ...answers(LARGEST_TOPIC, LARGEST_TOPIC.length - 1)],
        });
        const best = Math.max(
            Math.round(100 / SMALLEST_TOPIC.length),
            Math.round((100 * (LARGEST_TOPIC.length - 1)) / LARGEST_TOPIC.length),
        );
        expect(progressOf("category_master", contextFor(user))).toBe(best);
        expect(best).toBeLessThan(100);
        expect(earned(user)).not.toContain("category_master");
    });

    it("needs the latest answer of every topic question to be right", () => {
        const user = makeUser({ questionProgress: answers(SMALLEST_TOPIC, SMALLEST_TOPIC.length - 1, 1) });
        expect(earned(user)).not.toContain("category_master");
    });
});

describe("exam_ready", () => {
    it("follows the readiness status", () => {
        expect(earned(makeUser(), { readiness: readinessWith("ready") })).toEqual(["exam_ready"]);
        for (const status of ["start", "building", "close"] as const) {
            expect(progressOf("exam_ready", contextFor(makeUser(), { readiness: readinessWith(status) })), status).toBe(0);
        }
    });

    it("unlocks with everything else for a learner who knows the catalogue and passes mock exams", () => {
        const user = makeUser({ questionProgress: answers(BE_NUMS, 310), testProgress: [mock(33), mock(33), mock(33)] });
        const ctx = contextFor(user);
        expect(ctx.readiness.status).toBe("ready");
        expect(newlyEarned(ctx)).toEqual([
            "first_answer",
            "answers_50",
            "answers_150",
            "catalogue_complete",
            "all_known",
            "mock_first",
            "mock_pass",
            "mock_perfect",
            "mock_three_in_row",
            "state_expert",
            "category_master",
            "exam_ready",
        ]);
    });
});

describe("isUnlocked", () => {
    it("is false for older records without achievements", () => {
        expect(isUnlocked(makeUser(), "first_answer")).toBe(false);
    });

    it("finds unlocked achievements by id", () => {
        const user = makeUser({ achievements: unlocked("first_answer") });
        expect(isUnlocked(user, "first_answer")).toBe(true);
        expect(isUnlocked(user, "answers_50")).toBe(false);
    });
});

describe("newlyEarned", () => {
    it("works for older records without the achievements field", () => {
        const user = makeUser({ questionProgress: answers(BE_NUMS, 60), testProgress: [mock(20)] });
        expect(user.achievements).toBeUndefined();
        expect(earned(user)).toEqual(["first_answer", "answers_50", "mock_first", "mock_pass"]);
    });

    it("leaves out achievements that are already unlocked", () => {
        const user = makeUser({
            questionProgress: answers(BE_NUMS, 60),
            testProgress: [mock(20)],
            achievements: unlocked("answers_50", "mock_first"),
        });
        expect(earned(user)).toEqual(["first_answer", "mock_pass"]);
    });

    it("ignores unknown ids stored in the record", () => {
        const user = makeUser({ questionProgress: [answer("1", true)], achievements: unlocked("retired_badge") });
        expect(earned(user)).toEqual(["first_answer"]);
    });
});

describe("unlockAchievements", () => {
    it("stores newly earned achievements with the unlock time", () => {
        const user = makeUser({ questionProgress: [answer("1", true)] });
        const result = unlockAchievements(contextFor(user), NOW);
        expect(result.unlocked).toEqual(["first_answer"]);
        expect(result.user.achievements).toEqual([{ id: "first_answer", unlockedAt: NOW.toISOString() }]);
        expect(result.user).not.toBe(user);
        expect(user.achievements).toBeUndefined();
    });

    it("keeps the existing achievements first and stamps all new ones with the same time", () => {
        const existing = unlocked("mock_first", "first_answer");
        const user = makeUser({ questionProgress: answers(BE_NUMS, 150), testProgress: [FAIL], achievements: existing });
        const result = unlockAchievements(contextFor(user), NOW);
        expect(result.unlocked).toEqual(["answers_50", "answers_150", "category_master"]);
        expect(result.user.achievements).toEqual([
            ...existing,
            { id: "answers_50", unlockedAt: NOW.toISOString() },
            { id: "answers_150", unlockedAt: NOW.toISOString() },
            { id: "category_master", unlockedAt: NOW.toISOString() },
        ]);
    });

    it("keeps every other field of the record", () => {
        const user = makeUser({ questionProgress: [answer("1", true)], nickname: "Ada", examDate: "2026-12-01" });
        const result = unlockAchievements(contextFor(user), NOW);
        const { achievements, ...rest } = result.user;
        expect(achievements).toHaveLength(1);
        expect(rest).toEqual(user);
        expect(result.user.questionProgress).toBe(user.questionProgress);
    });

    it("returns the same user object when nothing new was earned", () => {
        const fresh = makeUser();
        const result = unlockAchievements(contextFor(fresh), NOW);
        expect(result.user).toBe(fresh);
        expect(result.unlocked).toEqual([]);
        expect(fresh).not.toHaveProperty("achievements");

        const done = makeUser({ questionProgress: [answer("1", false)], achievements: unlocked("first_answer") });
        expect(unlockAchievements(contextFor(done), NOW).user).toBe(done);
    });

    it("keeps achievements whose progress dropped later", () => {
        const user = makeUser({
            questionProgress: answers(BE_NUMS, 309, 1),
            achievements: unlocked(
                "first_answer",
                "answers_50",
                "answers_150",
                "catalogue_complete",
                "all_known",
                "state_expert",
                "category_master",
            ),
        });
        const result = unlockAchievements(contextFor(user), NOW);
        expect(result.user).toBe(user);
        expect(isUnlocked(result.user, "all_known")).toBe(true);
        expect(isUnlocked(result.user, "state_expert")).toBe(true);
    });

    it("is idempotent", () => {
        const user = makeUser({
            questionProgress: answers(BE_NUMS, 310),
            dailyProgress: daysEnding(TODAY, 7, 10),
            testProgress: [mock(33), mock(33), mock(33)],
        });
        const first = unlockAchievements(contextFor(user), NOW);
        expect(first.unlocked).toEqual(ALL_IDS.filter((id) => id !== "streak_30" && id !== "streak_100"));
        const second = unlockAchievements(contextFor(first.user), new Date(2026, 9, 9, 21, 0));
        expect(second.user).toBe(first.user);
        expect(second.unlocked).toEqual([]);
    });

    it("does not change its input", () => {
        const user = deepFreeze(
            makeUser({
                questionProgress: answers(BE_NUMS, 60),
                dailyProgress: [dailyEntry(TODAY, 12)],
                achievements: unlocked("first_answer"),
            }),
        );
        const ctx = deepFreeze(contextFor(user));
        const before = JSON.stringify(user);
        const result = unlockAchievements(ctx, NOW);
        expect(result.unlocked).toEqual(["answers_50", "goal_first"]);
        expect(JSON.stringify(user)).toBe(before);
        expect(user.achievements).toEqual(unlocked("first_answer"));
    });
});

describe("buildAchievementContext", () => {
    it("combines the streak on the given day with the readiness", () => {
        const user = makeUser({ dailyProgress: daysEnding(TODAY, 3, 10), questionProgress: answers(BE_NUMS, 20) });
        const ctx = buildAchievementContext(user, TODAY);
        expect(ctx.user).toBe(user);
        expect(ctx.today).toBe(TODAY);
        expect(ctx.streak).toEqual(computeStreak(user, TODAY));
        expect(ctx.streak.current).toBe(3);
        expect(ctx.readiness).toEqual(computeReadiness(user));
        expect(ctx.readiness.known).toBe(20);
    });
});

describe("damaged records", () => {
    it("never throws or reports invalid progress for missing lists and empty entries", () => {
        const damaged = {
            ...makeUser(),
            state: undefined,
            dailyProgress: undefined,
            questionProgress: [null, answer("1", true)],
            testProgress: [null, { ...PASS, questions: null }],
            achievements: [null],
        } as unknown as User;
        const ctx = buildAchievementContext(damaged, TODAY);
        for (const item of ACHIEVEMENTS) {
            const value = item.progress(ctx);
            expect(Number.isFinite(value) && value >= 0, item.id).toBe(true);
        }
        expect(progressOf("first_answer", ctx)).toBe(1);
        expect(unlockAchievements(ctx, NOW).unlocked).toEqual(["first_answer", "mock_first", "mock_pass"]);
    });
});

describe("catalogues of another size", () => {
    afterEach(() => {
        vi.doUnmock("@/data/data");
        vi.resetModules();
    });

    function question(num: string, category: Question["category"]): Question {
        return { num, id: num, question: "", a: "", b: "", c: "", d: "", solution: "a", image: "", category };
    }

    /**
     * Loads a fresh copy of the module that reads `bank` as the question
     * catalogue. Returns the progress of an achievement for a Berlin learner
     * who answered `nums` right.
     */
    async function loadWithCatalogue(bank: Question[]) {
        vi.resetModules();
        vi.doMock("@/data/data", () => ({ questionsData: () => bank }));
        const fresh = await import("@/utils/achievements");
        return (id: string, nums: string[]): number => {
            const user = makeUser({ questionProgress: answers(nums, nums.length) });
            const found = fresh.ACHIEVEMENTS.find((item) => item.id === id);
            return found ? found.progress(fresh.buildAchievementContext(user, TODAY)) : NaN;
        };
    }

    it("reaches the catalogue and state targets only when everything is answered", async () => {
        // 320 general questions plus 12 for Berlin.
        const general = Array.from({ length: 320 }, (_, i) => question(String(i + 1), "Elections"));
        const state = Array.from({ length: 12 }, (_, i) => question(`BE-${i + 1}`, "Constitution"));
        const progress = await loadWithCatalogue([...general, ...state]);
        const nums = [...general, ...state].map((item) => item.num);

        expect(progress("catalogue_complete", nums.slice(0, 310))).toBe(Math.floor((310 * 310) / 332));
        expect(progress("catalogue_complete", nums.slice(0, 331))).toBe(309);
        expect(progress("catalogue_complete", nums)).toBe(310);
        expect(progress("state_expert", nums.slice(320, 330))).toBe(8);
        expect(progress("state_expert", nums.slice(320))).toBe(10);
    });

    it("does not round a nearly known topic up to 100", async () => {
        const large = Array.from({ length: 250 }, (_, i) => question(String(i + 1), "History & Geography"));
        const rest = Array.from({ length: 50 }, (_, i) => question(String(i + 251), "Elections"));
        const progress = await loadWithCatalogue([...large, ...rest]);
        const largeNums = large.map((item) => item.num);

        expect(progress("category_master", largeNums.slice(0, 249))).toBe(99);
        expect(progress("category_master", largeNums)).toBe(100);
    });
});
