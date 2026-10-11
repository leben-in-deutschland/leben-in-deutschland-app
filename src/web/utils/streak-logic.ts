import { StreakState, User, UserDailyProgress, UserPreferences } from "@/types/user";
import { addDays, dayKey, dayRange, startOfWeek, weekdayOf } from "./date-utils";
import { DEFAULT_PREFERENCES, MAX_STREAK_FREEZES, prefsOf } from "./user-defaults";

/**
 * Streaks, daily goals, and streak freezes.
 *
 * Activity is grouped by local calendar day ("YYYY-MM-DD"). A day qualifies
 * for the streak under the learner's streak rule: any practice ("activity")
 * or reaching the daily goal ("goal"). Rest days and days covered by a freeze
 * are neutral: they neither count nor break the streak. Today never breaks
 * the streak while it is still in progress.
 *
 * Everything here is pure. Callers pass "today" as a day key.
 */

export interface DayActivity {
    day: string;
    /** Answers given that day (practice answers plus answered mock questions). */
    answered: number;
    attempted: number;
    correct: number;
    incorrect: number;
}

export type DayStatus = "done" | "partial" | "frozen" | "rest" | "missed" | "today" | "future" | "none";

export interface GoalProgress {
    goal: number;
    answered: number;
    remaining: number;
    /** Share of the goal reached, from 0 to 1. */
    ratio: number;
    met: boolean;
}

export interface StreakInfo {
    /** Qualifying days in the current streak, today included once it qualifies. */
    current: number;
    best: number;
    todayDone: boolean;
    /** A streak is running, today does not qualify yet, and today is not a rest day. */
    atRisk: boolean;
    /** First qualifying day of the current streak. */
    startDay: string | null;
    /** Most recent qualifying day up to today. */
    lastActiveDay: string | null;
    freezes: number;
}

export interface WeekDay {
    day: string;
    /** 0 = Sunday ... 6 = Saturday, like `UserPreferences.restDays`. */
    weekday: number;
    status: DayStatus;
    answered: number;
    isToday: boolean;
}

export interface CalendarDay {
    day: string;
    answered: number;
    status: DayStatus;
}

export type StreakEvent = { type: "freeze-used"; day: string } | { type: "freeze-earned"; day: string; streak: number };

/** A streak freeze is earned for every 7 streak days in a row. */
export const FREEZE_EARN_INTERVAL = 7;

/** How many "freeze earned" days are remembered. */
const EARNED_DAYS_KEPT = 30;
/** Safety bound for every walk back through the calendar. */
const MAX_WALK_DAYS = 4000;
const DEFAULT_CALENDAR_DAYS = 84;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Everything the streak rules need, computed once per call. */
interface StreakScan {
    prefs: UserPreferences;
    activity: Map<string, DayActivity>;
    frozen: Set<string>;
    /** Earliest day with a stored entry. Walks never go further back. */
    earliest: string | null;
    /** Earliest day with any practice. Earlier days have no streak status ("none"). */
    firstActive: string | null;
}

