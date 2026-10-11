import { describe, expect, it } from "vitest";
import {
    QUICK_ROUND_SIZE,
    STUDY_MODES,
    buildModeQuestions,
    countForMode,
    getStudyMode,
    modeCounts,
    modeHref,
    parseModeParam,
    parseStartParam,
    splitStudyModes,
    suggestNextAction,
    type ModeAccent,
    type ModeOptions,
    type StudyModeId,
} from "@/utils/study-modes";
import { getCategoryCounts, getQuestion, getQuestionBank, getRelevantQuestions } from "@/utils/question-bank";
import { DEFAULT_PREFERENCES } from "@/utils/user-defaults";
import { getTranslations, questionsData } from "@/data/data";
import type { Question } from "@/types/question";
import type { ReviewItem, User, UserQuestionProgress } from "@/types/user";

const TODAY = "2026-10-09";
const YESTERDAY = "2026-10-08";
const TOMORROW = "2026-10-10";
const LAST_WEEK = "2026-10-01";

const ALL_MODES: StudyModeId[] = [
    "new",
    "review",
    "incorrect",
    "flagged",
    "skipped",
    "state",
    "category",
    "quick",
    "marathon",
    "correct",
];

/** The Berlin catalogue: the 300 general questions, then BE-1 to BE-10. */
const BERLIN_NUMS = getRelevantQuestions("BE").map((question) => question.num);
const BERLIN_STATE_NUMS = Array.from({ length: 10 }, (_, i) => `BE-${i + 1}`);

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

/** A 2.1 record with its own copy of the default preferences and the given session size. */
function withSessionSize(sessionSize: number, overrides: Partial<User> = {}): User {
    return makeUser({
        preferences: {
            ...DEFAULT_PREFERENCES,
            restDays: [...DEFAULT_PREFERENCES.restDays],
            reminders: { ...DEFAULT_PREFERENCES.reminders },
            sessionSize,
        },
        ...overrides,
    });
}

function entry(
    num: string,
    answeredCorrectly: boolean | null,
    extra: Partial<UserQuestionProgress> = {},
): UserQuestionProgress {
    return {
        num,
        answeredCorrectly,
        skipped: false,
        answerSelected: answeredCorrectly === null ? null : answeredCorrectly ? "a" : "b",
        flagged: false,
        ...extra,
    };
}

const right = (num: string, extra: Partial<UserQuestionProgress> = {}) => entry(num, true, extra);
const wrong = (num: string, extra: Partial<UserQuestionProgress> = {}) => entry(num, false, extra);
const skip = (num: string, extra: Partial<UserQuestionProgress> = {}) => entry(num, null, { skipped: true, ...extra });
const flag = (num: string, extra: Partial<UserQuestionProgress> = {}) => entry(num, null, { flagged: true, ...extra });

function due(num: string, day: string, box = 1): ReviewItem {
    return { num, box, due: day, lastReviewed: LAST_WEEK };
}

function nums(questions: Question[]): string[] {
    return questions.map((question) => question.num);
}

/** Question numbers of a session; by default without the session-size cut. */
function build(user: User, mode: StudyModeId, options: Partial<ModeOptions> = {}): string[] {
    return nums(buildModeQuestions(user, mode, { today: TODAY, sessionSize: 0, ...options }));
}

/** Seeded pseudo-random numbers in [0, 1) (mulberry32), for repeatable quick rounds. */
function seeded(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Freezes an object graph: any attempt to change it throws. */
function deepFreeze<T>(value: T): T {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const key of Object.keys(value)) {
            deepFreeze((value as Record<string, unknown>)[key]);
        }
    }
    return value;
}

function isBerlinQuestion(num: string): boolean {
    return /^\d+$/.test(num) || num.startsWith("BE-");
}

/** Berlin numbers of one category, from the catalogue as question-bank cleans it. */
function berlinCategory(category: string): string[] {
    return getRelevantQuestions("BE")
        .filter((question) => question.category === category)
        .map((question) => question.num);
}

/**
 * Learner with progress of every kind, including answers kept from Bavaria
 * and schedule items outside the Berlin catalogue.
 */
function mixedLearner(): User {
    return withSessionSize(10, {
        questionProgress: [
            right("1"),
            wrong("2"),
            skip("3"),
            flag("4"),
            right("5", { flagged: true }),
            wrong("6", { flagged: true }),
            entry("7", null),
            right("8", { skipped: true }),
            wrong("BE-1"),
            skip("BE-2"),
            right("BE-3"),
            wrong("BY-1"),
            flag("HH-2"),
        ],
        reviewSchedule: [
            due("2", YESTERDAY),
            due("6", TODAY),
            due("1", TOMORROW, 2),
            due("BE-1", LAST_WEEK),
            due("BY-1", YESTERDAY),
            due("999", YESTERDAY),
        ],
    });
}

describe("catalogue fixture", () => {
    it("lists the general questions in order, then BE-1 to BE-10", () => {
        expect(BERLIN_NUMS).toHaveLength(310);
        expect(BERLIN_NUMS.slice(0, 3)).toEqual(["1", "2", "3"]);
        expect(BERLIN_NUMS[299]).toBe("300");
        expect(BERLIN_NUMS.slice(300)).toEqual(BERLIN_STATE_NUMS);
    });
});

