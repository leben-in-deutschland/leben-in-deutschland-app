import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTranslations } from "@/data/data";
import type { MockTestProgress, User } from "@/types/user";
import { buildAchievementContext, newlyEarned } from "@/utils/achievements";
import { addDays, dayKey, parseDayKey } from "@/utils/date-utils";
import { runEngagement } from "@/utils/engagement";
import { planNotifications } from "@/utils/notification-planner";
import { applyMockToUser, gradeMock, mockScore, recordAnswer, recordSkip, toggleFlag } from "@/utils/practice-logic";
import { getQuestion, getRelevantQuestions, getStateQuestions } from "@/utils/question-bank";
import { computeReadiness } from "@/utils/readiness-logic";
import { dueCount } from "@/utils/review-schedule";
import { activityCalendar, computeStreak, goalProgress, weekView } from "@/utils/streak-logic";
import { buildModeQuestions, modeCounts, STUDY_MODES, suggestNextAction } from "@/utils/study-modes";
import { CURRENT_SCHEMA_VERSION, migrateUser, normalizeUser, passMarkOf, prefsOf } from "@/utils/user-defaults";
import { readUser, updateUser, writeUser } from "@/utils/user-store";
import { parseBackup } from "@/services/file";
import DEVICE_RECORD from "./fixtures/legacy-user-2.0-device.json";

/*
 * Backward compatibility with records written by version 2.0 and earlier.
 *
 * The fixtures below are byte-for-byte the shapes the old app stored under
 * localStorage["user"]: `dailyProgress.date` as `Date.toDateString()`,
 * `appFirstTimeOpenDateTime` as an ISO string, mock exams without pass mark,
 * exam type, or timer flag, unanswered mock questions with `answerSelected: ""`,
 * and no preferences, streak, schedule, achievements, inbox, or schema version.
 */

const TODAY = "2026-10-09";
const NOW = new Date(2026, 9, 9, 18, 30);
const EVALUATION = { examDate: "15.07.2026", lastSyncAt: "2026-10-01", history: [] };

function legacyDate(day: string): string {
    return parseDayKey(day).toDateString();
}

const BE_NUMS = getRelevantQuestions("BE").map((question) => question.num);
const BE_STATE_NUMS = getStateQuestions("BE").map((question) => question.num);

/** Record right after choosing a state in 2.0 (`saveStateChange`). */
const LEGACY_FRESH = {
    state: { stateCode: "BE", stateName: "Berlin" },
    dailyProgress: [{ attempted: 0, date: legacyDate(TODAY), correct: 0, incorrect: 0, skipped: 0, flagged: 0 }],
    questionProgress: [],
    id: "",
    testProgress: [],
    appLanguage: "de",
    appFirstTimeOpenDateTime: "2026-10-09T08:00:00.000Z",
    lastReviewPromptDateTime: null,
    reviewNoCount: 0,
    userReviewed: false,
};

/** A 2.0 mock exam: 33 questions, unanswered ones stored with an empty answer. */
function legacyMock(datetime: string, passed: boolean, cancelled = false): MockTestProgress {
    const nums = [...BE_NUMS.slice(100, 130), ...BE_STATE_NUMS.slice(0, 3)];
    return {
        datetime,
        timeTake: "1543",
        passed,
        cancelled,
        questions: nums.map((num, index) => {
            const question = getQuestion(num)!;
            if (index % 11 === 10) {
                return { answeredCorrectly: false, answerSelected: "", num, skipped: index % 2 === 0, flagged: false };
            }
            const correct = passed ? index % 5 !== 0 : index % 3 === 0;
            const wrongOption = question.solution === "a" ? "b" : "a";
            return { answeredCorrectly: correct, answerSelected: correct ? question.solution : wrongOption, num, skipped: false, flagged: index === 4 };
        }),
    };
}

