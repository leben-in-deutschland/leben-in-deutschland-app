import { describe, expect, it } from "vitest";
import type { StreakState, User, UserDailyProgress, UserPreferences } from "@/types/user";
import { addDays, daysBetween, parseDayKey } from "@/utils/date-utils";
import { DEFAULT_PREFERENCES, DEFAULT_STREAK, MAX_STREAK_FREEZES } from "@/utils/user-defaults";
import {
    activityByDay,
    activityCalendar,
    answeredCount,
    computeStreak,
    dayQualifies,
    FREEZE_EARN_INTERVAL,
    getDayActivity,
    goalProgress,
    isRestDay,
    refreshStreak,
    weekView,
} from "@/utils/streak-logic";

/* The tests run in the week of Monday 2026-10-05; "today" is a Friday. */
const MON = "2026-10-05";
const TUE = "2026-10-06";
const WED = "2026-10-07";
const THU = "2026-10-08";
const TODAY = "2026-10-09";
const SAT = "2026-10-10";
const SUN = "2026-10-11";
const LAST_SUN = "2026-10-04";

/** The format older app versions stored: `Date.toDateString()`, e.g. "Fri Oct 09 2026". */
function legacyDate(day: string): string {
    return parseDayKey(day).toDateString();
}

/** A stored daily entry with `answered` answers given that day. */
function entry(day: string, answered: number, extra: Partial<UserDailyProgress> = {}): UserDailyProgress {
    return {
        date: legacyDate(day),
        correct: answered,
        incorrect: 0,
        attempted: answered,
        skipped: 0,
        flagged: 0,
        answered,
        ...extra,
    };
}

/** An entry without any practice, like the one written when a state is picked. */
function emptyEntry(day: string): UserDailyProgress {
    return { date: legacyDate(day), correct: 0, incorrect: 0, attempted: 0, skipped: 0, flagged: 0 };
}

/** One entry per day for the `count` days that end on `last`. */
function daysEnding(last: string, count: number, answered = 5): UserDailyProgress[] {
    return Array.from({ length: count }, (_, i) => entry(addDays(last, i - count + 1), answered));
}

