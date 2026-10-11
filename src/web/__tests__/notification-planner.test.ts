import { describe, expect, it } from "vitest";
import { getTranslations } from "@/data/data";
import type {
    MockTestProgress,
    ReminderPreferences,
    User,
    UserDailyProgress,
    UserPreferences,
    UserQuestionProgress,
} from "@/types/user";
import { addDays, dayKey, daysBetween } from "@/utils/date-utils";
import type { Translations } from "@/utils/i18n";
import {
    DAILY_VARIANTS,
    LEGACY_NOTIFICATION_ID,
    NOTIFICATION_CHANNEL_IDS,
    NOTIFICATION_IDS,
    planNotifications,
    plannedNotificationIds,
    planTestNotification,
    type NotificationKind,
    type PlannedNotification,
} from "@/utils/notification-planner";
import { getQuestion } from "@/utils/question-bank";
import { computeReadiness } from "@/utils/readiness-logic";
import { DEFAULT_PREFERENCES, DEFAULT_REMINDERS } from "@/utils/user-defaults";

/* "Today" is Friday 2026-10-09. Unless a test says otherwise, it plans at 10:00 local time. */
const TWO_DAYS_AGO = "2026-10-07";
const YESTERDAY = "2026-10-08";
const TODAY = "2026-10-09";
const SAT = "2026-10-10";
const SUN = "2026-10-11";
const NEXT_SUN = "2026-10-18";
const NOW = local(TODAY, 6);

const COMEBACK_DAYS = [3, 5, 7, 14];
const EXAM_DAYS = [30, 14, 7, 3, 1, 0];

/** Every generic translation key the planner may use. */
const PLANNER_KEYS = [
    ...Array.from({ length: DAILY_VARIANTS }, (_, v) => [`notif_daily_title_${v}`, `notif_daily_body_${v}`]).flat(),
    ...COMEBACK_DAYS.flatMap((days) => [`notif_comeback_${days}_title`, `notif_comeback_${days}_body`]),
    "notif_streak_title",
    "notif_streak_body",
    "notif_weekly_title",
    "notif_weekly_body",
    ...EXAM_DAYS.flatMap((days) => [`notif_exam_${days}_title`, `notif_exam_${days}_body`]),
    "notif_mock_title",
    "notif_mock_body",
    "notif_test_title",
    "notif_test_body",
];

/** Every key of the rich content (question cards, facts, encouragement). */
const CONTENT_KEYS = [
    "notif_question_title",
    "notif_comeback_question_title",
    "notif_question_hint",
    "notif_question_summary",
    "notif_test_prefix",
    "notif_fact_known",
    "notif_fact_readiness",
    "notif_fact_due_one",
    "notif_fact_due_other",
    "notif_fact_mock",
    "notif_fact_exam_days_one",
    "notif_fact_exam_days_other",
    "notif_encourage_streak_title",
    "notif_encourage_streak_body",
    "notif_encourage_streak_body_named",
    "notif_encourage_goal_title_one",
    "notif_encourage_goal_title_other",
    "notif_encourage_goal_body",
    "notif_encourage_goal_body_named",
    "notif_encourage_due_body",
    "notif_encourage_due_body_named",
    "notif_encourage_status_start",
    "notif_encourage_status_building",
    "notif_encourage_status_close",
    "notif_encourage_status_ready",
    "notif_encourage_known_title",
    "notif_encourage_known_body",
    "notif_encourage_known_body_named",
    "notif_encourage_mock_passed",
    "notif_encourage_mock_failed",
    "notif_streak_risk_title",
    "notif_streak_risk_body_one",
    "notif_streak_risk_body_other",
    "notif_streak_best_summary",
    "notif_exam_summary",
];

/** Fake texts that show which key was used, e.g. "T(notif_mock_title)". Placeholders are left out on purpose. */
const T: Translations = Object.fromEntries([...PLANNER_KEYS, ...CONTENT_KEYS].map((key) => [key, `T(${key})`]));

type ReminderSwitch = "daily" | "comeback" | "streak" | "weekly" | "examCountdown" | "mockNudge";
const ALL_SWITCHES: ReminderSwitch[] = ["daily", "comeback", "streak", "weekly", "examCountdown", "mockNudge"];

/** Local wall-clock time on a "YYYY-MM-DD" day, built without the module under test. */
function local(day: string, hours: number, minutes = 0): Date {
    const [year, month, date] = day.split("-").map(Number);
    return new Date(year, month - 1, date, hours, minutes, 0, 0);
}

/** Reminder settings with only the given types switched on; times stay at their defaults. */
function onlyReminders(...on: ReminderSwitch[]): ReminderPreferences {
    return {
        ...DEFAULT_REMINDERS,
        daily: on.includes("daily"),
        comeback: on.includes("comeback"),
        streak: on.includes("streak"),
        weekly: on.includes("weekly"),
        examCountdown: on.includes("examCountdown"),
        mockNudge: on.includes("mockNudge"),
    };
}

function makeUser(overrides: Partial<User> = {}, preferences: Partial<UserPreferences> = {}): User {
    return {
        id: "test-user",
        state: { stateName: "Berlin", stateCode: "BE" },
        dailyProgress: [],
        questionProgress: [],
        testProgress: [],
        appLanguage: "en",
        appFirstTimeOpenDateTime: new Date(2026, 0, 1),
        lastReviewPromptDateTime: null,
        reviewNoCount: 0,
        userReviewed: false,
        onboardingCompleted: true,
        preferences: { ...DEFAULT_PREFERENCES, ...preferences },
        ...overrides,
    };
}