describe("STUDY_MODES", () => {
    it("lists the ten modes in display order", () => {
        expect(STUDY_MODES.map((def) => def.id)).toEqual(ALL_MODES);
    });

    it("uses mode_<id>_title and mode_<id>_desc as translation keys", () => {
        for (const def of STUDY_MODES) {
            expect(def.titleKey).toBe(`mode_${def.id}_title`);
            expect(def.descriptionKey).toBe(`mode_${def.id}_desc`);
        }
    });

    it("has an English and a German title and description for every mode", () => {
        for (const language of ["en", "de"]) {
            const t = getTranslations(language);
            for (const def of STUDY_MODES) {
                expect(t[def.titleKey], `${language} ${def.titleKey}`).toEqual(expect.any(String));
                expect(t[def.titleKey].length).toBeGreaterThan(0);
                expect(t[def.descriptionKey], `${language} ${def.descriptionKey}`).toEqual(expect.any(String));
                expect(t[def.descriptionKey].length).toBeGreaterThan(0);
            }
        }
    });

    it("uses the agreed icons", () => {
        expect(Object.fromEntries(STUDY_MODES.map((def) => [def.id, def.icon]))).toEqual({
            new: "sparkles",
            review: "repeat",
            incorrect: "target",
            flagged: "flag",
            skipped: "skip",
            state: "map-pin",
            category: "layers",
            quick: "zap",
            marathon: "route",
            correct: "check-circle",
        });
    });

    it("uses known accents", () => {
        const accents: ModeAccent[] = ["primary", "secondary", "success", "warning", "danger", "default"];
        for (const def of STUDY_MODES) {
            expect(accents).toContain(def.accent);
        }
    });

    it("applies the session size to every mode except the state mode and the quick round", () => {
        expect(STUDY_MODES.filter((def) => !def.usesSessionSize).map((def) => def.id)).toEqual(["state", "quick"]);
    });

    it("has a quick round of ten questions", () => {
        expect(QUICK_ROUND_SIZE).toBe(10);
    });
});

describe("getStudyMode", () => {
    it("returns the definition of a mode", () => {
        for (const def of STUDY_MODES) {
            expect(getStudyMode(def.id)).toBe(def);
        }
    });

    it("falls back to the new-questions mode for an unknown id", () => {
        expect(getStudyMode("bogus" as StudyModeId).id).toBe("new");
    });
});

describe("buildModeQuestions: the learner's catalogue", () => {
    it("returns full catalogue questions", () => {
        const [first] = buildModeQuestions(makeUser(), "new", { today: TODAY });
        expect(first).toEqual(getQuestion("1"));
    });

    it("never offers questions of another state", () => {
        // Answers kept after moving from Bavaria to Berlin.
        const bavarian = ["BY-1", "BY-2", "BY-3", "BY-4", "HH-1"];
        const user = makeUser({
            questionProgress: [wrong("BY-1"), flag("BY-2"), skip("BY-3"), right("BY-4"), wrong("HH-1")],
            reviewSchedule: bavarian.map((num) => due(num, YESTERDAY)),
        });
        for (const mode of ALL_MODES) {
            const result = build(user, mode, { random: seeded(3) });
            expect(result.every(isBerlinQuestion), mode).toBe(true);
        }
        for (const mode of ["review", "incorrect", "flagged", "skipped", "correct"] as StudyModeId[]) {
            expect(build(user, mode), mode).toEqual([]);
            expect(countForMode(user, mode, TODAY), mode).toBe(0);
        }
    });

    it("works with records written before version 2.1", () => {
        const user = makeUser({ questionProgress: [wrong("1"), right("2")] });
        expect(user.preferences).toBeUndefined();
        expect(user.reviewSchedule).toBeUndefined();
        for (const mode of ALL_MODES) {
            expect(() => buildModeQuestions(user, mode, { today: TODAY })).not.toThrow();
        }
        expect(build(user, "review")).toEqual([]);
        expect(build(user, "incorrect")).toEqual(["1"]);
        expect(buildModeQuestions(user, "new", { today: TODAY })).toHaveLength(DEFAULT_PREFERENCES.sessionSize);
    });

    it("offers only general questions when no state is chosen", () => {
        const user = makeUser({ state: { stateName: "", stateCode: "" } });
        expect(build(user, "new")).toEqual(BERLIN_NUMS.slice(0, 300));
        expect(build(user, "marathon")).toHaveLength(300);
        expect(build(user, "state")).toEqual([]);
        expect(countForMode(user, "state", TODAY)).toBe(0);
    });

    it("uses the first progress entry when a record holds duplicates", () => {
        const user = makeUser({ questionProgress: [wrong("5"), right("5")] });
        expect(build(user, "incorrect")).toEqual(["5"]);
        expect(build(user, "correct")).toEqual([]);
    });

    it("ignores broken progress entries", () => {
        const user = makeUser({
            questionProgress: [null as unknown as UserQuestionProgress, wrong("3")],
        });
        expect(build(user, "incorrect")).toEqual(["3"]);
        expect(build(user, "new")).toHaveLength(309);
    });

    it("returns nothing for an unknown mode", () => {
        const user = makeUser();
        expect(build(user, "bogus" as StudyModeId)).toEqual([]);
        expect(countForMode(user, "bogus" as StudyModeId, TODAY)).toBe(0);
    });
});

describe("buildModeQuestions: new", () => {
    it("offers questions without any progress entry, in catalogue order", () => {
        const user = makeUser({
            questionProgress: [right("1"), skip("2"), flag("3"), wrong("5")],
        });
        const result = build(user, "new");
        expect(result.slice(0, 3)).toEqual(["4", "6", "7"]);
        expect(result).toHaveLength(306);
        expect(result[result.length - 1]).toBe("BE-10");
    });

    it("offers the whole catalogue to a fresh learner", () => {
        expect(build(makeUser(), "new")).toEqual(BERLIN_NUMS);
    });

    it("is empty once every question was opened", () => {
        const user = makeUser({ questionProgress: BERLIN_NUMS.map((num) => right(num)) });
        expect(build(user, "new")).toEqual([]);
    });
});

describe("buildModeQuestions: review", () => {
    it("offers due questions: most overdue first, then the lower box, then catalogue order", () => {
        const user = makeUser({
            reviewSchedule: [
                due("10", YESTERDAY, 2),
                due("2", YESTERDAY, 2),
                due("7", TODAY, 1),
                due("BE-3", LAST_WEEK, 3),
                due("50", YESTERDAY, 1),
                due("8", TOMORROW, 1),
            ],
        });
        expect(build(user, "review")).toEqual(["BE-3", "50", "2", "10", "7"]);
    });

    it("leaves out other states and numbers missing from the catalogue", () => {
        const user = makeUser({
            reviewSchedule: [due("BY-1", YESTERDAY), due("999", YESTERDAY), due("XX-1", YESTERDAY), due("1", TODAY)],
        });
        expect(build(user, "review")).toEqual(["1"]);
        expect(countForMode(user, "review", TODAY)).toBe(1);
    });

    it("is empty without a schedule", () => {
        expect(build(makeUser(), "review")).toEqual([]);
        expect(build(makeUser({ reviewSchedule: [] }), "review")).toEqual([]);
    });

    it("compares calendar days, also around daylight-saving changes", () => {
        const user = makeUser({
            reviewSchedule: [due("1", "2026-03-29"), due("2", "2026-03-30"), due("3", "2026-10-25"), due("4", "2026-10-26")],
        });
        expect(build(user, "review", { today: "2026-03-29" })).toEqual(["1"]);
        expect(build(user, "review", { today: "2026-10-25" })).toEqual(["1", "2", "3"]);
    });

    it("is cut to the session size, while the count covers every due question", () => {
        const dueNums = BERLIN_NUMS.slice(0, 25);
        const user = makeUser({ reviewSchedule: dueNums.map((num) => due(num, YESTERDAY)) });
        expect(nums(buildModeQuestions(user, "review", { today: TODAY }))).toEqual(dueNums.slice(0, 20));
        expect(countForMode(user, "review", TODAY)).toBe(25);
    });
});

