import { describe, expect, it } from "vitest";
import { getTranslations } from "@/data/data";
import type { EvaluationData } from "@/types/evaluation";
import type { InAppNotification, User, UserDailyProgress, UserQuestionProgress } from "@/types/user";
import { addDays, parseDayKey } from "@/utils/date-utils";
import {
    EXAM_COUNTDOWN_DAYS,
    markAllNotificationsRead,
    markNotificationRead,
    renderNotification,
    runEngagement,
    STREAK_MILESTONES,
    TIP_COUNT,
    unreadCount,
} from "@/utils/engagement";
import { getRelevantQuestions } from "@/utils/question-bank";
import { DEFAULT_PREFERENCES, DEFAULT_STREAK, MAX_INBOX_ITEMS } from "@/utils/user-defaults";

/* "Today" is Friday 2026-10-09. */
const TODAY = "2026-10-09";
const NOW = new Date(2026, 9, 9, 18, 30);
const EVALUATION: EvaluationData = { examDate: "15.07.2026", lastSyncAt: "2026-10-01", history: [] };
const BE_NUMS = getRelevantQuestions("BE").map((question) => question.num);

function entry(day: string, answered: number): UserDailyProgress {
    return { date: parseDayKey(day).toDateString(), correct: answered, incorrect: 0, attempted: answered, skipped: 0, flagged: 0, answered };
}

function answers(count: number): UserQuestionProgress[] {
    return BE_NUMS.slice(0, count).map((num) => ({ num, answeredCorrectly: true, skipped: false, answerSelected: "a", flagged: false }));
}

function user(extra: Partial<User> = {}): User {
    return {
        id: "",
        state: { stateName: "Berlin", stateCode: "BE" },
        dailyProgress: [],
        questionProgress: [],
        testProgress: [],
        appLanguage: "en",
        appFirstTimeOpenDateTime: new Date(2026, 8, 1),
        lastReviewPromptDateTime: null,
        reviewNoCount: 0,
        userReviewed: false,
        schemaVersion: 2,
        preferences: { ...DEFAULT_PREFERENCES },
        streak: { ...DEFAULT_STREAK },
        reviewSchedule: [],
        achievements: [],
        inbox: [],
        examDate: null,
        onboardingCompleted: true,
        lastSeenEvaluationDate: EVALUATION.examDate,
        ...extra,
    };
}

/** A learner who has used the app before: welcome note received, evaluation date seen. */
function returning(extra: Partial<User> = {}): User {
    const welcome: InAppNotification = {
        id: "welcome",
        type: "welcome",
        titleKey: "inbox_welcome_title",
        bodyKey: "inbox_welcome_body",
        createdAt: "2026-09-01T10:00:00.000Z",
        read: true,
    };
    return user({ inbox: [welcome], preferences: { ...DEFAULT_PREFERENCES, tips: false }, ...extra });
}

function run(input: User, now: Date = NOW) {
    return runEngagement(input, { now, evaluation: EVALUATION });
}

function ids(result: { added: InAppNotification[] }): string[] {
    return result.added.map((item) => item.id);
}