/** A stored day in the format older versions wrote, e.g. "Fri Oct 09 2026". */
function dayEntry(day: string, answered: number): UserDailyProgress {
    return {
        date: local(day, 0).toDateString(),
        correct: answered,
        incorrect: 0,
        attempted: answered,
        skipped: 0,
        flagged: 0,
        answered,
    };
}

/** Practice on the three days before `today`, so a streak is running and today is still open. */
function streakBefore(today: string): UserDailyProgress[] {
    return [3, 2, 1].map((back) => dayEntry(addDays(today, -back), 12));
}

/** General question numbers `first` ... `first + count - 1`. */
function general(count: number, first = 1): string[] {
    return Array.from({ length: count }, (_, i) => String(first + i));
}

/** Answered questions, alternating right and wrong. */
function answered(nums: string[]): UserQuestionProgress[] {
    return nums.map((num, i) => ({
        num,
        answeredCorrectly: i % 2 === 0,
        skipped: false,
        answerSelected: "a",
        flagged: false,
    }));
}

function mockExam(started: Date, overrides: Partial<MockTestProgress> = {}): MockTestProgress {
    return { datetime: started.toISOString(), timeTake: "900", passed: true, cancelled: false, questions: [], ...overrides };
}

/** A learner that triggers every kind: a running streak, 40 answers, no mock exam, and the exam in 20 days. */
function busyUser(preferences: Partial<UserPreferences> = {}, today = TODAY): User {
    return makeUser(
        {
            dailyProgress: streakBefore(today),
            questionProgress: answered(general(40)),
            examDate: addDays(today, 20),
        },
        preferences,
    );
}

function plan(user: User | null | undefined, now: Date = NOW, t: Translations = T): PlannedNotification[] {
    return planNotifications(user, t, now);
}

function idsOf(list: PlannedNotification[]): number[] {
    return list.map((item) => item.id);
}

function ofKind(list: PlannedNotification[], kind: NotificationKind): PlannedNotification[] {
    return list.filter((item) => item.kind === kind);
}

function deepFreeze<V>(value: V): V {
    if (value && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const key of Object.keys(value)) {
            deepFreeze((value as Record<string, unknown>)[key]);
        }
    }
    return value;
}

/** Checks a question card: German question text, four options, route to that question. */
function expectQuestionCard(item: PlannedNotification, mode = "new"): void {
    const num = item.questionNum as string;
    const question = getQuestion(num);
    expect(question, `question ${num}`).toBeDefined();
    expect(item.body).toBe(question?.question);
    expect(item.largeBody).toContain(`\nA ${question?.a}\nB ${question?.b}\nC ${question?.c}\nD ${question?.d}\n`);
    expect(item.route).toBe(`/prepare?action=${mode}&start=${encodeURIComponent(num)}`);
    expect(item.actionTypeId).toBe("question");
}

/** Every text of a planned notification. */
function textsOf(item: PlannedNotification): string[] {
    return [item.title, item.body, item.largeBody, item.summaryText, ...(item.inboxList ?? [])].filter(
        (value): value is string => typeof value === "string",
    );
}

describe("constants", () => {
    it("keeps the documented ids, variants, and channels", () => {
        expect(LEGACY_NOTIFICATION_ID).toBe(65241);
        expect(NOTIFICATION_IDS).toEqual({ daily: 2000, comeback: 2100, streak: 3000, weekly: 4000, exam: 5000, mock: 6000 });
        expect(DAILY_VARIANTS).toBe(6);
        expect(NOTIFICATION_CHANNEL_IDS).toEqual(["reminders", "streak", "exam", "progress"]);
    });
});

describe("plannedNotificationIds", () => {
    it("lists every id the planner may use", () => {
        expect(plannedNotificationIds()).toEqual([
            2000, 2001, 2002, 2100, 2101, 2102, 2103, 3000, 3001, 4000, 5000, 5001, 5002, 5003, 5004, 5005, 6000,
        ]);
    });

    it("has no duplicates and leaves the legacy reminder to the caller", () => {
        const ids = plannedNotificationIds();
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).not.toContain(LEGACY_NOTIFICATION_ID);
    });

    it("returns a new array on every call", () => {
        const first = plannedNotificationIds();
        first.push(1);
        expect(plannedNotificationIds()).not.toContain(1);
    });
});

describe("planNotifications: when nothing is planned", () => {
    it("plans nothing without a learner", () => {
        expect(plan(null)).toEqual([]);
        expect(plan(undefined)).toEqual([]);
    });

    it("plans nothing before onboarding is completed", () => {
        expect(plan({ ...busyUser(), onboardingCompleted: false })).toEqual([]);
    });

    it("treats a record without the onboarding flag as not onboarded", () => {
        const user = busyUser();
        delete user.onboardingCompleted;
        expect(plan(user)).toEqual([]);
    });

    it("plans nothing when the notification master switch is off", () => {
        expect(plan(busyUser({ notificationsEnabled: false }))).toEqual([]);
    });

    it("plans nothing when every reminder type is off", () => {
        expect(plan(busyUser({ reminders: onlyReminders() }))).toEqual([]);
    });

    it("plans nothing for an invalid clock", () => {
        expect(plan(busyUser(), new Date(Number.NaN))).toEqual([]);
    });
});