describe("buildModeQuestions: incorrect, flagged, skipped, correct", () => {
    it("incorrect: questions whose latest answer was wrong, in catalogue order", () => {
        const user = makeUser({
            questionProgress: [
                wrong("10"),
                wrong("2"),
                right("3"),
                skip("4"),
                flag("6"),
                wrong("BE-2"),
                wrong("7", { flagged: true }),
                right("8", { skipped: true }),
            ],
        });
        expect(build(user, "incorrect")).toEqual(["2", "7", "10", "BE-2"]);
    });

    it("flagged: flagged questions, whatever their answer", () => {
        const user = makeUser({
            questionProgress: [right("5", { flagged: true }), flag("1"), wrong("7", { flagged: true }), right("9"), skip("11")],
        });
        expect(build(user, "flagged")).toEqual(["1", "5", "7"]);
    });

    it("skipped: skipped questions and questions opened without an answer, but not those only flagged", () => {
        const user = makeUser({
            questionProgress: [
                skip("8"),
                right("3", { skipped: true }),
                entry("4", null),
                flag("5"),
                skip("6", { flagged: true }),
                wrong("7"),
                right("9"),
            ],
        });
        expect(build(user, "skipped")).toEqual(["3", "4", "6", "8"]);
    });

    it("correct: questions whose latest answer was right", () => {
        const user = makeUser({
            questionProgress: [right("12"), wrong("3"), right("BE-1"), skip("4"), right("2", { flagged: true })],
        });
        expect(build(user, "correct")).toEqual(["2", "12", "BE-1"]);
    });
});

describe("buildModeQuestions: state", () => {
    const progress = [
        right("BE-1"),
        flag("BE-2"),
        wrong("BE-3"),
        skip("BE-4"),
        wrong("BE-5"),
        right("BE-6", { flagged: true }),
        entry("BE-7", null),
        wrong("BE-9", { flagged: true }),
    ];
    const expected = ["BE-3", "BE-5", "BE-9", "BE-4", "BE-7", "BE-2", "BE-6", "BE-1", "BE-8", "BE-10"];

    it("offers the ten state questions: wrong, skipped, flagged, then the rest", () => {
        expect(build(makeUser({ questionProgress: progress }), "state")).toEqual(expected);
    });

    it("keeps catalogue order within each group, whatever the order of the progress entries", () => {
        expect(build(makeUser({ questionProgress: [...progress].reverse() }), "state")).toEqual(expected);
    });

    it("is never cut to the session size", () => {
        const user = withSessionSize(10, { questionProgress: progress });
        expect(buildModeQuestions(user, "state", { today: TODAY, sessionSize: 5 })).toHaveLength(10);
        expect(countForMode(user, "state", TODAY)).toBe(10);
    });

    it("leaves out general questions and other states", () => {
        const user = makeUser({ questionProgress: [wrong("1"), wrong("BY-1"), skip("BY-2")] });
        expect(build(user, "state")).toEqual(BERLIN_STATE_NUMS);
    });

    it("follows the learner's state", () => {
        const user = makeUser({ state: { stateName: "Bayern", stateCode: "BY" }, questionProgress: [wrong("BY-7")] });
        const result = build(user, "state");
        expect(result[0]).toBe("BY-7");
        expect([...result].sort()).toEqual(Array.from({ length: 10 }, (_, i) => `BY-${i + 1}`).sort());
    });
});