/** A learner who used 2.0 for a while. */
const LEGACY_ACTIVE = {
    state: { stateCode: "BE", stateName: "Berlin" },
    dailyProgress: [
        { attempted: 12, date: legacyDate(addDays(TODAY, -9)), correct: 8, incorrect: 3, skipped: 1, flagged: 1 },
        { attempted: 20, date: legacyDate(addDays(TODAY, -2)), correct: 15, incorrect: 5, skipped: 0, flagged: 0 },
        { attempted: 35, date: legacyDate(addDays(TODAY, -1)), correct: 24, incorrect: 9, skipped: 2, flagged: 0 },
        { attempted: 4, date: legacyDate(TODAY), correct: 3, incorrect: 1, skipped: 0, flagged: 0 },
    ],
    questionProgress: [
        ...BE_NUMS.slice(0, 40).map((num, index) => ({
            num,
            answeredCorrectly: index % 4 !== 3,
            skipped: false,
            answerSelected: index % 4 !== 3 ? getQuestion(num)!.solution : "d",
            flagged: index % 10 === 0,
        })),
        // Skipped in 2.0: no answer yet.
        { num: BE_NUMS[40], answeredCorrectly: null, skipped: true, answerSelected: null, flagged: false },
        // Flagged without answering.
        { num: BE_NUMS[41], answeredCorrectly: null, skipped: false, answerSelected: null, flagged: true },
        // Written by the 2.0 mock sync for a question the learner never answered.
        { num: BE_NUMS[42], answeredCorrectly: false, skipped: false, answerSelected: "", flagged: false },
        { num: BE_STATE_NUMS[0], answeredCorrectly: true, skipped: false, answerSelected: getQuestion(BE_STATE_NUMS[0])!.solution, flagged: false },
    ],
    id: "",
    testProgress: [
        legacyMock("2026-10-01T17:12:00.000Z", false),
        legacyMock("2026-10-03T09:30:00.000Z", false, true),
        legacyMock("2026-10-07T19:05:00.000Z", true),
    ],
    appLanguage: "en",
    appFirstTimeOpenDateTime: "2026-08-14T06:21:43.123Z",
    lastReviewPromptDateTime: "2026-09-20T18:00:00.000Z",
    reviewNoCount: 1,
    userReviewed: false,
};

/** An even older record without the review and language fields. */
const LEGACY_MINIMAL = {
    state: { stateCode: "BY", stateName: "Bayern" },
    dailyProgress: [{ attempted: 3, date: "Sun Mar 03 2024", correct: 2, incorrect: 1, skipped: 0, flagged: 0 }],
    questionProgress: [{ num: "1", answeredCorrectly: true, skipped: false, answerSelected: getQuestion("1")!.solution, flagged: false }],
    id: "",
    testProgress: [],
};

/** Everything the app does with a record on start: read, upgrade once, run engagement, save. */
function startApp(raw: string): User {
    window.localStorage.setItem("user", raw);
    const loaded = readUser();
    expect(loaded).not.toBeNull();
    updateUser((draft) => {
        const next = migrateUser(draft, TODAY);
        next.lastOpenedAt = NOW.toISOString();
        return next;
    });
    const current = readUser()!;
    const { user } = runEngagement(current, { now: NOW, evaluation: EVALUATION });
    if (user !== current) {
        writeUser(user);
    }
    return readUser()!;
}

/** Every pure consumer of the record. Throws when any of them chokes on the data. */
function exerciseEverything(user: User): void {
    computeStreak(user, TODAY);
    goalProgress(user, TODAY);
    weekView(user, TODAY);
    activityCalendar(user, TODAY);
    computeReadiness(user);
    dueCount(user.reviewSchedule, TODAY);
    modeCounts(user, TODAY);
    for (const mode of STUDY_MODES) {
        buildModeQuestions(user, mode.id, { today: TODAY, random: () => 0.5 });
    }
    suggestNextAction(user, TODAY);
    for (const test of user.testProgress) {
        mockScore(test);
        passMarkOf(test);
    }
    newlyEarned(buildAchievementContext(user, TODAY));
    planNotifications(user, getTranslations("de"), NOW);
    planNotifications(user, getTranslations("en"), NOW);
}