describe("planNotifications: reminder switches", () => {
    const KIND_OF: [ReminderSwitch, NotificationKind][] = [
        ["daily", "daily"],
        ["comeback", "comeback"],
        ["streak", "streak"],
        ["weekly", "weekly"],
        ["examCountdown", "exam"],
        ["mockNudge", "mock"],
    ];

    it("plans every kind when every switch is on", () => {
        const kinds = new Set(plan(busyUser()).map((item) => item.kind));
        expect([...kinds].sort()).toEqual(["comeback", "daily", "exam", "mock", "streak", "weekly"]);
    });

    it.each(KIND_OF)("plans only %s notifications when only that switch is on", (name, kind) => {
        const planned = plan(busyUser({ reminders: onlyReminders(name) }));
        expect(planned.length).toBeGreaterThan(0);
        expect(planned.every((item) => item.kind === kind)).toBe(true);
    });

    it.each(KIND_OF)("plans no %s notifications when only that switch is off", (name, kind) => {
        const planned = plan(busyUser({ reminders: onlyReminders(...ALL_SWITCHES.filter((other) => other !== name)) }));
        expect(ofKind(planned, kind)).toEqual([]);
        expect(new Set(planned.map((item) => item.kind)).size).toBe(5);
    });
});

describe("planNotifications: daily reminders", () => {
    const dailyOnly = onlyReminders("daily");

    it("plans today and the next two days at the daily time, in local time", () => {
        const user = makeUser({}, { reminders: { ...dailyOnly, dailyTime: "07:45" } });
        const planned = plan(user, local(TODAY, 6));
        expect(idsOf(planned)).toEqual([2000, 2001, 2002]);
        expect(planned.map((item) => item.at)).toEqual([local(TODAY, 7, 45), local(SAT, 7, 45), local(SUN, 7, 45)]);
        for (const item of planned) {
            expect(item.at.getHours()).toBe(7);
            expect(item.at.getMinutes()).toBe(45);
            expect(item.kind).toBe("daily");
            expect(item.channelId).toBe("reminders");
        }
        // Friday (day 282) and Sunday (day 284) ask a question, Saturday (day 283) encourages.
        expect(planned.map((item) => item.actionTypeId)).toEqual(["question", "practice", "question"]);
        expectQuestionCard(planned[0]);
        expect(planned[1].route).toBe("/practice");
        expectQuestionCard(planned[2]);
    });

    it("asks a question on even days of the year and rotates the six generic texts on odd days", () => {
        // 2026-10-09 is day 282 of the year: a question card; day 283 falls back to text 283 % 6 = 1.
        const planned = plan(makeUser({}, { reminders: dailyOnly }));
        expect(planned.map((item) => item.title)).toEqual([
            "T(notif_question_title)",
            "T(notif_daily_title_1)",
            "T(notif_question_title)",
        ]);
        expect(planned[1].body).toBe("T(notif_daily_body_1)");
        expect(planned[0].questionNum).not.toBe(planned[2].questionNum);
    });

    it("counts the day of the year from January 1st, leap years included", () => {
        const user = makeUser({}, { reminders: dailyOnly });
        const titleOn = (day: string) => plan(user, local(day, 6))[0].title;
        expect(titleOn("2026-01-01")).toBe("T(notif_daily_title_1)");
        expect(titleOn("2026-01-05")).toBe("T(notif_daily_title_5)");
        expect(titleOn("2026-01-06")).toBe("T(notif_question_title)");
        expect(titleOn("2026-01-07")).toBe("T(notif_daily_title_1)");
        // Day 365 of 2026, and days 365 and 366 of the leap year 2028.
        expect(titleOn("2026-12-31")).toBe("T(notif_daily_title_5)");
        expect(titleOn("2028-12-30")).toBe("T(notif_daily_title_5)");
        expect(titleOn("2028-12-31")).toBe("T(notif_question_title)");
    });

    it("encourages instead when no question is left to ask", () => {
        // Every question of the Berlin catalogue is answered correctly, except one that has an image.
        const nums = Array.from({ length: 300 }, (_, i) => String(i + 1)).concat(
            Array.from({ length: 10 }, (_, i) => `BE-${i + 1}`),
        );
        const user = makeUser(
            { questionProgress: nums.map((num) => ({ num, answeredCorrectly: true, skipped: false, answerSelected: "a", flagged: false })) },
            { reminders: dailyOnly },
        );
        const planned = plan(user);
        // Known questions still make a "quick" question card from the whole catalogue.
        expect(planned.map((item) => item.actionTypeId)).toEqual(["question", "practice", "question"]);
        expectQuestionCard(planned[0], "quick");
        // With real texts, the odd day encourages with the learner's numbers.
        const de = plan(user, NOW, getTranslations("de"));
        expect(de[1].title).toMatch(/^(310 von 310 Fragen sitzen schon|\d+ % Prüfungsreife)$/);
    });

    it("plans today's reminder only while its time is still ahead", () => {
        const user = makeUser({}, { reminders: dailyOnly });
        expect(idsOf(plan(user, local(TODAY, 6, 59)))).toEqual([2000, 2001, 2002]);
        expect(idsOf(plan(user, local(TODAY, 7)))).toEqual([2001, 2002]);
        expect(idsOf(plan(user, local(TODAY, 23, 59)))).toEqual([2001, 2002]);
    });

    it("leaves out today's reminder once the daily goal is met", () => {
        const user = makeUser({ dailyProgress: [dayEntry(TODAY, 10)] }, { dailyGoal: 10, reminders: dailyOnly });
        expect(idsOf(plan(user))).toEqual([2001, 2002]);
    });

    it("keeps today's reminder while the goal is not met yet", () => {
        const user = makeUser({ dailyProgress: [dayEntry(TODAY, 9)] }, { dailyGoal: 10, reminders: dailyOnly });
        expect(idsOf(plan(user))).toEqual([2000, 2001, 2002]);
    });

    it("counts correct plus incorrect answers on records without an answered count", () => {
        const legacy: UserDailyProgress = {
            date: local(TODAY, 0).toDateString(),
            correct: 6,
            incorrect: 4,
            attempted: 11,
            skipped: 1,
            flagged: 0,
        };
        const user = makeUser({ dailyProgress: [legacy] }, { dailyGoal: 10, reminders: dailyOnly });
        expect(idsOf(plan(user))).toEqual([2001, 2002]);
    });

    it("ignores goals met on other days", () => {
        const user = makeUser({ dailyProgress: [dayEntry(YESTERDAY, 50)] }, { dailyGoal: 10, reminders: dailyOnly });
        expect(idsOf(plan(user))).toEqual([2000, 2001, 2002]);
    });

    it("skips rest days and keeps the ids of the other days", () => {
        expect(idsOf(plan(makeUser({}, { restDays: [6], reminders: dailyOnly })))).toEqual([2000, 2002]);
        expect(idsOf(plan(makeUser({}, { restDays: [5], reminders: dailyOnly })))).toEqual([2001, 2002]);
        expect(idsOf(plan(makeUser({}, { restDays: [5, 6, 0], reminders: dailyOnly })))).toEqual([]);
    });
});