function makeUser(dailyProgress: UserDailyProgress[] = [], overrides: Partial<User> = {}): User {
    return {
        id: "test-user",
        state: { stateName: "Berlin", stateCode: "BE" },
        dailyProgress,
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

function prefs(overrides: Partial<UserPreferences> = {}): UserPreferences {
    return { ...DEFAULT_PREFERENCES, ...overrides };
}

function streakState(overrides: Partial<StreakState> = {}): StreakState {
    return { best: 0, freezes: 0, frozenDays: [], freezeEarnedDays: [], ...overrides };
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

describe("answeredCount", () => {
    it("uses the stored answered count", () => {
        expect(answeredCount(entry(TODAY, 7, { correct: 3, incorrect: 1 }))).toBe(7);
    });

    it("falls back to correct + incorrect for older records", () => {
        expect(answeredCount(emptyEntry(TODAY))).toBe(0);
        expect(answeredCount({ ...emptyEntry(TODAY), correct: 4, incorrect: 2, attempted: 9, skipped: 3 })).toBe(6);
    });

    it("keeps an explicit zero instead of falling back", () => {
        expect(answeredCount(entry(TODAY, 0, { correct: 2, incorrect: 1 }))).toBe(0);
    });
});

describe("activityByDay", () => {
    it("reads legacy toDateString dates as local day keys", () => {
        expect(legacyDate(TODAY)).toBe("Fri Oct 09 2026");
        const map = activityByDay(makeUser([entry(MON, 3), entry(TODAY, 4)]));
        expect(Array.from(map.keys())).toEqual([MON, TODAY]);
        expect(map.get(TODAY)).toEqual({ day: TODAY, answered: 4, attempted: 4, correct: 4, incorrect: 0 });
    });

    it("reads ISO timestamps as the local day", () => {
        const map = activityByDay(
            makeUser([
                entry(MON, 1, { date: parseDayKey(TUE).toISOString() }),
                entry(MON, 2, { date: new Date(2026, 9, 7, 23, 59).toISOString() }),
                entry(MON, 3, { date: new Date(2026, 9, 8, 0, 1).toISOString() }),
            ]),
        );
        expect(Array.from(map.keys())).toEqual([TUE, WED, THU]);
    });

    it("adds up several entries of the same day", () => {
        const map = activityByDay(
            makeUser([
                entry(TODAY, 6, { correct: 4, incorrect: 2, attempted: 8 }),
                entry(TODAY, 5, { date: new Date(2026, 9, 9, 15).toISOString(), correct: 5, attempted: 6 }),
                { ...emptyEntry(TODAY), correct: 1, incorrect: 2, attempted: 3 },
            ]),
        );
        expect(map.size).toBe(1);
        expect(map.get(TODAY)).toEqual({ day: TODAY, answered: 14, attempted: 17, correct: 10, incorrect: 4 });
    });

    it("lists days oldest first", () => {
        const map = activityByDay(makeUser([entry(TODAY, 1), entry(MON, 1), entry(WED, 1), entry(TUE, 1)]));
        expect(Array.from(map.keys())).toEqual([MON, TUE, WED, TODAY]);
    });

    it("skips entries with unreadable dates", () => {
        const map = activityByDay(
            makeUser([entry(TODAY, 2), entry(TODAY, 3, { date: "not a date" }), entry(TODAY, 4, { date: "" })]),
        );
        expect(Array.from(map.keys())).toEqual([TODAY]);
        expect(map.get(TODAY)?.answered).toBe(2);
    });

    it("returns an empty map without entries", () => {
        expect(activityByDay(makeUser()).size).toBe(0);
        const withoutArray = { ...makeUser(), dailyProgress: undefined } as unknown as User;
        expect(activityByDay(withoutArray).size).toBe(0);
    });

    it("does not change the stored entries", () => {
        const user = deepFreeze(makeUser([entry(TODAY, 2), entry(TODAY, 3)]));
        expect(activityByDay(user).get(TODAY)?.answered).toBe(5);
        expect(user.dailyProgress.map((item) => item.answered)).toEqual([2, 3]);
    });
});

describe("getDayActivity", () => {
    it("returns zeros for a day without entries", () => {
        expect(getDayActivity(makeUser([entry(MON, 3)]), TODAY)).toEqual({
            day: TODAY,
            answered: 0,
            attempted: 0,
            correct: 0,
            incorrect: 0,
        });
    });

    it("returns the merged activity of the day", () => {
        const user = makeUser([entry(TODAY, 2), entry(MON, 9), entry(TODAY, 3, { incorrect: 1, correct: 2 })]);
        expect(getDayActivity(user, TODAY)).toEqual({ day: TODAY, answered: 5, attempted: 5, correct: 4, incorrect: 1 });
    });
});

describe("goalProgress", () => {
    it("uses the default goal of 10 for records without preferences", () => {
        expect(goalProgress(makeUser([entry(TODAY, 4)]), TODAY)).toEqual({
            goal: 10,
            answered: 4,
            remaining: 6,
            ratio: 0.4,
            met: false,
        });
    });

    it("is met exactly at the goal", () => {
        expect(goalProgress(makeUser([entry(TODAY, 10)]), TODAY)).toEqual({
            goal: 10,
            answered: 10,
            remaining: 0,
            ratio: 1,
            met: true,
        });
    });

    it("caps the ratio at 1 above the goal", () => {
        const user = makeUser([entry(TODAY, 8)], { preferences: prefs({ dailyGoal: 5 }) });
        expect(goalProgress(user, TODAY)).toEqual({ goal: 5, answered: 8, remaining: 0, ratio: 1, met: true });
    });

    it("counts only today's answers", () => {
        const progress = goalProgress(makeUser([entry(THU, 20)]), TODAY);
        expect(progress.answered).toBe(0);
        expect(progress.ratio).toBe(0);
        expect(progress.met).toBe(false);
    });

    it("adds up several entries of today", () => {
        const user = makeUser([entry(TODAY, 3), entry(TODAY, 4, { date: new Date(2026, 9, 9, 20).toISOString() })]);
        expect(goalProgress(user, TODAY).answered).toBe(7);
    });

    it("falls back to the default goal for an unusable stored goal", () => {
        const user = makeUser([], { preferences: prefs({ dailyGoal: 0 }) });
        expect(goalProgress(user, TODAY)).toMatchObject({ goal: 10, met: false, ratio: 0 });
    });
});

describe("isRestDay", () => {
    it("matches the weekday of the day (0 = Sunday)", () => {
        expect(isRestDay(SUN, prefs({ restDays: [0] }))).toBe(true);
        expect(isRestDay(SAT, prefs({ restDays: [0] }))).toBe(false);
        expect(isRestDay(SAT, prefs({ restDays: [6] }))).toBe(true);
        expect(isRestDay(WED, prefs({ restDays: [1, 3] }))).toBe(true);
    });

    it("is never true without rest days", () => {
        for (const day of [MON, TUE, WED, THU, TODAY, SAT, SUN]) {
            expect(isRestDay(day, DEFAULT_PREFERENCES)).toBe(false);
        }
    });
});

describe("dayQualifies", () => {
    const activity = (answered: number, attempted: number) => ({ day: TODAY, answered, attempted, correct: 0, incorrect: 0 });

    it("is false without activity", () => {
        expect(dayQualifies(undefined, prefs())).toBe(false);
        expect(dayQualifies(undefined, prefs({ streakRule: "goal" }))).toBe(false);
    });

    it("activity rule: any attempt or answer counts", () => {
        expect(dayQualifies(activity(0, 3), prefs())).toBe(true);
        expect(dayQualifies(activity(2, 0), prefs())).toBe(true);
        expect(dayQualifies(activity(0, 0), prefs())).toBe(false);
    });

    it("goal rule: the daily goal must be reached", () => {
        const goalRule = prefs({ streakRule: "goal", dailyGoal: 20 });
        expect(dayQualifies(activity(20, 20), goalRule)).toBe(true);
        expect(dayQualifies(activity(25, 25), goalRule)).toBe(true);
        expect(dayQualifies(activity(19, 40), goalRule)).toBe(false);
        expect(dayQualifies(activity(0, 50), goalRule)).toBe(false);
    });

    it("goal rule never qualifies an empty day, even with an unusable goal", () => {
        expect(dayQualifies(activity(0, 0), prefs({ streakRule: "goal", dailyGoal: 0 }))).toBe(false);
    });
});

describe("computeStreak", () => {
    it("returns an empty streak without any activity", () => {
        expect(computeStreak(makeUser(), TODAY)).toEqual({
            current: 0,
            best: 0,
            todayDone: false,
            atRisk: false,
            startDay: null,
            lastActiveDay: null,
            freezes: 0,
        });
    });

    it("counts consecutive days ending today in a legacy record", () => {
        expect(computeStreak(makeUser(daysEnding(TODAY, 5)), TODAY)).toEqual({
            current: 5,
            best: 5,
            todayDone: true,
            atRisk: false,
            startDay: MON,
            lastActiveDay: TODAY,
            freezes: 0,
        });
    });

    it("keeps the streak pending while today has no practice yet", () => {
        expect(computeStreak(makeUser(daysEnding(THU, 3)), TODAY)).toMatchObject({
            current: 3,
            todayDone: false,
            atRisk: true,
            startDay: TUE,
            lastActiveDay: THU,
        });
    });

    it("counts a streak that starts today", () => {
        expect(computeStreak(makeUser([entry(TODAY, 1)]), TODAY)).toMatchObject({
            current: 1,
            startDay: TODAY,
            todayDone: true,
        });
    });

    it("breaks at the first missed day", () => {
        const streak = computeStreak(makeUser([entry(TUE, 3), entry(WED, 3), entry(TODAY, 3)]), TODAY);
        expect(streak.current).toBe(1);
        expect(streak.startDay).toBe(TODAY);
    });

    it("is zero when the last practice was two days ago", () => {
        expect(computeStreak(makeUser([entry(TUE, 3), entry(WED, 3)]), TODAY)).toMatchObject({
            current: 0,
            atRisk: false,
            startDay: null,
            lastActiveDay: WED,
        });
    });

    it("treats a day with an entry but no practice as missed", () => {
        const user = makeUser([entry(WED, 3), emptyEntry(THU), entry(TODAY, 3)]);
        expect(computeStreak(user, TODAY).current).toBe(1);
    });

    it("counts skips and flags as practice under the activity rule", () => {
        const user = makeUser([entry(TODAY, 0, { attempted: 2, skipped: 2 })]);
        expect(computeStreak(user, TODAY)).toMatchObject({ current: 1, todayDone: true });
    });

    it("treats rest days without practice as neutral", () => {
        const user = makeUser([entry(MON, 2), entry(TUE, 2), entry(THU, 2), entry(TODAY, 2)], {
            preferences: prefs({ restDays: [3] }),
        });
        expect(computeStreak(user, TODAY)).toMatchObject({ current: 4, startDay: MON });
    });

    it("counts practice on a rest day", () => {
        const user = makeUser(daysEnding(TODAY, 5), { preferences: prefs({ restDays: [3] }) });
        expect(computeStreak(user, TODAY).current).toBe(5);
    });

    it("treats frozen days as neutral", () => {
        const user = makeUser([entry(MON, 2), entry(TUE, 2), entry(THU, 2), entry(TODAY, 2)], {
            streak: streakState({ frozenDays: [WED], freezes: 1, best: 4 }),
        });
        expect(computeStreak(user, TODAY)).toMatchObject({ current: 4, startDay: MON, freezes: 1 });
    });

    it("is not at risk on a rest day", () => {
        const user = makeUser([entry(WED, 2), entry(THU, 2)], { preferences: prefs({ restDays: [5] }) });
        expect(computeStreak(user, TODAY)).toMatchObject({ current: 2, todayDone: false, atRisk: false });
    });

    it("goal rule: only days that reach the goal count", () => {
        const user = makeUser([entry(TUE, 15), entry(WED, 9), entry(THU, 10), entry(TODAY, 12)], {
            preferences: prefs({ streakRule: "goal", dailyGoal: 10 }),
        });
        expect(computeStreak(user, TODAY)).toMatchObject({ current: 2, startDay: THU, lastActiveDay: TODAY });
    });

    it("goal rule: today below the goal is pending", () => {
        const user = makeUser([entry(WED, 10), entry(THU, 10), entry(TODAY, 4)], {
            preferences: prefs({ streakRule: "goal", dailyGoal: 10 }),
        });
        expect(computeStreak(user, TODAY)).toMatchObject({
            current: 2,
            todayDone: false,
            atRisk: true,
            lastActiveDay: THU,
        });
    });

    it("goal rule: several entries of one day add up", () => {
        const user = makeUser([entry(TODAY, 6), entry(TODAY, 5, { date: new Date(2026, 9, 9, 21).toISOString() })], {
            preferences: prefs({ streakRule: "goal", dailyGoal: 10 }),
        });
        expect(computeStreak(user, TODAY)).toMatchObject({ current: 1, todayDone: true });
    });

    it("keeps a higher stored best streak", () => {
        const user = makeUser(daysEnding(TODAY, 3), { streak: streakState({ best: 12 }) });
        expect(computeStreak(user, TODAY)).toMatchObject({ current: 3, best: 12 });
    });

    it("reports the current streak as best when it is higher", () => {
        const user = makeUser(daysEnding(TODAY, 5), { streak: streakState({ best: 2 }) });
        expect(computeStreak(user, TODAY).best).toBe(5);
    });

    it("ignores entries after today", () => {
        const user = makeUser([entry(WED, 3), entry(SAT, 3)]);
        expect(computeStreak(user, TODAY)).toMatchObject({ current: 0, lastActiveDay: WED });
    });

    it("counts correctly across daylight-saving changes", () => {
        expect(computeStreak(makeUser(daysEnding("2026-10-30", 11)), "2026-10-30")).toMatchObject({
            current: 11,
            startDay: "2026-10-20",
        });
        expect(computeStreak(makeUser(daysEnding("2026-04-02", 10)), "2026-04-02")).toMatchObject({
            current: 10,
            startDay: "2026-03-24",
        });
    });

    it("stops walking back after 4000 days", () => {
        const everyDayRest = prefs({ restDays: [0, 1, 2, 3, 4, 5, 6] });
        const near = makeUser([entry(addDays(TODAY, -3999), 1)], { preferences: everyDayRest });
        const far = makeUser([entry(addDays(TODAY, -4100), 1)], { preferences: everyDayRest });
        expect(computeStreak(near, TODAY).current).toBe(1);
        expect(computeStreak(far, TODAY).current).toBe(0);
    });
});

describe("weekView", () => {
    it("lists Monday to Sunday of the current week", () => {
        const week = weekView(makeUser(), TODAY);
        expect(week.map((day) => day.day)).toEqual([MON, TUE, WED, THU, TODAY, SAT, SUN]);
        expect(week.map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
        expect(week.map((day) => day.isToday)).toEqual([false, false, false, false, true, false, false]);
    });

    it("marks done, frozen, rest, missed, today, and future days", () => {
        const user = makeUser([entry(LAST_SUN, 4), entry(MON, 5)], {
            preferences: prefs({ restDays: [3] }),
            streak: streakState({ frozenDays: [TUE] }),
        });
        const week = weekView(user, TODAY);
        expect(week.map((day) => day.status)).toEqual(["done", "frozen", "rest", "missed", "today", "future", "future"]);
        expect(week.map((day) => day.answered)).toEqual([5, 0, 0, 0, 0, 0, 0]);
    });

    it("marks today as done once it qualifies", () => {
        const week = weekView(makeUser([entry(TODAY, 1)]), TODAY);
        expect(week[4]).toEqual({ day: TODAY, weekday: 5, status: "done", answered: 1, isToday: true });
    });

    it("shows partial days under the goal rule", () => {
        const user = makeUser(
            [entry(MON, 4), entry(TUE, 10), entry(WED, 0, { attempted: 3, skipped: 3 }), entry(TODAY, 6)],
            { preferences: prefs({ streakRule: "goal", dailyGoal: 10 }) },
        );
        expect(weekView(user, TODAY).map((day) => day.status)).toEqual([
            "partial",
            "done",
            "missed",
            "missed",
            "today",
            "future",
            "future",
        ]);
    });

    it("never shows partial days under the activity rule", () => {
        const user = makeUser([entry(MON, 1), entry(TUE, 2)], { preferences: prefs({ dailyGoal: 50 }) });
        expect(weekView(user, TODAY).map((day) => day.status).slice(0, 2)).toEqual(["done", "done"]);
    });

    it("uses none for days before the first practice", () => {
        const user = makeUser([emptyEntry(MON), entry(WED, 2)]);
        expect(weekView(user, TODAY).map((day) => day.status)).toEqual([
            "none",
            "none",
            "done",
            "missed",
            "today",
            "future",
            "future",
        ]);
    });

    it("uses none for a learner who never practiced", () => {
        expect(weekView(makeUser(), TODAY).map((day) => day.status)).toEqual([
            "none",
            "none",
            "none",
            "none",
            "today",
            "future",
            "future",
        ]);
    });

    it("handles weeks where today is Monday or Sunday", () => {
        const user = makeUser([entry(LAST_SUN, 1)]);
        expect(weekView(user, MON).map((day) => day.status)).toEqual([
            "today",
            "future",
            "future",
            "future",
            "future",
            "future",
            "future",
        ]);
        const sunday = weekView(makeUser([entry(MON, 1), entry(SUN, 1)]), SUN);
        expect(sunday[0].day).toBe(MON);
        expect(sunday.map((day) => day.status)).toEqual(["done", "missed", "missed", "missed", "missed", "missed", "done"]);
    });

    it("stays seven distinct days in a week with a daylight-saving change", () => {
        const week = weekView(makeUser(), "2026-10-25");
        expect(week.map((day) => day.day)).toEqual([
            "2026-10-19",
            "2026-10-20",
            "2026-10-21",
            "2026-10-22",
            "2026-10-23",
            "2026-10-24",
            "2026-10-25",
        ]);
    });
});

describe("activityCalendar", () => {
    it("returns 84 days ending today, oldest first", () => {
        const calendar = activityCalendar(makeUser(), TODAY);
        expect(calendar).toHaveLength(84);
        expect(calendar[0].day).toBe(addDays(TODAY, -83));
        expect(calendar[83].day).toBe(TODAY);
        for (let i = 1; i < calendar.length; i++) {
            expect(daysBetween(calendar[i - 1].day, calendar[i].day)).toBe(1);
        }
    });

    it("supports other lengths", () => {
        expect(activityCalendar(makeUser(), TODAY, 7).map((day) => day.day)).toEqual([
            "2026-10-03",
            LAST_SUN,
            MON,
            TUE,
            WED,
            THU,
            TODAY,
        ]);
        expect(activityCalendar(makeUser(), TODAY, 1).map((day) => day.day)).toEqual([TODAY]);
        expect(activityCalendar(makeUser(), TODAY, 0)).toEqual([]);
        expect(activityCalendar(makeUser(), TODAY, -5)).toEqual([]);
    });

    it("has no gaps or repeats across daylight-saving changes", () => {
        const calendar = activityCalendar(makeUser(), "2026-11-01", 400);
        expect(calendar).toHaveLength(400);
        expect(new Set(calendar.map((day) => day.day)).size).toBe(400);
        for (let i = 1; i < calendar.length; i++) {
            expect(daysBetween(calendar[i - 1].day, calendar[i].day)).toBe(1);
        }
    });

    it("uses the same statuses as weekView", () => {
        const user = makeUser([entry(LAST_SUN, 4), entry(MON, 5), entry(MON, 2)], {
            preferences: prefs({ restDays: [3] }),
            streak: streakState({ frozenDays: [TUE] }),
        });
        const calendar = activityCalendar(user, TODAY, 7);
        expect(calendar.map((day) => day.status)).toEqual(["none", "done", "done", "frozen", "rest", "missed", "today"]);
        expect(calendar.map((day) => day.answered)).toEqual([0, 4, 7, 0, 0, 0, 0]);
        const week = weekView(user, TODAY);
        expect(calendar.slice(2)).toEqual(week.slice(0, 5).map(({ day, answered, status }) => ({ day, answered, status })));
    });
});

describe("refreshStreak", () => {
    it("returns the same user when nothing changes", () => {
        const empty = makeUser();
        expect(refreshStreak(empty, TODAY)).toEqual({ user: empty, events: [] });
        expect(refreshStreak(empty, TODAY).user).toBe(empty);

        const steady = makeUser(daysEnding(TODAY, 3), { streak: streakState({ best: 3 }) });
        const result = refreshStreak(steady, TODAY);
        expect(result.user).toBe(steady);
        expect(result.events).toEqual([]);
    });

    it("uses a freeze for one missed day", () => {
        const user = deepFreeze(makeUser(daysEnding(WED, 3), { streak: streakState({ best: 3, freezes: 1 }) }));
        const result = refreshStreak(user, TODAY);
        expect(result.events).toEqual([{ type: "freeze-used", day: THU }]);
        expect(result.user.streak).toEqual(streakState({ best: 3, freezes: 0, frozenDays: [THU] }));
        expect(computeStreak(result.user, TODAY)).toMatchObject({ current: 3, atRisk: true, startDay: MON });
        expect(user.streak?.freezes).toBe(1);
        expect(user.streak?.frozenDays).toEqual([]);
    });

    it("uses two freezes for two missed days, oldest first", () => {
        const user = makeUser(daysEnding(TUE, 3), {
            streak: streakState({ best: 3, freezes: 2, frozenDays: ["2026-09-20"] }),
        });
        const result = refreshStreak(user, TODAY);
        expect(result.events).toEqual([
            { type: "freeze-used", day: WED },
            { type: "freeze-used", day: THU },
        ]);
        expect(result.user.streak).toMatchObject({ freezes: 0, frozenDays: ["2026-09-20", WED, THU] });
        expect(computeStreak(result.user, TODAY).current).toBe(3);
    });

    it("uses freezes after practice today and raises the best streak", () => {
        const user = makeUser([...daysEnding(WED, 3), entry(TODAY, 2)], {
            streak: streakState({ best: 3, freezes: 1 }),
        });
        const result = refreshStreak(user, TODAY);
        expect(result.events).toEqual([{ type: "freeze-used", day: THU }]);
        expect(result.user.streak).toEqual(streakState({ best: 4, freezes: 0, frozenDays: [THU] }));
    });

    it("does nothing when more days were missed than freezes are saved", () => {
        const user = makeUser(daysEnding(TUE, 3), { streak: streakState({ best: 3, freezes: 1 }) });
        const result = refreshStreak(user, TODAY);
        expect(result.user).toBe(user);
        expect(result.events).toEqual([]);
        expect(computeStreak(user, TODAY).current).toBe(0);
    });

    it("does nothing when three days were missed, even with two freezes", () => {
        const user = makeUser(daysEnding(MON, 3), { streak: streakState({ best: 3, freezes: 2 }) });
        expect(refreshStreak(user, TODAY).user).toBe(user);
    });

    it(`never covers more than ${MAX_STREAK_FREEZES} missed days, even with more freezes stored`, () => {
        const user = makeUser(daysEnding(MON, 3), { streak: streakState({ best: 3, freezes: 5 }) });
        const result = refreshStreak(user, TODAY);
        expect(result.user).toBe(user);
        expect(result.events).toEqual([]);
    });

    it("skips rest days inside the gap", () => {
        const user = makeUser([entry(LAST_SUN, 2), entry(MON, 2), entry(TUE, 2)], {
            preferences: prefs({ restDays: [3] }),
            streak: streakState({ best: 3, freezes: 1 }),
        });
        const result = refreshStreak(user, TODAY);
        expect(result.events).toEqual([{ type: "freeze-used", day: THU }]);
        expect(result.user.streak).toMatchObject({ freezes: 0, frozenDays: [THU] });
        expect(computeStreak(result.user, TODAY).current).toBe(3);
    });

    it("needs no freeze when only rest days were missed", () => {
        const user = makeUser([entry(MON, 2), entry(TUE, 2)], {
            preferences: prefs({ restDays: [3, 4] }),
            streak: streakState({ best: 2, freezes: 2 }),
        });
        expect(refreshStreak(user, TODAY).user).toBe(user);
        expect(computeStreak(user, TODAY)).toMatchObject({ current: 2, atRisk: true });
    });

    it("does not spend freezes when no streak existed before the gap", () => {
        const user = makeUser([emptyEntry("2026-10-01")], {
            streak: streakState({ freezes: 2, frozenDays: [TUE] }),
        });
        const result = refreshStreak(user, TODAY);
        expect(result.user).toBe(user);
        expect(result.events).toEqual([]);
    });

    it("does not spend freezes without earlier practice", () => {
        const user = makeUser([entry(TODAY, 3)], { streak: streakState({ best: 1, freezes: 2 }) });
        expect(refreshStreak(user, TODAY).user).toBe(user);
    });

    it("covers a day below the goal under the goal rule", () => {
        const user = makeUser([entry(MON, 10), entry(TUE, 10), entry(WED, 10), entry(THU, 4)], {
            preferences: prefs({ streakRule: "goal", dailyGoal: 10 }),
            streak: streakState({ best: 3, freezes: 1 }),
        });
        const result = refreshStreak(user, TODAY);
        expect(result.events).toEqual([{ type: "freeze-used", day: THU }]);
        expect(computeStreak(result.user, TODAY).current).toBe(3);
    });

    it("chains freezes over several days and then lets the streak end", () => {
        const start = makeUser([entry(MON, 2), entry(TUE, 2)], { streak: streakState({ best: 2, freezes: 2 }) });
        const onThursday = refreshStreak(start, THU);
        expect(onThursday.events).toEqual([{ type: "freeze-used", day: WED }]);
        const onFriday = refreshStreak(onThursday.user, TODAY);
        expect(onFriday.events).toEqual([{ type: "freeze-used", day: THU }]);
        expect(onFriday.user.streak).toMatchObject({ freezes: 0, frozenDays: [WED, THU] });
        expect(computeStreak(onFriday.user, TODAY)).toMatchObject({ current: 2, atRisk: true });
        const onSaturday = refreshStreak(onFriday.user, SAT);
        expect(onSaturday.user).toBe(onFriday.user);
        expect(computeStreak(onFriday.user, SAT).current).toBe(0);
    });

    it(`earns a freeze on day ${FREEZE_EARN_INTERVAL} of a streak`, () => {
        const user = deepFreeze(makeUser(daysEnding(TODAY, 7)));
        const result = refreshStreak(user, TODAY);
        expect(result.events).toEqual([{ type: "freeze-earned", day: TODAY, streak: 7 }]);
        expect(result.user.streak).toEqual(streakState({ best: 7, freezes: 1, freezeEarnedDays: [TODAY] }));
        expect(user.streak).toBeUndefined();
    });

    it("is idempotent", () => {
        const first = refreshStreak(makeUser(daysEnding(TODAY, 7)), TODAY);
        const second = refreshStreak(first.user, TODAY);
        expect(second.user).toBe(first.user);
        expect(second.events).toEqual([]);

        const frozen = refreshStreak(makeUser(daysEnding(WED, 3), { streak: streakState({ best: 3, freezes: 2 }) }), TODAY);
        const again = refreshStreak(frozen.user, TODAY);
        expect(again.user).toBe(frozen.user);
        expect(again.events).toEqual([]);
    });

    it("earns another freeze on day 14", () => {
        const user = makeUser(daysEnding(TODAY, 14), {
            streak: streakState({ best: 13, freezes: 1, freezeEarnedDays: ["2026-10-02"] }),
        });
        const result = refreshStreak(user, TODAY);
        expect(result.events).toEqual([{ type: "freeze-earned", day: TODAY, streak: 14 }]);
        expect(result.user.streak).toEqual(
            streakState({ best: 14, freezes: 2, freezeEarnedDays: ["2026-10-02", TODAY] }),
        );
    });

    it(`keeps at most ${MAX_STREAK_FREEZES} freezes`, () => {
        const full = makeUser(daysEnding(TODAY, 14), { streak: streakState({ best: 14, freezes: 2 }) });
        expect(refreshStreak(full, TODAY)).toEqual({ user: full, events: [] });
        expect(refreshStreak(full, TODAY).user).toBe(full);

        const fullAndBetter = makeUser(daysEnding(TODAY, 14), { streak: streakState({ best: 10, freezes: 2 }) });
        const result = refreshStreak(fullAndBetter, TODAY);
        expect(result.events).toEqual([]);
        expect(result.user.streak).toEqual(streakState({ best: 14, freezes: 2 }));
    });

    it("earns nothing on other streak days", () => {
        for (const days of [1, 6, 8, 13, 15]) {
            const user = makeUser(daysEnding(TODAY, days), { streak: streakState({ best: days }) });
            expect(refreshStreak(user, TODAY).user).toBe(user);
        }
    });

    it("earns nothing while today is still pending", () => {
        const user = makeUser(daysEnding(THU, 7), { streak: streakState({ best: 7 }) });
        expect(computeStreak(user, TODAY).current).toBe(7);
        expect(refreshStreak(user, TODAY).user).toBe(user);
    });

    it("earns nothing twice on the same day", () => {
        const user = makeUser(daysEnding(TODAY, 7), {
            streak: streakState({ best: 7, freezes: 0, freezeEarnedDays: [TODAY] }),
        });
        expect(refreshStreak(user, TODAY).user).toBe(user);
    });

    it("remembers the last 30 freeze-earned days", () => {
        const earned = Array.from({ length: 30 }, (_, i) => addDays("2025-01-01", i * 7));
        const user = makeUser(daysEnding(TODAY, 7), { streak: streakState({ best: 30, freezeEarnedDays: earned }) });
        const days = refreshStreak(user, TODAY).user.streak?.freezeEarnedDays ?? [];
        expect(days).toHaveLength(30);
        expect(days[0]).toBe(earned[1]);
        expect(days[29]).toBe(TODAY);
        expect(user.streak?.freezeEarnedDays).toHaveLength(30);
    });

    it("uses a freeze and earns one in the same refresh", () => {
        const user = deepFreeze(
            makeUser([...daysEnding(WED, 6), entry(TODAY, 3)], { streak: streakState({ best: 6, freezes: 1 }) }),
        );
        const result = refreshStreak(user, TODAY);
        expect(result.events).toEqual([
            { type: "freeze-used", day: THU },
            { type: "freeze-earned", day: TODAY, streak: 7 },
        ]);
        expect(result.user.streak).toEqual(
            streakState({ best: 7, freezes: 1, frozenDays: [THU], freezeEarnedDays: [TODAY] }),
        );
    });

    it("raises the best streak of a legacy record without touching the defaults", () => {
        const user = makeUser(daysEnding(TODAY, 3));
        const result = refreshStreak(user, TODAY);
        expect(result.events).toEqual([]);
        expect(result.user).not.toBe(user);
        expect(result.user.streak).toEqual(streakState({ best: 3 }));
        expect(result.user.dailyProgress).toBe(user.dailyProgress);
        expect(DEFAULT_STREAK).toEqual(streakState());
    });

    it("never lowers the best streak", () => {
        const user = makeUser([entry(MON, 3)], { streak: streakState({ best: 20 }) });
        expect(refreshStreak(user, TODAY).user).toBe(user);
    });
});
