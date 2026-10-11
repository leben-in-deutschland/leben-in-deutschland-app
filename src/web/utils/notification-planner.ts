import { User, UserPreferences } from "@/types/user";
import { addDays, atTime, dayKey, isDayKey, weekdayOf } from "./date-utils";
import { Translations } from "./i18n";
import {
    dayOfYear,
    encouragementCard,
    examCard,
    FallbackTexts,
    LearnerFacts,
    learnerFacts,
    mockCard,
    pickQuestionOfTheDay,
    questionCard,
    QuestionCardVariant,
    streakCard,
    translate,
    weeklyCard,
} from "./notification-content";
import { computeReadiness } from "./readiness-logic";
import { computeStreak, goalProgress, isRestDay } from "./streak-logic";
import { DEFAULT_REMINDERS, prefsOf } from "./user-defaults";

/**
 * Plans the Android local notifications for the coming days.
 *
 * A scheduled notification cannot react to what the learner does later, so
 * the app plans again on every start and whenever the inputs change: the
 * notification service cancels every id of `plannedNotificationIds()` and
 * schedules what `planNotifications` returns. Come-back reminders therefore
 * only fire when the learner stays away.
 *
 * This module decides which notification fires when; the texts come from
 * `notification-content.ts`: a question of the day on even days of the year
 * (and after 3 and 7 days away), encouragement from the learner's own
 * numbers otherwise, with the generic `notif_*` texts as fallback.
 *
 * Pure: no clock, no storage, no plugin. Callers pass "now".
 */

export type NotificationChannelId = "reminders" | "streak" | "exam" | "progress";

export type NotificationKind = "daily" | "comeback" | "streak" | "weekly" | "exam" | "mock";

/**
 * Button sets the notification service registers with the plugin
 * (`registerActionTypes`). Every button opens the app at the card's route.
 */
export type NotificationActionTypeId = "question" | "practice" | "mock" | "progress";

/** Texts and target of one notification, without id, channel, or time. */
export interface NotificationCard {
    title: string;
    body: string;
    /** In-app route that a tap opens. */
    route: string;
    /** Expanded text (Android "big text"). The service falls back to `body`. */
    largeBody?: string;
    /** Small line under the expanded text, for example "Nr. 12 · Rechte & Freiheiten". */
    summaryText?: string;
    /** Lines of an Android "inbox" card; used instead of `largeBody` when present. */
    inboxList?: string[];
    /** Button set, see `NotificationActionTypeId`. No buttons when missing. */
    actionTypeId?: NotificationActionTypeId;
    /** Catalogue question shown on a question card. */
    questionNum?: string;
}

export interface PlannedNotification extends NotificationCard {
    /** Stable id, one of `plannedNotificationIds()`. */
    id: number;
    channelId: NotificationChannelId;
    kind: NotificationKind;
    /** When the notification fires, as local wall-clock time. */
    at: Date;
}

/** The single 08:00 daily reminder of version 2.0. Only ever cancelled, never planned. */
export const LEGACY_NOTIFICATION_ID = 65241;

/** First id per kind. Kinds with several notifications count up from here. */
export const NOTIFICATION_IDS: Readonly<Record<NotificationKind, number>> = Object.freeze({
    daily: 2000,
    comeback: 2100,
    streak: 3000,
    weekly: 4000,
    exam: 5000,
    mock: 6000,
});

/** Daily reminder texts: "notif_daily_title_0" ... "notif_daily_title_5" (and bodies). */
export const DAILY_VARIANTS = 6;

/** Every Android channel the planner uses. */
export const NOTIFICATION_CHANNEL_IDS: readonly NotificationChannelId[] = ["reminders", "streak", "exam", "progress"];

const CHANNEL_OF_KIND: Record<NotificationKind, NotificationChannelId> = {
    daily: "reminders",
    comeback: "reminders",
    streak: "streak",
    weekly: "progress",
    exam: "exam",
    mock: "exam",
};

/** Daily reminders cover today and the next two days (ids 2000-2002). */
const DAILY_REMINDER_DAYS = 3;
/** Come-back reminders after this many days away (ids 2100-2103). */
const COMEBACK_OFFSETS = [3, 5, 7, 14] as const;
/** Streak reminders for today and tomorrow (ids 3000-3001). */
const STREAK_REMINDER_DAYS = 2;
/** Weekly summary on Sunday (weekday 0) evening. */
const WEEKLY_WEEKDAY = 0;
const WEEKLY_TIME = "18:00";
/** Days before the exam, in id order (ids 5000-5005). */
const EXAM_REMINDER_DAYS = [30, 14, 7, 3, 1, 0] as const;
const EXAM_REMINDER_TIME = "09:00";
/** The mock nudge waits until this many catalogue questions are answered. */
const MOCK_NUDGE_MIN_ANSWERED = 30;
/** No mock nudge after a mock exam on one of this many calendar days, today included. */
const MOCK_NUDGE_QUIET_DAYS = 3;
const MOCK_NUDGE_TIME = "17:00";