describe("planNotifications: come-back reminders", () => {
    it("plans reminders 3, 5, 7, and 14 days ahead at the daily time", () => {
        const user = makeUser({}, { reminders: { ...onlyReminders("comeback"), dailyTime: "08:15" } });
        const planned = plan(user);
        expect(idsOf(planned)).toEqual([2100, 2101, 2102, 2103]);
        expect(planned.map((item) => item.at)).toEqual([
            local("2026-10-12", 8, 15),
            local("2026-10-14", 8, 15),
            local("2026-10-16", 8, 15),
            local("2026-10-23", 8, 15),
        ]);
        for (const item of planned) {
            expect(item.kind).toBe("comeback");
            expect(item.channelId).toBe("reminders");
        }
        // Days 3 and 7 ask a question the learner has seen; days 5 and 14 use the come-back texts.
        expect(planned.map((item) => item.title)).toEqual([
            "T(notif_comeback_question_title)",
            "T(notif_comeback_5_title)",
            "T(notif_comeback_question_title)",
            "T(notif_comeback_14_title)",
        ]);
        expect(planned[1].body).toBe("T(notif_comeback_5_body)");
        expect(planned[3].body).toBe("T(notif_comeback_14_body)");
        expect(planned[1].route).toBe("/practice");
        expect(planned[3].route).toBe("/practice");
        expectQuestionCard(planned[0]);
        expectQuestionCard(planned[2]);
    });

    it("moves with the day the plan is made", () => {
        const user = makeUser({}, { reminders: onlyReminders("comeback") });
        const planned = plan(user, local("2026-10-20", 23));
        expect(planned.map((item) => dayKey(item.at))).toEqual(["2026-10-23", "2026-10-25", "2026-10-27", "2026-11-03"]);
    });

    it("asks a different question in every card of the plan", () => {
        const user = makeUser({}, { reminders: { ...onlyReminders("daily"), comeback: true } });
        const nums = plan(user)
            .map((item) => item.questionNum)
            .filter((num): num is string => typeof num === "string");
        // Today, Sunday, and the come-back days 3 and 7.
        expect(nums).toHaveLength(4);
        expect(new Set(nums).size).toBe(4);
    });
});