describe("buildModeQuestions: category", () => {
    const cleanCategory = (raw: string | null | undefined) => (raw ?? "").replace(/['"]/g, "").trim();

    it("matches categories after cleaning, including entries stored with stray quotes", () => {
        const raw = questionsData();
        // The catalogue stores some categories with quotes, e.g. "'Elections'".
        expect(raw.find((question) => question.num === "BE-4")?.category).toBe("'Elections'");
        expect(raw.find((question) => question.num === "153")?.category).toBe("'Elections'");

        const expected = raw
            .filter((question) => isBerlinQuestion(question.num) && cleanCategory(question.category) === "Elections")
            .map((question) => question.num);
        const result = build(makeUser(), "category", { category: "Elections" });
        expect(result).toEqual(expected);
        expect(result).toEqual(expect.arrayContaining(["153", "BE-3", "BE-4"]));
    });

    it("orders wrong answers first, then unanswered or skipped questions, then known ones", () => {
        const c = berlinCategory("Constitution");
        expect(c.length).toBeGreaterThan(6);
        const user = makeUser({
            questionProgress: [right(c[0]), wrong(c[5]), skip(c[1]), flag(c[2]), wrong(c[3]), right(c[4]), wrong("BE-1")],
        });
        expect(build(user, "category", { category: "Constitution" })).toEqual([
            c[3],
            c[5],
            c[1],
            c[2],
            ...c.slice(6),
            c[0],
            c[4],
        ]);
    });

    it("leaves out the topic's questions of other states", () => {
        expect(getRelevantQuestions("BY").find((question) => question.num === "BY-9")?.category).toBe("Federal System");
        expect(build(makeUser(), "category", { category: "Federal System" })).not.toContain("BY-9");
        const bavarian = makeUser({ state: { stateName: "Bayern", stateCode: "BY" } });
        expect(build(bavarian, "category", { category: "Federal System" })).toContain("BY-9");
    });

    it("accepts a category written with stray quotes or spaces", () => {
        const plain = build(makeUser(), "category", { category: "Elections" });
        expect(build(makeUser(), "category", { category: "'Elections'" })).toEqual(plain);
        expect(build(makeUser(), "category", { category: " Elections " })).toEqual(plain);
    });

    it("is empty for an unknown category", () => {
        expect(build(makeUser(), "category", { category: "Astronomy" })).toEqual([]);
        expect(countForMode(makeUser(), "category", TODAY, "Astronomy")).toBe(0);
    });

    it("covers every topic when no category is given", () => {
        expect(build(makeUser(), "category")).toEqual(BERLIN_NUMS);
        const user = makeUser({ questionProgress: [right("1"), wrong("200"), skip("3")] });
        const result = build(user, "category");
        expect(result).toHaveLength(310);
        expect(result[0]).toBe("200");
        expect(result.slice(1, 4)).toEqual(["2", "3", "4"]);
        expect(result[result.length - 1]).toBe("1");
        expect(countForMode(user, "category", TODAY)).toBe(310);
    });

    it("counts every topic of the learner's catalogue", () => {
        const user = makeUser();
        const topics = getCategoryCounts("BE");
        for (const { category, total } of topics) {
            expect(countForMode(user, "category", TODAY, category), category).toBe(total);
        }
        expect(topics.reduce((sum, topic) => sum + topic.total, 0)).toBe(310);
    });

    it("is cut to the session size", () => {
        const c = berlinCategory("Constitution");
        const user = withSessionSize(10, { questionProgress: [wrong(c[9])] });
        expect(nums(buildModeQuestions(user, "category", { today: TODAY, category: "Constitution", sessionSize: 3 }))).toEqual([
            c[9],
            c[0],
            c[1],
        ]);
        expect(buildModeQuestions(user, "category", { today: TODAY, category: "Constitution" })).toHaveLength(10);
    });
});

describe("buildModeQuestions: quick", () => {
    it("draws ten different questions from the learner's catalogue", () => {
        const result = build(makeUser(), "quick", { random: seeded(1) });
        expect(result).toHaveLength(QUICK_ROUND_SIZE);
        expect(new Set(result).size).toBe(QUICK_ROUND_SIZE);
        expect(result.every(isBerlinQuestion)).toBe(true);
    });

    it("is repeatable with the same random source and varies with another one", () => {
        const user = makeUser();
        const first = build(user, "quick", { random: seeded(42) });
        expect(build(user, "quick", { random: seeded(42) })).toEqual(first);
        expect(build(user, "quick", { random: seeded(7) })).not.toEqual(first);
    });

    it("draws with the given random source", () => {
        // Always 0: the partial shuffle never swaps, so the first ten questions are drawn.
        expect(build(makeUser(), "quick", { random: () => 0 })).toEqual(BERLIN_NUMS.slice(0, 10));
    });

    it("ignores the session size", () => {
        const user = withSessionSize(33);
        expect(build(user, "quick", { random: seeded(1), sessionSize: 3 })).toHaveLength(10);
        expect(build(user, "quick", { random: seeded(1), sessionSize: 0 })).toHaveLength(10);
        expect(buildModeQuestions(user, "quick", { today: TODAY, random: seeded(1) })).toHaveLength(10);
    });

    it("prefers questions the learner does not know yet", () => {
        // Wrong, only flagged, opened without an answer, skipped, or never opened.
        const unknown = ["1", "2", "3", "50", "120", "200", "250", "299", "300", "BE-1", "BE-5", "BE-10"];
        const user = makeUser({
            questionProgress: [
                ...BERLIN_NUMS.filter((num) => !unknown.includes(num)).map((num) => right(num)),
                wrong("1"),
                flag("2"),
                entry("3", null),
                skip("BE-10"),
            ],
        });
        for (let seed = 1; seed <= 20; seed++) {
            const result = build(user, "quick", { random: seeded(seed) });
            expect(result).toHaveLength(10);
            expect(new Set(result).size).toBe(10);
            expect(unknown, `seed ${seed}`).toEqual(expect.arrayContaining(result));
        }
    });

    it("fills up with known questions when fewer than ten are unknown", () => {
        // "5" wrong, "77" skipped, "300" only flagged, "BE-2" never opened; everything else known.
        const unknown = ["5", "77", "300", "BE-2"];
        const user = makeUser({
            questionProgress: [
                ...BERLIN_NUMS.filter((num) => !unknown.includes(num)).map((num) => right(num)),
                wrong("5"),
                skip("77"),
                flag("300"),
            ],
        });
        let knownFirst = false;
        for (let seed = 1; seed <= 20; seed++) {
            const result = build(user, "quick", { random: seeded(seed) });
            expect(result).toHaveLength(10);
            expect(new Set(result).size).toBe(10);
            expect(result).toEqual(expect.arrayContaining(unknown));
            expect(result.every(isBerlinQuestion)).toBe(true);
            knownFirst ||= !unknown.includes(result[0]);
        }
        // The known questions are mixed in, not always put last.
        expect(knownFirst).toBe(true);
    });

    it("draws from known questions when the learner knows everything", () => {
        const user = makeUser({ questionProgress: BERLIN_NUMS.map((num) => right(num)) });
        const result = build(user, "quick", { random: seeded(9) });
        expect(result).toHaveLength(10);
        expect(new Set(result).size).toBe(10);
    });

    it("copes with a random source outside 0..1", () => {
        for (const random of [() => 1, () => -3, () => Number.NaN, () => 0.9999999]) {
            const result = build(makeUser(), "quick", { random });
            expect(result).toHaveLength(10);
            expect(new Set(result).size).toBe(10);
            expect(result.every(isBerlinQuestion)).toBe(true);
        }
    });

    it("counts a round of ten", () => {
        expect(countForMode(makeUser(), "quick", TODAY)).toBe(10);
        expect(countForMode(makeUser({ questionProgress: BERLIN_NUMS.map((num) => right(num)) }), "quick", TODAY)).toBe(10);
    });
});

describe("buildModeQuestions: marathon", () => {
    it("starts at the first question without a progress entry and wraps around", () => {
        const user = makeUser({ questionProgress: [right("1"), wrong("2"), skip("4")] });
        expect(build(user, "marathon")).toEqual([...BERLIN_NUMS.slice(2), ...BERLIN_NUMS.slice(0, 2)]);
    });

    it("starts at the first question when nothing was opened yet", () => {
        expect(build(makeUser(), "marathon")).toEqual(BERLIN_NUMS);
    });

    it("starts at the first question when every question was opened", () => {
        const user = makeUser({ questionProgress: BERLIN_NUMS.map((num) => right(num)) });
        expect(build(user, "marathon")).toEqual(BERLIN_NUMS);
    });

    it("continues with the state questions after the general ones", () => {
        const user = makeUser({ questionProgress: BERLIN_NUMS.slice(0, 300).map((num) => right(num)) });
        const result = build(user, "marathon");
        expect(result.slice(0, 10)).toEqual(BERLIN_STATE_NUMS);
        expect(result.slice(10)).toEqual(BERLIN_NUMS.slice(0, 300));
    });

    it("is not moved by answers from another state", () => {
        const user = makeUser({ questionProgress: [right("BY-1"), right("BY-2")] });
        expect(build(user, "marathon")[0]).toBe("1");
    });

    it("is cut to the session size and counts the whole catalogue", () => {
        const user = makeUser({ questionProgress: [right("1"), right("2")] });
        expect(nums(buildModeQuestions(user, "marathon", { today: TODAY }))).toEqual(BERLIN_NUMS.slice(2, 22));
        expect(countForMode(user, "marathon", TODAY)).toBe(310);
    });
});

describe("buildModeQuestions: session size", () => {
    it("uses the learner's preference, 20 by default", () => {
        expect(buildModeQuestions(makeUser(), "new", { today: TODAY })).toHaveLength(20);
        expect(buildModeQuestions(withSessionSize(33), "new", { today: TODAY })).toHaveLength(33);
        expect(buildModeQuestions(withSessionSize(0), "new", { today: TODAY })).toHaveLength(310);
    });

    it("falls back to the default when stored preferences lack a session size", () => {
        const user = withSessionSize(undefined as unknown as number);
        expect(buildModeQuestions(user, "new", { today: TODAY })).toHaveLength(DEFAULT_PREFERENCES.sessionSize);
    });

    it("lets the options override the preference, with 0 meaning all", () => {
        expect(buildModeQuestions(withSessionSize(33), "new", { today: TODAY, sessionSize: 10 })).toHaveLength(10);
        expect(buildModeQuestions(withSessionSize(10), "new", { today: TODAY, sessionSize: 0 })).toHaveLength(310);
    });

    it("keeps the first questions of the mode's order", () => {
        expect(nums(buildModeQuestions(makeUser(), "new", { today: TODAY, sessionSize: 3 }))).toEqual(["1", "2", "3"]);
    });

    it("returns smaller sets whole", () => {
        const user = makeUser({ questionProgress: [wrong("1"), wrong("2"), wrong("3")] });
        expect(buildModeQuestions(user, "incorrect", { today: TODAY, sessionSize: 3 })).toHaveLength(3);
        expect(buildModeQuestions(user, "incorrect", { today: TODAY, sessionSize: 20 })).toHaveLength(3);
    });

    it("treats sizes below 1 or not a number as all, and rounds fractions down", () => {
        const user = makeUser();
        expect(buildModeQuestions(user, "new", { today: TODAY, sessionSize: -5 })).toHaveLength(310);
        expect(buildModeQuestions(user, "new", { today: TODAY, sessionSize: Number.NaN })).toHaveLength(310);
        expect(buildModeQuestions(user, "new", { today: TODAY, sessionSize: 0.5 })).toHaveLength(310);
        expect(buildModeQuestions(user, "new", { today: TODAY, sessionSize: 7.9 })).toHaveLength(7);
    });
});

describe("buildModeQuestions: start question", () => {
    it("moves a question the mode asks anyway to the front", () => {
        const user = makeUser({ questionProgress: [wrong("3"), wrong("7"), wrong("12")] });
        expect(build(user, "incorrect", { startNum: "12" })).toEqual(["12", "3", "7"]);
        expect(build(user, "incorrect", { startNum: "3" })).toEqual(["3", "7", "12"]);
        expect(build(user, "new", { startNum: "5" }).slice(0, 4)).toEqual(["5", "1", "2", "4"]);
        expect(build(user, "new", { startNum: "5" })).toHaveLength(307);
    });

    it("adds a question the mode would not ask, even to an empty mode", () => {
        const user = makeUser({ questionProgress: [wrong("3"), right("12")] });
        expect(build(user, "incorrect", { startNum: "12" })).toEqual(["12", "3"]);
        expect(build(user, "review", { startNum: "BE-2" })).toEqual(["BE-2"]);
        expect(build(makeUser(), "flagged", { startNum: "300" })).toEqual(["300"]);
    });

    it("returns the full catalogue question", () => {
        expect(buildModeQuestions(makeUser(), "review", { today: TODAY, startNum: "42" })).toEqual([getQuestion("42")]);
    });

    it("ignores a number outside the learner's catalogue", () => {
        const user = makeUser({ questionProgress: [wrong("3")] });
        for (const startNum of ["999", "0", "BY-1", "HH-2", "be-2", "", "   ", "abc", "../x", "12 OR 1", "__proto__", "constructor", "1 2"]) {
            expect(build(user, "incorrect", { startNum }), JSON.stringify(startNum)).toEqual(["3"]);
        }
        expect(build(user, "incorrect", { startNum: undefined })).toEqual(["3"]);
        expect(build(user, "incorrect")).toEqual(["3"]);
    });

    it("accepts a number with stray quotes or spaces", () => {
        const user = makeUser({ questionProgress: [wrong("3")] });
        expect(build(user, "incorrect", { startNum: " 12 " })).toEqual(["12", "3"]);
        expect(build(user, "incorrect", { startNum: "'BE-2'" })).toEqual(["BE-2", "3"]);
        expect(build(user, "incorrect", { startNum: '"7"' })).toEqual(["7", "3"]);
    });

    it("keeps the start question through the session-size cut", () => {
        // "8" is the eighth new question (index 7); a session of five would cut it away.
        expect(nums(buildModeQuestions(makeUser(), "new", { today: TODAY, sessionSize: 5, startNum: "8" }))).toEqual(["8", "1", "2", "3", "4"]);
        // The same for a question the mode would not ask.
        const user = makeUser({ questionProgress: [right("BE-10")] });
        expect(nums(buildModeQuestions(user, "new", { today: TODAY, sessionSize: 5, startNum: "BE-10" }))).toEqual(["BE-10", "1", "2", "3", "4"]);
        // The learner's preference counts too.
        expect(nums(buildModeQuestions(withSessionSize(3), "marathon", { today: TODAY, startNum: "250" }))).toEqual(["250", "1", "2"]);
        expect(buildModeQuestions(withSessionSize(0), "new", { today: TODAY, startNum: "250" })).toHaveLength(310);
    });

    it("keeps the quick round at ten questions with the start question first", () => {
        const user = makeUser();
        // Drawn with a random source of 0: the first ten questions. "5" is among them, "250" is not.
        expect(build(user, "quick", { random: () => 0, startNum: "5" })).toEqual(["5", "1", "2", "3", "4", "6", "7", "8", "9", "10"]);
        expect(build(user, "quick", { random: () => 0, startNum: "250" })).toEqual(["250", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
        for (let seed = 1; seed <= 10; seed++) {
            const result = build(user, "quick", { random: seeded(seed), startNum: "BE-3", sessionSize: 3 });
            expect(result, `seed ${seed}`).toHaveLength(QUICK_ROUND_SIZE);
            expect(result[0], `seed ${seed}`).toBe("BE-3");
            expect(new Set(result).size, `seed ${seed}`).toBe(QUICK_ROUND_SIZE);
            expect(result.every(isBerlinQuestion), `seed ${seed}`).toBe(true);
        }
    });

    it("opens the state mode with the start question and never cuts it", () => {
        const user = makeUser({ questionProgress: [wrong("BE-3")] });
        expect(nums(buildModeQuestions(user, "state", { today: TODAY, sessionSize: 2, startNum: "BE-7" }))).toEqual([
            "BE-7",
            "BE-3",
            "BE-1",
            "BE-2",
            "BE-4",
            "BE-5",
            "BE-6",
            "BE-8",
            "BE-9",
            "BE-10",
        ]);
        // A general question is added in front of the ten state questions.
        const withGeneral = build(user, "state", { startNum: "12" });
        expect(withGeneral[0]).toBe("12");
        expect(withGeneral).toHaveLength(11);
        expect(withGeneral.slice(1)).toEqual(["BE-3", ...BERLIN_STATE_NUMS.filter((num) => num !== "BE-3")]);
    });

    it("works for every mode and keeps every question unique", () => {
        const user = mixedLearner();
        for (const mode of ALL_MODES) {
            for (const startNum of ["2", "42", "BE-1", "BE-10"]) {
                const result = build(user, mode, { random: seeded(2), startNum, category: "Constitution" });
                expect(result[0], `${mode} ${startNum}`).toBe(startNum);
                expect(new Set(result).size, `${mode} ${startNum}`).toBe(result.length);
                expect(result.every(isBerlinQuestion), `${mode} ${startNum}`).toBe(true);
            }
        }
    });

    it("follows the learner's state", () => {
        const bavarian = makeUser({ state: { stateName: "Bayern", stateCode: "BY" } });
        expect(build(bavarian, "new", { startNum: "BY-4" })[0]).toBe("BY-4");
        expect(build(bavarian, "new", { startNum: "BE-4" })[0]).toBe("1");
        const stateless = makeUser({ state: { stateName: "", stateCode: "" } });
        expect(build(stateless, "new", { startNum: "BE-4" })[0]).toBe("1");
        expect(build(stateless, "new", { startNum: "77" })[0]).toBe("77");
    });

    it("leaves the counts alone", () => {
        const user = makeUser({ questionProgress: [wrong("3")] });
        buildModeQuestions(user, "incorrect", { today: TODAY, startNum: "12" });
        expect(countForMode(user, "incorrect", TODAY)).toBe(1);
        expect(modeCounts(user, TODAY).incorrect).toBe(1);
    });
});

describe("countForMode and modeCounts", () => {
    it("counts every question a mode has to offer, ignoring the session size", () => {
        const user = mixedLearner();
        for (const mode of ALL_MODES.filter((id) => id !== "quick")) {
            expect(countForMode(user, mode, TODAY), mode).toBe(build(user, mode).length);
        }
        expect(countForMode(user, "category", TODAY, "Constitution")).toBe(berlinCategory("Constitution").length);
    });

    it("reports every mode for a fresh learner", () => {
        expect(modeCounts(makeUser(), TODAY)).toEqual({
            new: 310,
            review: 0,
            incorrect: 0,
            flagged: 0,
            skipped: 0,
            state: 10,
            category: 310,
            quick: 10,
            marathon: 310,
            correct: 0,
        });
    });

    it("reports every mode for a learner with progress of every kind", () => {
        expect(modeCounts(mixedLearner(), TODAY)).toEqual({
            new: 299,
            review: 3,
            incorrect: 3,
            flagged: 3,
            skipped: 4,
            state: 10,
            category: 310,
            quick: 10,
            marathon: 310,
            correct: 4,
        });
    });

    it("agrees with countForMode", () => {
        const user = mixedLearner();
        const counts = modeCounts(user, TODAY);
        expect(Object.keys(counts).sort()).toEqual([...ALL_MODES].sort());
        for (const mode of ALL_MODES) {
            expect(counts[mode], mode).toBe(countForMode(user, mode, TODAY));
        }
    });

    it("counts the review questions due on the given day", () => {
        const user = mixedLearner();
        expect(countForMode(user, "review", YESTERDAY)).toBe(2);
        expect(countForMode(user, "review", TOMORROW)).toBe(4);
    });
});

describe("suggestNextAction", () => {
    const dueNums = ["11", "12", "13", "14", "15"];
    const wrongNums = ["21", "22", "23", "24", "25", "26"];
    const unopened = ["31", "32", "33"];

    /** A learner who opened every Berlin question except `unopened` and knows all but `wrong`. */
    function learner(options: { wrong?: string[]; due?: string[]; unopened?: string[] } = {}): User {
        const wrongSet = new Set(options.wrong ?? []);
        const unopenedSet = new Set(options.unopened ?? []);
        return makeUser({
            questionProgress: BERLIN_NUMS.filter((num) => !unopenedSet.has(num)).map((num) =>
                wrongSet.has(num) ? wrong(num) : right(num),
            ),
            reviewSchedule: (options.due ?? []).map((num) => due(num, YESTERDAY)),
        });
    }

    it("suggests the review backlog first once five or more questions are due", () => {
        const user = learner({ due: dueNums, wrong: wrongNums, unopened });
        expect(suggestNextAction(user, TODAY)).toEqual({ kind: "mode", mode: "review", count: 5 });
    });

    it("suggests fixing mistakes next once five or more answers are wrong", () => {
        const user = learner({ due: dueNums.slice(0, 4), wrong: wrongNums.slice(0, 5), unopened });
        expect(suggestNextAction(user, TODAY)).toEqual({ kind: "mode", mode: "incorrect", count: 5 });
    });

    it("suggests new questions when the backlogs are small", () => {
        const user = learner({ due: dueNums.slice(0, 4), wrong: wrongNums.slice(0, 4), unopened });
        expect(suggestNextAction(user, TODAY)).toEqual({ kind: "mode", mode: "new", count: 3 });
        expect(suggestNextAction(makeUser(), TODAY)).toEqual({ kind: "mode", mode: "new", count: 310 });
    });

    it("suggests the remaining due questions when nothing is new", () => {
        const user = learner({ due: dueNums.slice(0, 2), wrong: wrongNums.slice(0, 4) });
        expect(suggestNextAction(user, TODAY)).toEqual({ kind: "mode", mode: "review", count: 2 });
    });

    it("suggests the remaining mistakes when nothing is new or due", () => {
        expect(suggestNextAction(learner({ wrong: ["21"] }), TODAY)).toEqual({ kind: "mode", mode: "incorrect", count: 1 });
    });

    it("suggests a mock exam when nothing is left to practice", () => {
        expect(suggestNextAction(learner(), TODAY)).toEqual({ kind: "mock" });
    });

    it("ignores questions of other states and questions due later", () => {
        const base = learner();
        const bavarian = ["BY-1", "BY-2", "BY-3", "BY-4", "BY-5", "BY-6"];
        const user: User = {
            ...base,
            questionProgress: [...base.questionProgress, ...bavarian.map((num) => wrong(num))],
            reviewSchedule: [
                ...bavarian.map((num) => due(num, YESTERDAY)),
                ...dueNums.map((num) => due(num, TOMORROW)),
                due("21", TOMORROW),
            ],
        };
        expect(suggestNextAction(user, TODAY)).toEqual({ kind: "mock" });
        expect(suggestNextAction(user, TOMORROW)).toEqual({ kind: "mode", mode: "review", count: 6 });
    });
});

describe("splitStudyModes", () => {
    const ids = (modes: { id: StudyModeId }[]) => modes.map((mode) => mode.id);

    it("shows new questions, review, mistakes, and the quick round first without a recommendation", () => {
        for (const split of [splitStudyModes(STUDY_MODES), splitStudyModes(STUDY_MODES, null)]) {
            expect(ids(split.primary)).toEqual(["new", "review", "incorrect", "quick"]);
            expect(ids(split.more)).toEqual(["flagged", "skipped", "state", "category", "marathon", "correct"]);
        }
    });

    it("returns the given definitions, not copies", () => {
        const { primary, more } = splitStudyModes(STUDY_MODES, "new");
        expect(primary[0]).toBe(getStudyMode("new"));
        expect(more[0]).toBe(getStudyMode("flagged"));
    });

    it("puts the recommended mode first and gives its old slot back to new questions", () => {
        expect(ids(splitStudyModes(STUDY_MODES, "review").primary)).toEqual(["review", "incorrect", "quick", "new"]);
        expect(ids(splitStudyModes(STUDY_MODES, "incorrect").primary)).toEqual(["incorrect", "review", "quick", "new"]);
        expect(ids(splitStudyModes(STUDY_MODES, "quick").primary)).toEqual(["quick", "review", "incorrect", "new"]);
        expect(ids(splitStudyModes(STUDY_MODES, "review").more)).toEqual(["flagged", "skipped", "state", "category", "marathon", "correct"]);
    });

    it("lets a recommendation outside the four displace new questions", () => {
        const { primary, more } = splitStudyModes(STUDY_MODES, "state");
        expect(ids(primary)).toEqual(["state", "review", "incorrect", "quick"]);
        expect(ids(more)).toEqual(["new", "flagged", "skipped", "category", "marathon", "correct"]);
    });

    it("always shows four modes, lists every mode once, and keeps the display order of the rest", () => {
        for (const recommended of [null, ...ALL_MODES]) {
            const { primary, more } = splitStudyModes(STUDY_MODES, recommended);
            expect(primary, String(recommended)).toHaveLength(4);
            expect([...ids(primary), ...ids(more)].sort(), String(recommended)).toEqual([...ALL_MODES].sort());
            expect(ids(more), String(recommended)).toEqual(ALL_MODES.filter((id) => more.some((mode) => mode.id === id)));
        }
    });

    it("fills the four slots from the display order when a preferred mode is missing", () => {
        const modes = STUDY_MODES.filter((mode) => mode.id !== "review" && mode.id !== "quick");
        const { primary, more } = splitStudyModes(modes);
        expect(ids(primary)).toEqual(["new", "incorrect", "flagged", "skipped"]);
        expect(ids(more)).toEqual(["state", "category", "marathon", "correct"]);
    });

    it("ignores a recommendation that is not among the given modes", () => {
        const modes = STUDY_MODES.filter((mode) => mode.id !== "state");
        expect(ids(splitStudyModes(modes, "state").primary)).toEqual(["new", "review", "incorrect", "quick"]);
    });

    it("shows everything when there are four modes or fewer", () => {
        expect(splitStudyModes(STUDY_MODES.slice(0, 3))).toEqual({ primary: STUDY_MODES.slice(0, 3), more: [] });
        expect(splitStudyModes([])).toEqual({ primary: [], more: [] });
    });

    it("does not change the given list", () => {
        const modes = deepFreeze(STUDY_MODES.map((mode) => ({ ...mode })));
        expect(() => splitStudyModes(modes, "review")).not.toThrow();
        expect(ids(modes)).toEqual(ALL_MODES);
    });
});

describe("modeHref", () => {
    it("links every mode to the practice session", () => {
        for (const mode of ALL_MODES) {
            expect(modeHref(mode)).toBe(`/prepare?action=${mode}`);
        }
    });

    it("adds the encoded category to the category mode", () => {
        expect(modeHref("category", "Law & Governance")).toBe("/prepare?action=category&category=Law%20%26%20Governance");
        expect(modeHref("category", "Elections")).toBe("/prepare?action=category&category=Elections");
    });

    it("keeps every catalogue category intact through the query string", () => {
        for (const { category } of getCategoryCounts("BE")) {
            const params = new URLSearchParams(modeHref("category", category).split("?")[1]);
            expect(params.get("action")).toBe("category");
            expect(params.get("category")).toBe(category);
        }
    });

    it("leaves out an empty category and categories of other modes", () => {
        expect(modeHref("category")).toBe("/prepare?action=category");
        expect(modeHref("category", "")).toBe("/prepare?action=category");
        expect(modeHref("quick", "Elections")).toBe("/prepare?action=quick");
    });

    it("adds the encoded start question after the other parameters", () => {
        expect(modeHref("review", undefined, "12")).toBe("/prepare?action=review&start=12");
        expect(modeHref("quick", undefined, "BE-3")).toBe("/prepare?action=quick&start=BE-3");
        expect(modeHref("category", "Law & Governance", "7")).toBe("/prepare?action=category&category=Law%20%26%20Governance&start=7");
        expect(modeHref("new", "Elections", "a b&c=d/e?")).toBe("/prepare?action=new&start=a%20b%26c%3Dd%2Fe%3F");
    });

    it("leaves out an empty start question", () => {
        expect(modeHref("new", undefined, "")).toBe("/prepare?action=new");
        expect(modeHref("new", undefined, undefined)).toBe("/prepare?action=new");
        expect(modeHref("category", "Elections", "")).toBe("/prepare?action=category&category=Elections");
    });
});

describe("parseModeParam", () => {
    it("maps the actions of version 2.0", () => {
        expect(parseModeParam("prepare")).toBe("new");
        expect(parseModeParam("random")).toBe("quick");
        expect(parseModeParam("failed")).toBe("incorrect");
    });

    it("maps every mode id to itself", () => {
        for (const mode of ALL_MODES) {
            expect(parseModeParam(mode)).toBe(mode);
        }
    });

    it("starts with new questions for a missing or unknown action", () => {
        for (const action of [null, "", "mock", "unknown", "constructor", "__proto__", "toString", "hasOwnProperty"]) {
            expect(parseModeParam(action), String(action)).toBe("new");
        }
    });

    it("ignores case and surrounding spaces", () => {
        expect(parseModeParam(" Review ")).toBe("review");
        expect(parseModeParam("QUICK")).toBe("quick");
        expect(parseModeParam("Random")).toBe("quick");
    });

    it("reads back every link made by modeHref", () => {
        for (const mode of ALL_MODES) {
            const params = new URLSearchParams(modeHref(mode, "Elections").split("?")[1]);
            expect(parseModeParam(params.get("action"))).toBe(mode);
        }
    });
});

describe("parseStartParam", () => {
    it("accepts general and state question numbers", () => {
        expect(parseStartParam("12")).toBe("12");
        expect(parseStartParam("300")).toBe("300");
        expect(parseStartParam("BE-3")).toBe("BE-3");
        expect(parseStartParam("NW-10")).toBe("NW-10");
    });

    it("accepts every number of the catalogue", () => {
        for (const { num } of getQuestionBank()) {
            expect(parseStartParam(num), num).toBe(num);
        }
    });

    it("trims surrounding spaces", () => {
        expect(parseStartParam(" 12 ")).toBe("12");
        expect(parseStartParam("\tBE-3\n")).toBe("BE-3");
    });

    it("rejects a missing value and anything that is not shaped like a number", () => {
        const rejected = [null, undefined, "", "   ", "../x", "12 OR 1", "a".repeat(40), "123456789", "12?x=1", "'12'", "1/2", "BE_3", "12.5", "<b>", "%31"];
        for (const value of rejected) {
            expect(parseStartParam(value), JSON.stringify(value)).toBeUndefined();
        }
    });

    it("reads back every start question written by modeHref", () => {
        for (const num of ["12", "300", "BE-3", "NW-10"]) {
            for (const mode of ALL_MODES) {
                const params = new URLSearchParams(modeHref(mode, "Elections", num).split("?")[1]);
                expect(parseModeParam(params.get("action"))).toBe(mode);
                expect(parseStartParam(params.get("start"))).toBe(num);
            }
        }
        expect(parseStartParam(new URLSearchParams(modeHref("review").split("?")[1]).get("start"))).toBeUndefined();
    });
});

describe("purity", () => {
    it("never changes the learner record or the catalogue", () => {
        const user = mixedLearner();
        const before = JSON.stringify(user);
        deepFreeze(user);
        for (const mode of ALL_MODES) {
            buildModeQuestions(user, mode, { today: TODAY, random: seeded(5) });
            buildModeQuestions(user, mode, { today: TODAY, category: "Elections", sessionSize: 0, random: seeded(6) });
            buildModeQuestions(user, mode, { today: TODAY, startNum: "42", random: seeded(7) });
            countForMode(user, mode, TODAY, "Elections");
        }
        modeCounts(user, TODAY);
        suggestNextAction(user, TODAY);
        expect(JSON.stringify(user)).toBe(before);
        expect(getRelevantQuestions("BE").map((question) => question.num)).toEqual(BERLIN_NUMS);
    });

    it("returns a new list on every call", () => {
        const user = makeUser();
        const first = buildModeQuestions(user, "marathon", { today: TODAY, sessionSize: 0 });
        first.splice(0, first.length);
        expect(buildModeQuestions(user, "marathon", { today: TODAY, sessionSize: 0 })).toHaveLength(310);
        const state = buildModeQuestions(user, "state", { today: TODAY });
        state.reverse();
        expect(build(user, "state")).toEqual(BERLIN_STATE_NUMS);
    });
});