describe("records written by older app versions", () => {
    beforeEach(() => {
        window.localStorage.clear();
    });
    afterEach(() => {
        window.localStorage.clear();
    });

    it("keeps every answer, mock exam, and day of a 2.0 record", () => {
        const user = startApp(JSON.stringify(LEGACY_ACTIVE));

        expect(user.state).toEqual({ stateCode: "BE", stateName: "Berlin" });
        expect(user.appLanguage).toBe("en");
        expect(user.questionProgress).toEqual(LEGACY_ACTIVE.questionProgress);
        expect(user.testProgress).toEqual(LEGACY_ACTIVE.testProgress);
        expect(user.dailyProgress).toEqual(LEGACY_ACTIVE.dailyProgress);
        expect(user.appFirstTimeOpenDateTime).toBe(LEGACY_ACTIVE.appFirstTimeOpenDateTime);
        expect(user.lastReviewPromptDateTime).toBe(LEGACY_ACTIVE.lastReviewPromptDateTime);
        expect(user.reviewNoCount).toBe(1);
        expect(user.userReviewed).toBe(false);
    });

    it("skips onboarding for learners who already chose a state", () => {
        for (const raw of [LEGACY_FRESH, LEGACY_ACTIVE, LEGACY_MINIMAL]) {
            const user = startApp(JSON.stringify(raw));
            expect(user.onboardingCompleted, raw.state.stateCode).toBe(true);
            expect(user.state.stateCode).toBe(raw.state.stateCode);
        }
    });

    it("upgrades the record once and fills every new field with a default", () => {
        const user = startApp(JSON.stringify(LEGACY_ACTIVE));

        expect(user.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
        expect(user.preferences).toEqual(prefsOf(undefined));
        // The first run records the running 3-day streak as the best one.
        expect(user.streak).toEqual({ best: 3, freezes: 0, frozenDays: [], freezeEarnedDays: [] });
        expect(user.examDate).toBeNull();
        expect(user.nickname).toBe("");
        expect(Array.isArray(user.inbox)).toBe(true);
        expect(Array.isArray(user.achievements)).toBe(true);

        // Answered questions are scheduled for review; skipped and flagged-only ones are not.
        const scheduled = new Set(user.reviewSchedule!.map((item) => item.num));
        expect(scheduled.has(BE_NUMS[0])).toBe(true);
        expect(scheduled.has(BE_NUMS[40])).toBe(false);
        expect(scheduled.has(BE_NUMS[41])).toBe(false);
        expect(user.reviewSchedule!.length).toBe(42);

        // Running the upgrade again changes nothing.
        expect(migrateUser(user, TODAY)).toBe(user);
    });

    it("recognises the streak and today's progress from legacy day entries", () => {
        const user = startApp(JSON.stringify(LEGACY_ACTIVE));
        const streak = computeStreak(user, TODAY);
        expect(streak.current).toBe(3);
        expect(streak.todayDone).toBe(true);
        // Older entries have no `answered`; correct + incorrect is used instead.
        expect(goalProgress(user, TODAY).answered).toBe(4);
        expect(weekView(user, TODAY).find((day) => day.isToday)?.status).toBe("done");
    });

    it("reads legacy mock exams with the 2.0 pass mark and empty answers", () => {
        const user = startApp(JSON.stringify(LEGACY_ACTIVE));
        const [failed, cancelled, passed] = user.testProgress;
        expect(passMarkOf(failed)).toBe(17);
        expect(failed.examType).toBeUndefined();
        expect(mockScore(passed)).toMatchObject({ total: 33, unanswered: 3 });
        expect(mockScore(passed).correct + mockScore(passed).wrong + mockScore(passed).unanswered).toBe(33);
        expect(cancelled.cancelled).toBe(true);
        const readiness = computeReadiness(user);
        expect(readiness.recentMocks).toBe(2);
        expect(readiness.recentPasses).toBe(1);
        expect(readiness.answered).toBeGreaterThanOrEqual(41);
    });

    it("counts legacy answers in every study mode without errors", () => {
        const user = startApp(JSON.stringify(LEGACY_ACTIVE));
        expect(() => exerciseEverything(user)).not.toThrow();
        const counts = modeCounts(user, TODAY);
        expect(counts.skipped).toBeGreaterThanOrEqual(1);
        expect(counts.flagged).toBeGreaterThanOrEqual(1);
        expect(counts.incorrect).toBeGreaterThanOrEqual(10);
        expect(counts.correct).toBeGreaterThanOrEqual(30);
        expect(counts.new + counts.correct + counts.incorrect).toBeLessThanOrEqual(getRelevantQuestions("BE").length + 10);
        expect(buildModeQuestions(user, "skipped", { today: TODAY }).map((question) => question.num)).toContain(BE_NUMS[40]);
    });

    it("writes new activity into the legacy day entry instead of a duplicate", () => {
        const user = startApp(JSON.stringify(LEGACY_FRESH));
        const question = getQuestion(BE_NUMS[0])!;
        const answered = recordAnswer(user, question, question.solution as "a", NOW).user;
        const skipped = recordSkip(answered, getQuestion(BE_NUMS[1])!, NOW);
        const flagged = toggleFlag(skipped, getQuestion(BE_NUMS[2])!, NOW).user;

        expect(flagged.dailyProgress).toHaveLength(1);
        expect(flagged.dailyProgress[0]).toMatchObject({ date: legacyDate(TODAY), attempted: 2, correct: 1, skipped: 1, flagged: 1, answered: 1 });
        expect(flagged.questionProgress).toHaveLength(3);
    });

    it("stores new mock exams in the shape 2.0 reads, with the new fields added", () => {
        const user = startApp(JSON.stringify(LEGACY_FRESH));
        const questions = [...BE_NUMS.slice(0, 30), ...BE_STATE_NUMS.slice(0, 3)].map((num) => getQuestion(num)!);
        const answers = Object.fromEntries(questions.map((question) => [question.num, question.solution as "a"]));
        const test = gradeMock(questions, answers, [], {
            passMark: 17,
            examType: "einbuergerung",
            timed: true,
            startedAt: new Date(NOW.getTime() - 600_000),
            finishedAt: NOW,
        });
        expect(test).toMatchObject({ timeTake: "600", passed: true, cancelled: false, passMark: 17, examType: "einbuergerung", timed: true });
        expect(test.questions[0]).toMatchObject({ num: BE_NUMS[0], skipped: false, flagged: false });

        const saved = applyMockToUser(user, test, NOW);
        expect(saved.testProgress).toHaveLength(1);
        expect(saved.dailyProgress[0]).toMatchObject({ date: legacyDate(TODAY), attempted: 33, correct: 33 });
        exerciseEverything(saved);
    });

    it("survives the round trip through storage as plain JSON", () => {
        startApp(JSON.stringify(LEGACY_ACTIVE));
        const stored = JSON.parse(window.localStorage.getItem("user")!);
        // Legacy fields keep their legacy shapes.
        expect(stored.dailyProgress[0].date).toBe(legacyDate(addDays(TODAY, -9)));
        expect(stored.appFirstTimeOpenDateTime).toBe(LEGACY_ACTIVE.appFirstTimeOpenDateTime);
        expect(stored.testProgress[0].timeTake).toBe("1543");
        // Reading it back yields the same normalized record.
        expect(normalizeUser(stored)).toEqual(readUser());
    });

    it("handles a record without the 2.0 review and language fields", () => {
        const user = startApp(JSON.stringify(LEGACY_MINIMAL));
        expect(user.appLanguage).toBe("de");
        expect(user.reviewNoCount).toBe(0);
        expect(user.userReviewed).toBe(false);
        expect(user.lastReviewPromptDateTime).toBeNull();
        expect(user.questionProgress).toEqual(LEGACY_MINIMAL.questionProgress);
        expect(() => exerciseEverything(user)).not.toThrow();
    });

    it("sends learners without a state back to onboarding instead of crashing", () => {
        const stateless = { ...LEGACY_FRESH, state: null };
        const user = startApp(JSON.stringify(stateless));
        expect(user.state).toEqual({ stateCode: "", stateName: "" });
        expect(user.onboardingCompleted).toBe(false);
        expect(() => exerciseEverything(user)).not.toThrow();
    });

    it("treats damaged storage as 'no record'", () => {
        for (const raw of ["", "null", "[]", "42", '"user"', "{not json"]) {
            window.localStorage.setItem("user", raw);
            expect(readUser(), raw).toBeNull();
        }
    });

    it("restores a backup file made with 2.0 and rejects anything else", () => {
        const restored = parseBackup(JSON.stringify(LEGACY_ACTIVE, null, 2), TODAY);
        expect(restored).not.toBeNull();
        expect(restored!.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
        expect(restored!.questionProgress).toEqual(LEGACY_ACTIVE.questionProgress);
        expect(restored!.testProgress).toEqual(LEGACY_ACTIVE.testProgress);
        expect(restored!.onboardingCompleted).toBe(true);
        expect(() => exerciseEverything(restored!)).not.toThrow();

        for (const content of ["", "{}", "[]", "null", "{bad", JSON.stringify({ state: {} }), JSON.stringify({ foo: "bar" })]) {
            expect(parseBackup(content, TODAY), content).toBeNull();
        }
    });

    it("tolerates damaged entries inside an otherwise valid record", () => {
        const damaged = {
            ...LEGACY_ACTIVE,
            questionProgress: [null, 7, { answeredCorrectly: true }, ...LEGACY_ACTIVE.questionProgress.slice(0, 3)],
            testProgress: [null, { datetime: "x" }, LEGACY_ACTIVE.testProgress[2]],
            dailyProgress: ["Fri", null, LEGACY_ACTIVE.dailyProgress[3]],
        };
        const user = startApp(JSON.stringify(damaged));
        expect(user.questionProgress).toHaveLength(3);
        expect(user.testProgress).toHaveLength(1);
        expect(user.dailyProgress).toHaveLength(1);
        expect(() => exerciseEverything(user)).not.toThrow();
        expect(dayKey(NOW)).toBe(TODAY);
    });

    it("loads a record captured from a real 2.0 Android install without losing anything", () => {
        // Written by the 2.0 debug build on a Galaxy S20 FE (Android 13) after a practice run and one mock exam.
        const raw = JSON.stringify(DEVICE_RECORD);
        const user = startApp(raw);
        expect(user.state).toEqual({ stateCode: "BE", stateName: "Berlin" });
        expect(user.questionProgress).toHaveLength(DEVICE_RECORD.questionProgress.length);
        expect(user.questionProgress.map((entry) => entry.num)).toEqual(DEVICE_RECORD.questionProgress.map((entry) => entry.num));
        expect(user.testProgress).toHaveLength(1);
        // 2.0 stored only 32 of the 33 exam questions; the score still counts what is there.
        const test = user.testProgress[0];
        expect(test.questions).toHaveLength(32);
        const score = mockScore(test);
        expect(score.total).toBe(32);
        expect(score.unanswered).toBe(8);
        expect(score.correct + score.wrong + score.unanswered).toBe(32);
        expect(passMarkOf(test)).toBe(17);
        expect(test.timeTake).toBe("41");
        expect(user.dailyProgress[0]).toMatchObject({ attempted: 60, correct: 12, incorrect: 36, flagged: 4 });
        expect(user.onboardingCompleted).toBe(true);
        expect(user.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
        expect(() => exerciseEverything(user)).not.toThrow();
        expect(computeReadiness(user).answered).toBeGreaterThan(0);
    });
});