describe("planNotifications: streak reminders", () => {
    const streakOnly = onlyReminders("streak");
    const running = streakBefore(TODAY);

    it("plans nothing without a running streak", () => {
        expect(plan(makeUser({}, { reminders: streakOnly }))).toEqual([]);
        // The last practice was two days ago, so yesterday broke the streak.
        expect(plan(makeUser({ dailyProgress: [dayEntry(TWO_DAYS_AGO, 5)] }, { reminders: streakOnly }))).toEqual([]);
    });

    it("warns this evening and tomorrow evening while today is still open", () => {
        const planned = plan(makeUser({ dailyProgress: running }, { reminders: streakOnly }));
        expect(idsOf(planned)).toEqual([3000, 3001]);
        expect(planned.map((item) => item.at)).toEqual([local(TODAY, 20, 30), local(SAT, 20, 30)]);
        for (const item of planned) {
            expect(item.kind).toBe("streak");
            expect(item.channelId).toBe("streak");
            expect(item.route).toBe("/practice");
            expect(item.actionTypeId).toBe("practice");
        }
        // Tonight's warning names the streak; tomorrow's stays generic.
        expect(planned[0].title).toBe("T(notif_streak_risk_title)");
        expect(planned[0].body).toBe("T(notif_streak_risk_body_one)");
        expect(planned[1].title).toBe("T(notif_streak_title)");
        expect(planned[1].body).toBe("T(notif_streak_body)");
        expect(planned[1].summaryText).toBeUndefined();
    });

    it("puts the learner's numbers into tonight's warning", () => {
        const user = makeUser(
            {
                dailyProgress: [dayEntry(TWO_DAYS_AGO, 10), dayEntry(YESTERDAY, 10), dayEntry(TODAY, 3)],
                streak: { best: 9, freezes: 0, frozenDays: [], freezeEarnedDays: [] },
            },
            { streakRule: "goal", dailyGoal: 10, reminders: streakOnly },
        );
        const [tonight] = plan(user, NOW, getTranslations("de"));
        expect(tonight.id).toBe(3000);
        // Two days met the goal; today's 3 answers do not count yet.
        expect(tonight.title).toBe("2-Tage-Serie in Gefahr");
        expect(tonight.body).toBe("Noch 7 Fragen, dann zählt der Tag.");
        expect(tonight.summaryText).toBe("Beste Serie: 9 Tage");
    });

    it("only warns tomorrow once today counts", () => {
        const user = makeUser({ dailyProgress: [...running, dayEntry(TODAY, 1)] }, { reminders: streakOnly });
        expect(idsOf(plan(user))).toEqual([3001]);
    });

    it("counts a streak that starts today", () => {
        const user = makeUser({ dailyProgress: [dayEntry(TODAY, 1)] }, { reminders: streakOnly });
        expect(idsOf(plan(user))).toEqual([3001]);
    });

    it("uses the streak time", () => {
        const user = makeUser({ dailyProgress: running }, { reminders: { ...streakOnly, streakTime: "21:05" } });
        expect(plan(user).map((item) => item.at)).toEqual([local(TODAY, 21, 5), local(SAT, 21, 5)]);
    });

    it("leaves out this evening's warning once its time has passed", () => {
        const user = makeUser({ dailyProgress: running }, { reminders: streakOnly });
        expect(idsOf(plan(user, local(TODAY, 20, 30)))).toEqual([3001]);
    });

    it("skips rest days", () => {
        // Friday (today) is a rest day: no warning tonight.
        expect(idsOf(plan(makeUser({ dailyProgress: running }, { restDays: [5], reminders: streakOnly })))).toEqual([3001]);
        // Saturday (tomorrow) is a rest day: no warning tomorrow.
        expect(idsOf(plan(makeUser({ dailyProgress: running }, { restDays: [6], reminders: streakOnly })))).toEqual([3000]);
    });

    it("keeps a streak that a frozen day bridged", () => {
        const user = makeUser(
            {
                dailyProgress: [dayEntry("2026-10-06", 5), dayEntry(TWO_DAYS_AGO, 5)],
                streak: { best: 2, freezes: 0, frozenDays: [YESTERDAY], freezeEarnedDays: [] },
            },
            { reminders: streakOnly },
        );
        expect(idsOf(plan(user))).toEqual([3000, 3001]);
    });

    it("follows the goal rule: answers below the goal do not count yet", () => {
        const user = makeUser(
            { dailyProgress: [dayEntry(YESTERDAY, 10), dayEntry(TODAY, 3)] },
            { streakRule: "goal", dailyGoal: 10, reminders: streakOnly },
        );
        expect(idsOf(plan(user))).toEqual([3000, 3001]);
    });
});

describe("planNotifications: weekly summary", () => {
    const weeklyOnly = makeUser({}, { reminders: onlyReminders("weekly") });

    it.each<[string, Date, Date]>([
        ["on Friday morning", local(TODAY, 10), local(SUN, 18)],
        ["just before midnight on Saturday", local(SAT, 23, 59), local(SUN, 18)],
        ["on Sunday before 18:00", local(SUN, 17, 59), local(SUN, 18)],
        ["on Sunday at 18:00 exactly", local(SUN, 18), local(NEXT_SUN, 18)],
        ["on Sunday evening", local(SUN, 21), local(NEXT_SUN, 18)],
        ["on Monday", local("2026-10-12", 9), local(NEXT_SUN, 18)],
        ["on the last Thursday of the year", local("2026-12-31", 12), local("2027-01-03", 18)],
    ])("plans the next Sunday 18:00 %s", (_, now, expected) => {
        // A fresh learner has no numbers yet, so the summary has no expanded list.
        expect(plan(weeklyOnly, now)).toEqual([
            {
                id: 4000,
                channelId: "progress",
                kind: "weekly",
                title: "T(notif_weekly_title)",
                body: "T(notif_weekly_body)",
                at: expected,
                route: "/progress",
                actionTypeId: "progress",
            },
        ]);
    });

    it("is not moved by a rest day on Sunday", () => {
        const user = makeUser({}, { restDays: [0], reminders: onlyReminders("weekly") });
        expect(plan(user).map((item) => item.at)).toEqual([local(SUN, 18)]);
    });

    it("lists the learner's numbers for that Sunday", () => {
        const user = busyUser({ reminders: onlyReminders("weekly") });
        const [weekly] = plan(user, NOW, getTranslations("de"));
        const readiness = computeReadiness(user);
        expect(weekly.inboxList).toEqual([
            `${readiness.known} von ${readiness.total} Fragen sitzen`,
            `${readiness.score} % Prüfungsreife`,
            // The exam is 20 days from today, 18 from Sunday.
            "Noch 18 Tage bis zur Prüfung",
        ]);
    });
});