describe("runEngagement", () => {
    it("welcomes a new learner once and is idempotent afterwards", () => {
        const first = run(user());
        expect(ids(first)).toEqual(["welcome"]);
        expect(first.user.inbox?.[0]).toMatchObject({ id: "welcome", type: "welcome", read: false, createdAt: NOW.toISOString() });

        const second = run(first.user);
        expect(second.added).toEqual([]);
        expect(second.user).toBe(first.user);
    });

    it("returns the same object for a returning learner with nothing new", () => {
        const input = returning();
        const result = run(input);
        expect(result.added).toEqual([]);
        expect(result.user).toBe(input);
    });

    it("notes the daily goal once per day", () => {
        const input = returning({ dailyProgress: [entry(TODAY, DEFAULT_PREFERENCES.dailyGoal)] });
        const first = run(input);
        expect(ids(first)).toContain(`goal-${TODAY}`);
        const goal = first.added.find((item) => item.id === `goal-${TODAY}`);
        expect(goal).toMatchObject({ type: "goal", params: { goal: DEFAULT_PREFERENCES.dailyGoal }, route: "/progress" });
        expect(ids(run(first.user))).toEqual([]);
    });

    it("notes streak milestones on the day they are reached", () => {
        const days = Array.from({ length: 3 }, (_, index) => entry(addDays(TODAY, -index), 5));
        const result = run(returning({ dailyProgress: days }));
        expect(ids(result)).toContain(`streak-3-${TODAY}`);
        expect(result.added.find((item) => item.type === "streak")?.params).toEqual({ days: 3 });
        expect(STREAK_MILESTONES).toContain(3);
    });

    it("unlocks achievements and stores the name as a translation key", () => {
        const result = run(returning({ questionProgress: answers(1), dailyProgress: [entry(TODAY, 1)] }));
        expect(result.user.achievements?.map((item) => item.id)).toEqual(["first_answer"]);
        const note = result.added.find((item) => item.id === "achievement-first_answer");
        expect(note).toMatchObject({ type: "achievement", params: { nameKey: "ach_first_answer_title" }, route: "/progress#achievements" });
    });

    it("summarises many achievements at once in one note", () => {
        const days = Array.from({ length: 7 }, (_, index) => entry(addDays(TODAY, -index), 10));
        const result = run(returning({ questionProgress: answers(60), dailyProgress: days }));
        const unlocked = result.user.achievements?.length ?? 0;
        expect(unlocked).toBeGreaterThanOrEqual(3);
        const notes = result.added.filter((item) => item.type === "achievement");
        expect(notes).toHaveLength(1);
        expect(notes[0]).toMatchObject({ titleKey: "inbox_achievement_catchup_title", params: { count: unlocked } });
    });

    it("adds a note when a streak freeze is used", () => {
        const input = returning({
            dailyProgress: [entry(addDays(TODAY, -2), 5), entry(addDays(TODAY, -3), 5), entry(addDays(TODAY, -4), 5)],
            streak: { ...DEFAULT_STREAK, freezes: 1 },
        });
        const result = run(input);
        expect(result.user.streak?.freezes).toBe(0);
        expect(result.user.streak?.frozenDays).toEqual([addDays(TODAY, -1)]);
        expect(ids(result)).toContain(`freeze-used-${addDays(TODAY, -1)}`);
    });

    it("counts down to the exam with one note per stage", () => {
        const examDate = addDays(TODAY, 12);
        const first = run(returning({ examDate }));
        const exam = first.added.find((item) => item.type === "exam");
        expect(exam).toMatchObject({ id: `exam-14-${examDate}`, titleKey: "inbox_exam_14_title", params: { days: 12 }, route: "/mock" });

        const examDay = run(first.user, parseDayKey(examDate));
        expect(examDay.added.find((item) => item.type === "exam")).toMatchObject({ id: `exam-0-${examDate}`, route: "/dashboard" });
        expect(EXAM_COUNTDOWN_DAYS[EXAM_COUNTDOWN_DAYS.length - 1]).toBe(0);
    });

    it("stays quiet when the exam is far away or over", () => {
        expect(run(returning({ examDate: addDays(TODAY, 45) })).added).toEqual([]);
        expect(run(returning({ examDate: addDays(TODAY, -1) })).added).toEqual([]);
    });

    it("remembers the evaluation date silently first and notes later changes", () => {
        const fresh = run(returning({ lastSeenEvaluationDate: undefined }));
        expect(fresh.user.lastSeenEvaluationDate).toBe(EVALUATION.examDate);
        expect(fresh.added).toEqual([]);

        const changed = runEngagement(fresh.user, { now: NOW, evaluation: { ...EVALUATION, examDate: "01.08.2026" } });
        expect(changed.user.lastSeenEvaluationDate).toBe("01.08.2026");
        expect(changed.added.find((item) => item.type === "evaluation")).toMatchObject({
            id: "evaluation-01.08.2026",
            params: { date: "01.08.2026" },
            route: "/#bamf-evaluation",
        });
    });

    it("adds one tip per week when tips are on", () => {
        const input = returning({ preferences: { ...DEFAULT_PREFERENCES, tips: true } });
        const first = run(input);
        const tip = first.added.find((item) => item.type === "tip");
        expect(tip).toMatchObject({ id: "tip-2026-W41", bodyKey: "inbox_tip_0" });
        expect(run(first.user, new Date(2026, 9, 11)).added.filter((item) => item.type === "tip")).toEqual([]);
        const nextWeek = run(first.user, new Date(2026, 9, 12));
        expect(nextWeek.added.find((item) => item.type === "tip")?.bodyKey).toBe(`inbox_tip_${1 % TIP_COUNT}`);
    });

    it("nudges toward a mock exam after enough answers, at most every two weeks", () => {
        const input = returning({ questionProgress: answers(40) });
        const first = run(input);
        expect(first.added.find((item) => item.type === "mock")).toMatchObject({ id: `mock-${TODAY}`, route: "/mock" });
        const soon = run(first.user, new Date(2026, 9, 15));
        expect(soon.added.filter((item) => item.type === "mock")).toEqual([]);
        const later = run(first.user, new Date(2026, 10, 1));
        expect(later.added.filter((item) => item.type === "mock")).toHaveLength(1);
    });

    it("skips the mock nudge right after a mock exam", () => {
        const input = returning({
            questionProgress: answers(40),
            testProgress: [{ datetime: NOW.toISOString(), timeTake: "00:10:00", passed: true, cancelled: false, questions: [] }],
        });
        expect(run(input).added.filter((item) => item.type === "mock")).toEqual([]);
    });

    it("caps the inbox and keeps the newest first", () => {
        const old: InAppNotification[] = Array.from({ length: MAX_INBOX_ITEMS }, (_, index) => ({
            id: index === 0 ? "welcome" : `old-${index}`,
            type: "tip",
            titleKey: "inbox_tip_title",
            bodyKey: "inbox_tip_0",
            createdAt: "2026-09-01T10:00:00.000Z",
            read: true,
        }));
        const result = run(returning({ inbox: old, dailyProgress: [entry(TODAY, DEFAULT_PREFERENCES.dailyGoal)] }));
        expect(result.user.inbox).toHaveLength(MAX_INBOX_ITEMS);
        expect(result.user.inbox?.slice(0, result.added.length)).toEqual(result.added);
        expect(ids(result)).toContain(`goal-${TODAY}`);
        expect(result.user.inbox?.some((item) => item.id === `old-${MAX_INBOX_ITEMS - 1}`)).toBe(false);
    });

    it("tolerates records without an inbox", () => {
        const input = returning({ inbox: undefined });
        const result = run(input);
        expect(ids(result)).toEqual(["welcome"]);
    });
});