/** Whole non-negative number; 0 for anything unusable. */
function toCount(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function emptyActivity(day: string): DayActivity {
    return { day, answered: 0, attempted: 0, correct: 0, incorrect: 0 };
}

/**
 * Local day of a stored entry. Older versions stored `Date.toDateString()`
 * ("Fri Oct 09 2026"); some records hold ISO strings. Null when unreadable.
 */
function entryDay(entry: UserDailyProgress): string | null {
    if (!entry || !entry.date) {
        return null;
    }
    const date = new Date(entry.date);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    const key = dayKey(date);
    return DAY_KEY_PATTERN.test(key) ? key : null;
}

/** Answers given on a stored day. Older records have no `answered` and use correct + incorrect. */
export function answeredCount(entry: UserDailyProgress): number {
    if (typeof entry.answered === "number") {
        return toCount(entry.answered);
    }
    return toCount(entry.correct) + toCount(entry.incorrect);
}

/** Activity per local day, oldest first. Several entries for the same day are added up. */
export function activityByDay(user: User): Map<string, DayActivity> {
    const byDay = new Map<string, DayActivity>();
    for (const entry of user.dailyProgress ?? []) {
        const day = entryDay(entry);
        if (!day) {
            continue;
        }
        const sum = byDay.get(day) ?? emptyActivity(day);
        byDay.set(day, {
            day,
            answered: sum.answered + answeredCount(entry),
            attempted: sum.attempted + toCount(entry.attempted),
            correct: sum.correct + toCount(entry.correct),
            incorrect: sum.incorrect + toCount(entry.incorrect),
        });
    }
    return new Map(Array.from(byDay).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function getDayActivity(user: User, day: string): DayActivity {
    return activityByDay(user).get(day) ?? emptyActivity(day);
}

/** The daily goal; the default for unusable stored values, so "goal" days never qualify without answers. */
function dailyGoalOf(prefs: UserPreferences): number {
    const goal = toCount(prefs.dailyGoal);
    return goal >= 1 ? goal : DEFAULT_PREFERENCES.dailyGoal;
}

export function goalProgress(user: User, today: string): GoalProgress {
    const goal = dailyGoalOf(prefsOf(user));
    const answered = getDayActivity(user, today).answered;
    return {
        goal,
        answered,
        remaining: Math.max(0, goal - answered),
        ratio: Math.min(1, answered / goal),
        met: answered >= goal,
    };
}

export function isRestDay(day: string, prefs: UserPreferences): boolean {
    const restDays = prefs.restDays ?? [];
    return restDays.length > 0 && restDays.includes(weekdayOf(day));
}

/** Whether a day keeps the streak: any practice ("activity") or the daily goal reached ("goal"). */
export function dayQualifies(activity: DayActivity | undefined, prefs: UserPreferences): boolean {
    if (!activity) {
        return false;
    }
    if (prefs.streakRule === "goal") {
        return activity.answered >= dailyGoalOf(prefs);
    }
    return activity.attempted > 0 || activity.answered > 0;
}

function scanUser(user: User): StreakScan {
    const activity = activityByDay(user);
    let earliest: string | null = null;
    let firstActive: string | null = null;
    for (const [day, item] of activity) {
        if (earliest === null || day < earliest) {
            earliest = day;
        }
        if ((item.attempted > 0 || item.answered > 0) && (firstActive === null || day < firstActive)) {
            firstActive = day;
        }
    }
    return {
        prefs: prefsOf(user),
        activity,
        frozen: new Set(user.streak?.frozenDays ?? []),
        earliest,
        firstActive,
    };
}

function qualifies(scan: StreakScan, day: string): boolean {
    return dayQualifies(scan.activity.get(day), scan.prefs);
}

/** Frozen and rest days neither count nor break the streak. */
function isNeutral(scan: StreakScan, day: string): boolean {
    return scan.frozen.has(day) || isRestDay(day, scan.prefs);
}

/** Qualifying days walking back from `from` (included) until the first missed day. */
function countBack(scan: StreakScan, from: string): { count: number; startDay: string | null } {
    let count = 0;
    let startDay: string | null = null;
    const earliest = scan.earliest;
    if (earliest === null) {
        return { count, startDay };
    }
    let day = from;
    for (let step = 0; step < MAX_WALK_DAYS && day >= earliest; step++) {
        if (qualifies(scan, day)) {
            count += 1;
            startDay = day;
        } else if (!isNeutral(scan, day)) {
            break;
        }
        day = addDays(day, -1);
    }
    return { count, startDay };
}

/** True when a qualifying day is reached walking back from `from` through frozen or rest days only. */
function streakReaches(scan: StreakScan, from: string): boolean {
    const earliest = scan.earliest;
    if (earliest === null) {
        return false;
    }
    let day = from;
    for (let step = 0; step < MAX_WALK_DAYS && day >= earliest; step++) {
        if (qualifies(scan, day)) {
            return true;
        }
        if (!isNeutral(scan, day)) {
            return false;
        }
        day = addDays(day, -1);
    }
    return false;
}

function lastQualifyingDay(scan: StreakScan, today: string): string | null {
    let last: string | null = null;
    for (const [day, item] of scan.activity) {
        if (day <= today && (last === null || day > last) && dayQualifies(item, scan.prefs)) {
            last = day;
        }
    }
    return last;
}

function streakFromScan(scan: StreakScan, state: StreakState | undefined, today: string): StreakInfo {
    const todayDone = qualifies(scan, today);
    const before = countBack(scan, addDays(today, -1));
    const current = before.count + (todayDone ? 1 : 0);
    return {
        current,
        best: Math.max(toCount(state?.best), current),
        todayDone,
        atRisk: current > 0 && !todayDone && !isRestDay(today, scan.prefs),
        startDay: before.startDay ?? (todayDone ? today : null),
        lastActiveDay: lastQualifyingDay(scan, today),
        freezes: toCount(state?.freezes),
    };
}

/**
 * Current streak, counted back from today. Today counts once it qualifies and
 * never breaks the streak while it is still in progress.
 */
export function computeStreak(user: User, today: string): StreakInfo {
    return streakFromScan(scanUser(user), user.streak, today);
}

function statusOf(scan: StreakScan, day: string, today: string): DayStatus {
    if (day > today) {
        return "future";
    }
    const activity = scan.activity.get(day);
    const done = dayQualifies(activity, scan.prefs);
    if (day === today) {
        return done ? "done" : "today";
    }
    if (done) {
        return "done";
    }
    if (scan.frozen.has(day)) {
        return "frozen";
    }
    if (isRestDay(day, scan.prefs)) {
        return "rest";
    }
    const answered = activity?.answered ?? 0;
    if (scan.prefs.streakRule === "goal" && answered > 0 && answered < dailyGoalOf(scan.prefs)) {
        return "partial";
    }
    if (scan.firstActive === null || day < scan.firstActive) {
        return "none";
    }
    return "missed";
}

/** Monday to Sunday of the week that contains today. */
export function weekView(user: User, today: string): WeekDay[] {
    const scan = scanUser(user);
    const monday = startOfWeek(today);
    return dayRange(monday, addDays(monday, 6)).map((day) => ({
        day,
        weekday: weekdayOf(day),
        status: statusOf(scan, day, today),
        answered: scan.activity.get(day)?.answered ?? 0,
        isToday: day === today,
    }));
}

/** The last `days` days, oldest first, ending today. */
export function activityCalendar(user: User, today: string, days: number = DEFAULT_CALENDAR_DAYS): CalendarDay[] {
    const length = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : DEFAULT_CALENDAR_DAYS;
    if (length === 0) {
        return [];
    }
    const scan = scanUser(user);
    return dayRange(addDays(today, 1 - length), today).map((day) => ({
        day,
        answered: scan.activity.get(day)?.answered ?? 0,
        status: statusOf(scan, day, today),
    }));
}

function streakStateOf(user: User): StreakState {
    const streak = user.streak;
    return {
        best: toCount(streak?.best),
        freezes: toCount(streak?.freezes),
        frozenDays: streak?.frozenDays ?? [],
        freezeEarnedDays: streak?.freezeEarnedDays ?? [],
    };
}

/**
 * Days missed since the most recent kept day (qualifying or frozen) before
 * today, oldest first; rest days in between are skipped. Empty unless a streak
 * existed before the gap and the saved freezes cover every missed day. Looks
 * back at most MAX_STREAK_FREEZES + 1 missed days.
 */
function coverableGap(scan: StreakScan, today: string, freezes: number): string[] {
    const limit = Math.min(freezes, MAX_STREAK_FREEZES);
    const earliest = scan.earliest;
    if (limit < 1 || earliest === null) {
        return [];
    }
    const missed: string[] = [];
    let day = addDays(today, -1);
    for (let step = 0; step < MAX_WALK_DAYS && day >= earliest; step++) {
        if (qualifies(scan, day) || scan.frozen.has(day)) {
            return missed.length > 0 && streakReaches(scan, day) ? missed.reverse() : [];
        }
        if (!isRestDay(day, scan.prefs)) {
            missed.push(day);
            if (missed.length > limit) {
                return [];
            }
        }
        day = addDays(day, -1);
    }
    return [];
}

/**
 * Brings the stored streak up to date for today:
 * 1. Saved freezes cover the days missed since the last kept day, but only
 *    when they cover all of them; otherwise the streak is lost.
 * 2. Every 7th streak day (once today qualifies) earns a freeze, up to
 *    MAX_STREAK_FREEZES.
 * 3. The best streak is raised to the current one.
 * Returns the same user object and no events when nothing changed.
 */
export function refreshStreak(user: User, today: string): { user: User; events: StreakEvent[] } {
    const previous = streakStateOf(user);
    const events: StreakEvent[] = [];
    let scan = scanUser(user);
    let freezes = previous.freezes;
    let frozenDays = previous.frozenDays;
    let freezeEarnedDays = previous.freezeEarnedDays;

    const missed = coverableGap(scan, today, freezes);
    if (missed.length > 0) {
        frozenDays = [...frozenDays, ...missed];
        freezes -= missed.length;
        scan = { ...scan, frozen: new Set(frozenDays) };
        for (const day of missed) {
            events.push({ type: "freeze-used", day });
        }
    }

    const info = streakFromScan(scan, previous, today);
    if (
        info.todayDone &&
        info.current >= FREEZE_EARN_INTERVAL &&
        info.current % FREEZE_EARN_INTERVAL === 0 &&
        !freezeEarnedDays.includes(today) &&
        freezes < MAX_STREAK_FREEZES
    ) {
        freezes += 1;
        freezeEarnedDays = [...freezeEarnedDays, today].slice(-EARNED_DAYS_KEPT);
        events.push({ type: "freeze-earned", day: today, streak: info.current });
    }

    const best = Math.max(previous.best, info.current);
    if (events.length === 0 && best === previous.best) {
        return { user, events };
    }
    return {
        user: { ...user, streak: { best, freezes, frozenDays, freezeEarnedDays } },
        events,
    };
}