describe("planNotifications: exam countdown", () => {
    const examOnly = onlyReminders("examCountdown");

    it("plans 30, 14, 7, 3, and 1 days before and on exam day, at 09:00", () => {
        const planned = plan(makeUser({ examDate: "2026-11-18" }, { reminders: examOnly }));
        expect(idsOf(planned)).toEqual([5000, 5001, 5002, 5003, 5004, 5005]);
        expect(planned.map((item) => item.at)).toEqual([
            local("2026-10-19", 9),
            local("2026-11-04", 9),
            local("2026-11-11", 9),
            local("2026-11-15", 9),
            local("2026-11-17", 9),
            local("2026-11-18", 9),
        ]);
        expect(planned.map((item) => item.route)).toEqual(["/mock", "/mock", "/mock", "/mock", "/mock", "/dashboard"]);
        expect(planned.map((item) => item.title)).toEqual(EXAM_DAYS.map((days) => `T(notif_exam_${days}_title)`));
        expect(planned.map((item) => item.body)).toEqual(EXAM_DAYS.map((days) => `T(notif_exam_${days}_body)`));
        for (const item of planned) {
            expect(item.kind).toBe("exam");
            expect(item.channelId).toBe("exam");
            expect(item.summaryText).toBe("T(notif_exam_summary)");
        }
        // The mock-exam button is offered before the exam, not on exam day.
        expect(planned.map((item) => item.actionTypeId)).toEqual(["mock", "mock", "mock", "mock", "mock", undefined]);
    });

    it("names the exam date and the learner's numbers in the expanded text", () => {
        const user = busyUser({ reminders: examOnly });
        const planned = plan(user, NOW, getTranslations("de"));
        const readiness = computeReadiness(user);
        expect(planned.map((item) => item.summaryText)).toEqual(Array(planned.length).fill("Prüfung am 29.10.2026"));
        expect(planned[0].largeBody).toBe(`${planned[0].body}\n\n${readiness.score} % Prüfungsreife`);
        // A fresh learner has no numbers, so no expanded text.
        expect(plan(makeUser({ examDate: "2026-11-18" }, { reminders: examOnly }))[0].largeBody).toBeUndefined();
    });

    it("leaves out reminders that are already past", () => {
        // Exam on Wednesday 2026-10-14: the 30-, 14-, and 7-day reminders lie in the past.
        const planned = plan(makeUser({ examDate: "2026-10-14" }, { reminders: examOnly }));
        expect(idsOf(planned)).toEqual([5003, 5004, 5005]);
    });

    it("keeps the exam-day reminder until 09:00 on exam day", () => {
        const user = makeUser({ examDate: TODAY }, { reminders: examOnly });
        const early = plan(user, local(TODAY, 8, 59));
        expect(idsOf(early)).toEqual([5005]);
        expect(early[0].route).toBe("/dashboard");
        expect(early[0].title).toBe("T(notif_exam_0_title)");
        expect(plan(user, local(TODAY, 9))).toEqual([]);
    });

    it("plans nothing without a usable exam date in the future", () => {
        for (const examDate of [null, undefined, "", "2026-13-40", "18.11.2026", YESTERDAY]) {
            expect(plan(makeUser({ examDate }, { reminders: examOnly }))).toEqual([]);
        }
    });

    it("plans nothing when the countdown is off", () => {
        const user = makeUser({ examDate: "2026-11-18" }, { reminders: onlyReminders("daily", "weekly") });
        expect(ofKind(plan(user), "exam")).toEqual([]);
    });
});