describe("renderNotification", () => {
    const en = getTranslations("en");
    const de = getTranslations("de");

    it("fills parameters and resolves achievement names in the current language", () => {
        const item: InAppNotification = {
            id: "achievement-first_answer",
            type: "achievement",
            titleKey: "inbox_achievement_title",
            bodyKey: "ach_first_answer_desc",
            params: { nameKey: "ach_first_answer_title" },
            createdAt: NOW.toISOString(),
            read: false,
        };
        expect(renderNotification(en, item).title).toBe(`Achievement unlocked: ${en.ach_first_answer_title}`);
        expect(renderNotification(de, item).title).toContain(de.ach_first_answer_title);
        expect(renderNotification(en, item).body).toBe(en.ach_first_answer_desc);
    });

    it("renders every text used by the engagement run", () => {
        const days = Array.from({ length: 7 }, (_, index) => entry(addDays(TODAY, -index), 10));
        const result = run(
            user({ questionProgress: answers(60), dailyProgress: days, examDate: addDays(TODAY, 3), lastSeenEvaluationDate: "01.01.2026" }),
        );
        expect(result.added.length).toBeGreaterThan(3);
        for (const item of result.added) {
            for (const t of [en, de]) {
                const { title, body } = renderNotification(t, item);
                expect(title, item.id).not.toBe(item.titleKey);
                expect(title).not.toMatch(/\{\w+\}/);
                expect(body).not.toMatch(/\{\w+\}/);
            }
        }
    });

    it("falls back to the key for unknown texts", () => {
        const item: InAppNotification = { id: "x", type: "tip", titleKey: "missing_key", bodyKey: "also_missing", createdAt: "", read: false };
        expect(renderNotification(en, item)).toEqual({ title: "missing_key", body: "" });
    });
});

describe("read state", () => {
    const inbox: InAppNotification[] = [
        { id: "a", type: "goal", titleKey: "inbox_goal_title", bodyKey: "inbox_goal_body", createdAt: "", read: false },
        { id: "b", type: "tip", titleKey: "inbox_tip_title", bodyKey: "inbox_tip_0", createdAt: "", read: true },
        { id: "c", type: "mock", titleKey: "inbox_mock_title", bodyKey: "inbox_mock_body", createdAt: "", read: false },
    ];

    it("counts unread notifications", () => {
        expect(unreadCount(user({ inbox }))).toBe(2);
        expect(unreadCount(user({ inbox: undefined }))).toBe(0);
        expect(unreadCount(null)).toBe(0);
        expect(unreadCount(undefined)).toBe(0);
    });

    it("marks one notification as read without touching the others", () => {
        const input = user({ inbox });
        const next = markNotificationRead(input, "a");
        expect(next.inbox?.map((item) => item.read)).toEqual([true, true, false]);
        expect(markNotificationRead(next, "a")).toBe(next);
        expect(markNotificationRead(next, "unknown")).toBe(next);
    });

    it("marks everything as read once", () => {
        const input = user({ inbox });
        const next = markAllNotificationsRead(input);
        expect(unreadCount(next)).toBe(0);
        expect(markAllNotificationsRead(next)).toBe(next);
    });
});