/** A planned notification before its channel is looked up. */
interface Draft {
    id: number;
    kind: NotificationKind;
    at: Date;
    card: NotificationCard;
}

/** Inputs shared by every card of one plan. */
interface PlanContext {
    facts: LearnerFacts;
    t: Translations;
    /** Numbers of the questions already shown on a card of this plan. */
    asked: Set<string>;
}

function idRange(first: number, count: number): number[] {
    return Array.from({ length: count }, (_, index) => first + index);
}

/** Every id the planner may use, for cancelling. `LEGACY_NOTIFICATION_ID` is not included. */
export function plannedNotificationIds(): number[] {
    return [
        ...idRange(NOTIFICATION_IDS.daily, DAILY_REMINDER_DAYS),
        ...idRange(NOTIFICATION_IDS.comeback, COMEBACK_OFFSETS.length),
        ...idRange(NOTIFICATION_IDS.streak, STREAK_REMINDER_DAYS),
        NOTIFICATION_IDS.weekly,
        ...idRange(NOTIFICATION_IDS.exam, EXAM_REMINDER_DAYS.length),
        NOTIFICATION_IDS.mock,
    ];
}

/** Question of the day on even days of the year, encouragement on odd ones. */
function asksQuestion(day: string): boolean {
    return dayOfYear(day) % 2 === 0;
}

/**
 * A question card when `ask` is set and a question is left to show,
 * otherwise encouragement (generic `fallback` texts when no fact applies).
 * Every question shown is remembered so no two cards of a plan repeat one.
 */
function questionOrEncouragement(
    context: PlanContext,
    day: string,
    ask: boolean,
    variant: QuestionCardVariant,
    fallback: FallbackTexts,
): NotificationCard {
    if (ask) {
        const pick = pickQuestionOfTheDay(context.facts.user, day, context.asked);
        if (pick) {
            context.asked.add(pick.question.num);
            return questionCard(pick, context.t, variant);
        }
    }
    return encouragementCard(context.facts, context.t, day, fallback);
}

function dailyReminders(context: PlanContext, prefs: UserPreferences, time: string, today: string): Draft[] {
    const goalMet = goalProgress(context.facts.user, today).met;
    const drafts: Draft[] = [];
    for (let offset = 0; offset < DAILY_REMINDER_DAYS; offset++) {
        const day = addDays(today, offset);
        if (isRestDay(day, prefs) || (offset === 0 && goalMet)) {
            continue;
        }
        const variant = dayOfYear(day) % DAILY_VARIANTS;
        drafts.push({
            id: NOTIFICATION_IDS.daily + offset,
            kind: "daily",
            at: atTime(day, time),
            card: questionOrEncouragement(context, day, asksQuestion(day), "daily", {
                titleKey: `notif_daily_title_${variant}`,
                bodyKey: `notif_daily_body_${variant}`,
            }),
        });
    }
    return drafts;
}

/** After 3 and 7 days away a question ("do you still know this one?"), after 5 and 14 encouragement. */
const COMEBACK_QUESTION_OFFSETS: readonly number[] = [3, 7];

function comebackReminders(context: PlanContext, time: string, today: string): Draft[] {
    return COMEBACK_OFFSETS.map((offset, index): Draft => {
        const day = addDays(today, offset);
        return {
            id: NOTIFICATION_IDS.comeback + index,
            kind: "comeback",
            at: atTime(day, time),
            card: questionOrEncouragement(context, day, COMEBACK_QUESTION_OFFSETS.includes(offset), "comeback", {
                titleKey: `notif_comeback_${offset}_title`,
                bodyKey: `notif_comeback_${offset}_body`,
            }),
        };
    });
}

function streakReminder(context: PlanContext, offset: number, day: string, time: string): Draft {
    return {
        id: NOTIFICATION_IDS.streak + offset,
        kind: "streak",
        at: atTime(day, time),
        card: streakCard(context.facts, context.t, offset),
    };
}

/**
 * Only while a streak is running: this evening unless today already counts
 * or is a rest day, and tomorrow evening unless tomorrow is a rest day.
 */
function streakReminders(context: PlanContext, prefs: UserPreferences, time: string, today: string): Draft[] {
    const streak = computeStreak(context.facts.user, today);
    if (streak.current < 1) {
        return [];
    }
    const drafts: Draft[] = [];
    if (!streak.todayDone && !isRestDay(today, prefs)) {
        drafts.push(streakReminder(context, 0, today, time));
    }
    const tomorrow = addDays(today, 1);
    if (!isRestDay(tomorrow, prefs)) {
        drafts.push(streakReminder(context, 1, tomorrow, time));
    }
    return drafts;
}