describe("planNotifications: mock exam nudge", () => {
    const mockOnly = onlyReminders("mockNudge");
    const forty = answered(general(40));

    it("nudges tomorrow at 17:00 once 30 questions are answered and no mock exam was taken", () => {
        expect(plan(makeUser({ questionProgress: answered(general(30)) }, { reminders: mockOnly }))).toEqual([
            {
                id: 6000,
                channelId: "exam",
                kind: "mock",
                title: "T(notif_mock_title)",
                body: "T(notif_mock_body)",
                largeBody: "T(notif_mock_body)\n\nT(notif_fact_known)\nT(notif_fact_readiness)",
                at: local(SAT, 17),
                route: "/mock",
                actionTypeId: "mock",
            },
        ]);
    });

    it("waits until 30 questions are answered", () => {
        expect(plan(makeUser({ questionProgress: answered(general(29)) }, { reminders: mockOnly }))).toEqual([]);
    });

    it("counts only answered questions of the learner's catalogue", () => {
        const progress: UserQuestionProgress[] = [
            ...answered(general(25)),
            ...answered(Array.from({ length: 10 }, (_, i) => `BY-${i + 1}`)),
            { num: "200", answeredCorrectly: null, skipped: true, answerSelected: null, flagged: false },
            { num: "201", answeredCorrectly: null, skipped: false, answerSelected: null, flagged: true },
        ];
        // A Berlin learner: Bavarian questions and unanswered entries do not count (25 answered).
        expect(plan(makeUser({ questionProgress: progress }, { reminders: mockOnly }))).toEqual([]);
        // A Bavarian learner: 25 general plus 10 state answers.
        const bavarian = makeUser(
            { questionProgress: progress, state: { stateName: "Bayern", stateCode: "BY" } },
            { reminders: mockOnly },
        );
        expect(idsOf(plan(bavarian))).toEqual([6000]);
    });

    it.each<[string, Date]>([
        ["earlier today", local(TODAY, 8)],
        ["yesterday", local(YESTERDAY, 20)],
        ["two days ago", local(TWO_DAYS_AGO, 0, 1)],
    ])("waits after a mock exam %s", (_, started) => {
        const user = makeUser({ questionProgress: forty, testProgress: [mockExam(started)] }, { reminders: mockOnly });
        expect(plan(user)).toEqual([]);
    });

    it("nudges again when the last mock exam was three days ago", () => {
        const started = local("2026-10-06", 23, 59);
        const user = makeUser({ questionProgress: forty, testProgress: [mockExam(started)] }, { reminders: mockOnly });
        expect(idsOf(plan(user))).toEqual([6000]);
    });

    it("counts failed mock exams but ignores cancelled ones and unreadable dates", () => {
        const withTests = (testProgress: MockTestProgress[]) =>
            makeUser({ questionProgress: forty, testProgress }, { reminders: mockOnly });
        const yesterday = local(YESTERDAY, 9);
        expect(plan(withTests([mockExam(yesterday, { passed: false })]))).toEqual([]);
        expect(idsOf(plan(withTests([mockExam(yesterday, { passed: false, cancelled: true })])))).toEqual([6000]);
        expect(idsOf(plan(withTests([mockExam(yesterday, { datetime: "not a date" })])))).toEqual([6000]);
    });

    it("looks at every mock exam, not only the last one", () => {
        const user = makeUser(
            {
                questionProgress: forty,
                testProgress: [mockExam(local(YESTERDAY, 9)), mockExam(local(TODAY, 8), { cancelled: true })],
            },
            { reminders: mockOnly },
        );
        expect(plan(user)).toEqual([]);
    });

    it("plans nothing when the nudge is off", () => {
        const user = makeUser({ questionProgress: forty }, { reminders: onlyReminders("daily") });
        expect(ofKind(plan(user), "mock")).toEqual([]);
    });
});

describe("planNotifications: texts", () => {
    it("falls back to the key when a translation is missing or empty", () => {
        const user = makeUser({}, { reminders: onlyReminders("daily", "weekly") });
        const planned = plan(user, NOW, { notif_weekly_title: "" });
        // Question cards keep the German question as body; the title frame falls back to its key.
        expect(planned.map((item) => [item.id, item.title])).toEqual([
            [2000, "notif_question_title"],
            [2001, "notif_daily_title_1"],
            [2002, "notif_question_title"],
            [4000, "notif_weekly_title"],
        ]);
        expect(planned[1].body).toBe("notif_daily_body_1");
        expect(planned[3].body).toBe("notif_weekly_body");
        expect(planned[0].summaryText).toBe("notif_question_summary");
    });

    it("uses only keys that exist in English and German", () => {
        const en = getTranslations("en");
        const de = getTranslations("de");
        for (const key of [...PLANNER_KEYS, ...CONTENT_KEYS]) {
            expect(en[key], `en: ${key}`).toBeTruthy();
            expect(de[key], `de: ${key}`).toBeTruthy();
        }
    });

    it("fills in every placeholder with the real translations", () => {
        const learners = [
            makeUser(),
            busyUser(),
            makeUser({
                nickname: "Ayşe",
                dailyProgress: [dayEntry(YESTERDAY, 10), dayEntry(TODAY, 3)],
                questionProgress: answered(general(60)),
                testProgress: [mockExam(local(TWO_DAYS_AGO, 9), { passed: false, questions: answered(general(33)) })],
                examDate: "2026-11-18",
                reviewSchedule: [{ num: "1", box: 1, due: TODAY, lastReviewed: YESTERDAY }],
            }, { streakRule: "goal", dailyGoal: 10 }),
        ];
        for (const language of ["de", "en"] as const) {
            const t = getTranslations(language);
            for (const user of learners) {
                for (let offset = 0; offset < 8; offset++) {
                    for (const item of plan(user, local(addDays(TODAY, offset), 6), t)) {
                        for (const text of textsOf(item)) {
                            expect(text, `${language} ${item.id} ${text}`).not.toMatch(/[{}]|notif_/);
                            expect(text.trim()).not.toBe("");
                        }
                    }
                }
            }
        }
    });
});