/** The next Sunday 18:00 strictly after `now`. */
function nextWeeklySummary(today: string, now: Date): Date {
    const daysToSunday = (7 + WEEKLY_WEEKDAY - weekdayOf(today)) % 7;
    const thisWeek = atTime(addDays(today, daysToSunday), WEEKLY_TIME);
    return thisWeek.getTime() > now.getTime() ? thisWeek : atTime(addDays(today, daysToSunday + 7), WEEKLY_TIME);
}

function examReminders(context: PlanContext, examDate: string): Draft[] {
    return EXAM_REMINDER_DAYS.map(
        (days, index): Draft => ({
            id: NOTIFICATION_IDS.exam + index,
            kind: "exam",
            at: atTime(addDays(examDate, -days), EXAM_REMINDER_TIME),
            card: examCard(context.facts, context.t, examDate, days),
        }),
    );
}

/**
 * Whether a mock exam that was not cancelled started on one of the last
 * MOCK_NUDGE_QUIET_DAYS calendar days (today and the two days before; a
 * start date after today counts as recent too). Unreadable dates are ignored.
 */
function hasRecentMock(user: User, today: string): boolean {
    const since = addDays(today, 1 - MOCK_NUDGE_QUIET_DAYS);
    return (user.testProgress ?? []).some((test) => {
        if (!test || test.cancelled === true) {
            return false;
        }
        const started = new Date(test.datetime);
        return !Number.isNaN(started.getTime()) && dayKey(started) >= since;
    });
}

/** Enough catalogue questions answered (as counted by readiness) and no recent mock exam. */
function mockNudgeDue(user: User, today: string): boolean {
    return computeReadiness(user).answered >= MOCK_NUDGE_MIN_ANSWERED && !hasRecentMock(user, today);
}

/**
 * Content of the test notification that Settings sends 5 seconds from now:
 * today's question card, so the learner sees the real format, marked "Test"
 * in its summary line. Without a learner or a catalogue, a plain
 * confirmation that opens Settings.
 */
export function planTestNotification(user: User | null | undefined, t: Translations, now: Date): NotificationCard {
    if (user && !Number.isNaN(now.getTime())) {
        const pick = pickQuestionOfTheDay(user, dayKey(now));
        if (pick) {
            return questionCard(pick, t, "test");
        }
    }
    return {
        title: translate(t, "notif_test_title"),
        body: translate(t, "notif_test_body"),
        route: "/settings",
    };
}

/**
 * Notifications to schedule from `now` on, sorted by time (then id). Empty
 * without a learner, before onboarding is completed, or when notifications
 * are switched off. Times are local wall-clock times; anything not strictly
 * after `now` is left out. Missing translations fall back to the key.
 */
export function planNotifications(
    user: User | null | undefined,
    t: Translations,
    now: Date,
): PlannedNotification[] {
    if (!user || user.onboardingCompleted !== true || Number.isNaN(now.getTime())) {
        return [];
    }
    const prefs = prefsOf(user);
    if (!prefs.notificationsEnabled) {
        return [];
    }
    const reminders = prefs.reminders ?? DEFAULT_REMINDERS;
    const today = dayKey(now);
    const context: PlanContext = { facts: learnerFacts(user, today), t, asked: new Set() };
    const drafts: Draft[] = [];

    if (reminders.daily) {
        drafts.push(...dailyReminders(context, prefs, reminders.dailyTime, today));
    }
    if (reminders.comeback) {
        drafts.push(...comebackReminders(context, reminders.dailyTime, today));
    }
    if (reminders.streak) {
        drafts.push(...streakReminders(context, prefs, reminders.streakTime, today));
    }
    if (reminders.weekly) {
        const at = nextWeeklySummary(today, now);
        drafts.push({
            id: NOTIFICATION_IDS.weekly,
            kind: "weekly",
            at,
            card: weeklyCard(context.facts, t, dayKey(at)),
        });
    }
    if (reminders.examCountdown && isDayKey(user.examDate)) {
        drafts.push(...examReminders(context, user.examDate));
    }
    if (reminders.mockNudge && mockNudgeDue(user, today)) {
        drafts.push({
            id: NOTIFICATION_IDS.mock,
            kind: "mock",
            at: atTime(addDays(today, 1), MOCK_NUDGE_TIME),
            card: mockCard(context.facts, t),
        });
    }

    return drafts
        .filter((draft) => draft.at.getTime() > now.getTime())
        .sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id)
        .map((draft) => ({
            id: draft.id,
            channelId: CHANNEL_OF_KIND[draft.kind],
            kind: draft.kind,
            at: draft.at,
            ...draft.card,
        }));
}