describe("planNotifications: the whole plan", () => {
    it("is sorted by time, then by id", () => {
        // Daily 07:00 before the streak check 20:30; the mock nudge 17:00 sits between tomorrow's two.
        expect(idsOf(plan(busyUser()))).toEqual([
            2000, 3000, 2001, 6000, 3001, 2002, 4000, 2100, 2101, 5001, 2102, 5002, 2103, 5003, 5004, 5005,
        ]);
    });

    it("keeps every time strictly after now", () => {
        const now = local(TODAY, 19, 30);
        const planned = plan(busyUser(), now);
        expect(planned.length).toBeGreaterThan(0);
        expect(planned.every((item) => item.at.getTime() > now.getTime())).toBe(true);
        expect(idsOf(planned)).not.toContain(2000);
    });

    it("uses only ids from plannedNotificationIds, each at most once", () => {
        const allowed = new Set(plannedNotificationIds());
        for (let offset = 0; offset < 14; offset++) {
            const ids = idsOf(plan(busyUser(), local(addDays(TODAY, offset), 7)));
            expect(new Set(ids).size).toBe(ids.length);
            expect(ids.every((id) => allowed.has(id))).toBe(true);
        }
    });

    it("sends each kind to its channel", () => {
        const planned = plan(busyUser());
        expect(Object.fromEntries(planned.map((item) => [item.kind, item.channelId]))).toEqual({
            daily: "reminders",
            comeback: "reminders",
            streak: "streak",
            weekly: "progress",
            exam: "exam",
            mock: "exam",
        });
        expect(planned.every((item) => NOTIFICATION_CHANNEL_IDS.includes(item.channelId))).toBe(true);
    });

    it("keeps wall-clock times and days across daylight-saving changes", () => {
        // Europe changes on 2026-03-29 and 2026-10-25, the US on 2026-03-08 and 2026-11-01.
        const time: Record<NotificationKind, string> = {
            daily: "07:00",
            comeback: "07:00",
            streak: "20:30",
            weekly: "18:00",
            exam: "09:00",
            mock: "17:00",
        };
        const days = [
            ...Array.from({ length: 32 }, (_, i) => addDays("2026-02-28", i)),
            ...Array.from({ length: 18 }, (_, i) => addDays("2026-10-18", i)),
        ];
        for (const today of days) {
            const user = busyUser({}, today);
            const examDate = user.examDate as string;
            const expectedDay = (item: PlannedNotification): string => {
                const index = item.id - NOTIFICATION_IDS[item.kind];
                switch (item.kind) {
                    case "daily":
                    case "streak":
                        return addDays(today, index);
                    case "comeback":
                        return addDays(today, COMEBACK_DAYS[index]);
                    case "exam":
                        return addDays(examDate, -EXAM_DAYS[index]);
                    case "mock":
                        return addDays(today, 1);
                    case "weekly":
                        return addDays(today, (7 - local(today, 12).getDay()) % 7);
                }
            };
            for (const item of plan(user, local(today, 7))) {
                const label = `${today} ${item.kind} ${item.id}`;
                const hhmm = `${String(item.at.getHours()).padStart(2, "0")}:${String(item.at.getMinutes()).padStart(2, "0")}`;
                expect(hhmm, label).toBe(time[item.kind]);
                expect(dayKey(item.at), label).toBe(expectedDay(item));
                expect(daysBetween(today, dayKey(item.at)), label).toBeGreaterThanOrEqual(0);
            }
        }
    });
});

describe("planNotifications: learner records", () => {
    it("falls back to the defaults when the 2.1 fields are missing", () => {
        const record: User = {
            id: "older-user",
            state: { stateName: "Berlin", stateCode: "BE" },
            dailyProgress: [{ date: "Thu Oct 08 2026", correct: 3, incorrect: 1, attempted: 5, skipped: 1, flagged: 0 }],
            questionProgress: [],
            testProgress: [],
            appLanguage: "de",
            appFirstTimeOpenDateTime: new Date(2026, 0, 1),
            lastReviewPromptDateTime: null,
            reviewNoCount: 0,
            userReviewed: false,
            onboardingCompleted: true,
        };
        // Default reminders: daily at 07:00, the streak warning at 20:30 (practice yesterday),
        // the weekly summary, and come-back reminders. No exam date and too few answers for a mock nudge.
        const planned = plan(record);
        expect(idsOf(planned)).toEqual([2000, 3000, 2001, 3001, 2002, 4000, 2100, 2101, 2102, 2103]);
        expect(planned[0].at).toEqual(local(TODAY, 7));
    });

    it("does not change the learner record", () => {
        const user = deepFreeze(busyUser({ reminders: { ...DEFAULT_REMINDERS }, restDays: [] }));
        const before = JSON.stringify(user);
        expect(() => plan(user)).not.toThrow();
        expect(JSON.stringify(user)).toBe(before);
    });

    it("returns the same plan for the same input", () => {
        expect(plan(busyUser())).toEqual(plan(busyUser()));
    });
});

describe("planTestNotification", () => {
    it("sends today's question card with a test prefix", () => {
        const de = getTranslations("de");
        const card = planTestNotification(busyUser(), de, NOW);
        expect(card.title).toMatch(/^Frage des Tages: /);
        expect(card.summaryText).toMatch(/^Test · Nr\. \S+ · /);
        expect(card.actionTypeId).toBe("question");
        expect(card.route).toMatch(/^\/prepare\?action=(review|incorrect|new|quick)&start=/);
        expect(card.questionNum).toBeDefined();
        expect(card.body).toBe(getQuestion(card.questionNum as string)?.question);
        expect(card.largeBody).toContain("Tippen und antworten");
        // The same question as the daily card for today.
        const [today] = plan(busyUser({ reminders: onlyReminders("daily") }), NOW, de);
        expect(card.questionNum).toBe(today.questionNum);
    });

    it("falls back to the plain test texts without a learner or clock", () => {
        for (const [user, now] of [
            [null, NOW],
            [undefined, NOW],
            [busyUser(), new Date(Number.NaN)],
        ] as const) {
            expect(planTestNotification(user, T, now)).toEqual({
                title: "T(notif_test_title)",
                body: "T(notif_test_body)",
                route: "/settings",
            });
        }
    });

    it("works for a learner whose state is unknown", () => {
        // Nothing is gated here; an unknown state code still has the general catalogue.
        const card = planTestNotification(makeUser({ state: { stateName: "", stateCode: "" } }), T, NOW);
        expect(card.actionTypeId).toBe("question");
    });
});
