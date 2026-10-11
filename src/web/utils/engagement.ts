import { EvaluationData } from "@/types/evaluation";
import { InAppNotification, User } from "@/types/user";
import { buildAchievementContext, unlockAchievements } from "./achievements";
import { addDays, dayKey, daysBetween, isDayKey, isoWeekKey } from "./date-utils";
import { fmt, Translations } from "./i18n";
import { computeReadiness } from "./readiness-logic";
import { computeStreak, goalProgress, refreshStreak } from "./streak-logic";
import { MAX_INBOX_ITEMS, prefsOf } from "./user-defaults";

/**
 * Engagement: keeps the streak freezes, achievements, and the in-app
 * notification center ("inbox") of a learner current.
 *
 * `runEngagement` is pure and idempotent. Every notification has a stable id,
 * so running it again with the same input adds nothing and returns the very
 * same user object. The shell runs it after every change of the stored record
 * and saves the result only when the object changed.
 *
 * Texts are stored as translation keys plus parameters and rendered with the
 * current language in `renderNotification`, so a language switch also
 * switches old notifications.
 */

export interface EngagementOptions {
    now: Date;
    /** Bundled BAMF evaluation data, see `data/data.ts`. */
    evaluation?: EvaluationData | null;
}

export interface EngagementResult {
    user: User;
    /** Notifications added by this run, newest first. */
    added: InAppNotification[];
}

/** Streak lengths that get a note in the inbox. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];
/** Exam countdown stages; each stage gets one note per exam date. */
export const EXAM_COUNTDOWN_DAYS = [30, 14, 7, 3, 1, 0];
/** Number of `inbox_tip_<n>` texts in the translations. */
export const TIP_COUNT = 8;
/** From this many achievements at once, one summary note replaces the single notes. */
const ACHIEVEMENT_CATCHUP_MIN = 3;
/** The in-app mock nudge waits until this many catalogue questions are answered. */
const MOCK_NUDGE_MIN_ANSWERED = 30;
/** No nudge when a mock exam ran on one of this many calendar days, today included. */
const MOCK_NUDGE_QUIET_DAYS = 3;
/** Days between two mock nudges. */
const MOCK_NUDGE_REPEAT_DAYS = 14;

type Draft = Omit<InAppNotification, "createdAt" | "read">;

function inboxOf(user: User | null | undefined): InAppNotification[] {
    return Array.isArray(user?.inbox) ? user.inbox.filter((item) => item && typeof item.id === "string") : [];
}

/** Day key of a stored ISO timestamp; null when unreadable. */
function dayOf(iso: string | undefined): string | null {
    if (!iso) {
        return null;
    }
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : dayKey(date);
}

/** The smallest countdown stage that is still ahead of or on `days`. */
function countdownStage(days: number): number | null {
    if (days < 0 || days > EXAM_COUNTDOWN_DAYS[0]) {
        return null;
    }
    const ahead = EXAM_COUNTDOWN_DAYS.filter((stage) => stage >= days);
    return ahead.length === 0 ? null : ahead[ahead.length - 1];
}

/** A mock exam that was not cancelled started within the quiet days. */
function hasRecentMock(user: User, today: string): boolean {
    const since = addDays(today, 1 - MOCK_NUDGE_QUIET_DAYS);
    return (user.testProgress ?? []).some((test) => {
        if (!test || test.cancelled) {
            return false;
        }
        const day = dayOf(test.datetime);
        return day !== null && day >= since && day <= today;
    });
}

function mockNudgeDue(user: User, today: string, inbox: InAppNotification[]): boolean {
    const lastNudge = inbox.find((item) => item.type === "mock");
    const lastNudgeDay = dayOf(lastNudge?.createdAt);
    if (lastNudgeDay !== null && daysBetween(lastNudgeDay, today) < MOCK_NUDGE_REPEAT_DAYS) {
        return false;
    }
    if (hasRecentMock(user, today)) {
        return false;
    }
    return computeReadiness(user).answered >= MOCK_NUDGE_MIN_ANSWERED;
}

/** Every note the current state deserves. Ids that already exist are dropped by the caller. */
function collectDrafts(
    user: User,
    today: string,
    inbox: InAppNotification[],
    unlocked: string[],
    freezeEvents: { type: "freeze-used" | "freeze-earned"; day: string }[],
    evaluationChanged: string | null,
): Draft[] {
    const drafts: Draft[] = [];
    const prefs = prefsOf(user);
    const isFirstRun = !inbox.some((item) => item.id === "welcome");

    if (isFirstRun) {
        drafts.push({ id: "welcome", type: "welcome", titleKey: "inbox_welcome_title", bodyKey: "inbox_welcome_body", route: "/practice" });
    }

    for (const event of freezeEvents) {
        if (event.type === "freeze-used") {
            drafts.push({
                id: `freeze-used-${event.day}`,
                type: "freeze",
                titleKey: "inbox_freeze_used_title",
                bodyKey: "inbox_freeze_used_body",
                route: "/progress#streak",
            });
        } else {
            drafts.push({
                id: `freeze-earned-${event.day}`,
                type: "freeze",
                titleKey: "inbox_freeze_earned_title",
                bodyKey: "inbox_freeze_earned_body",
                params: { freezes: user.streak?.freezes ?? 1 },
                route: "/progress#streak",
            });
        }
    }

    if (unlocked.length >= ACHIEVEMENT_CATCHUP_MIN) {
        drafts.push({
            id: `achievements-${today}-${unlocked.length}`,
            type: "achievement",
            titleKey: "inbox_achievement_catchup_title",
            bodyKey: "inbox_achievement_catchup_body",
            params: { count: unlocked.length },
            route: "/progress#achievements",
        });
    } else {
        for (const id of unlocked) {
            drafts.push({
                id: `achievement-${id}`,
                type: "achievement",
                titleKey: "inbox_achievement_title",
                bodyKey: `ach_${id}_desc`,
                params: { nameKey: `ach_${id}_title` },
                route: "/progress#achievements",
            });
        }
    }

    const goal = goalProgress(user, today);
    if (goal.met) {
        drafts.push({
            id: `goal-${today}`,
            type: "goal",
            titleKey: "inbox_goal_title",
            bodyKey: "inbox_goal_body",
            params: { goal: goal.goal },
            route: "/progress",
        });
    }

    const streak = computeStreak(user, today);
    if (streak.todayDone && STREAK_MILESTONES.includes(streak.current)) {
        drafts.push({
            id: `streak-${streak.current}-${today}`,
            type: "streak",
            titleKey: "inbox_streak_title",
            bodyKey: "inbox_streak_body",
            params: { days: streak.current },
            route: "/progress#streak",
        });
    }

    if (isDayKey(user.examDate)) {
        const days = daysBetween(today, user.examDate);
        const stage = countdownStage(days);
        if (stage !== null) {
            drafts.push({
                id: `exam-${stage}-${user.examDate}`,
                type: "exam",
                titleKey: `inbox_exam_${stage}_title`,
                bodyKey: `inbox_exam_${stage}_body`,
                params: { days },
                route: stage === 0 ? "/dashboard" : "/mock",
            });
        }
    }

    if (evaluationChanged) {
        drafts.push({
            id: `evaluation-${evaluationChanged}`,
            type: "evaluation",
            titleKey: "inbox_evaluation_title",
            bodyKey: "inbox_evaluation_body",
            params: { date: evaluationChanged },
            route: "/#bamf-evaluation",
        });
    }

    // Tips start the week after the welcome note.
    const welcomeDay = dayOf(inbox.find((item) => item.id === "welcome")?.createdAt);
    const quietWeek = isFirstRun || (welcomeDay !== null && isoWeekKey(welcomeDay) === isoWeekKey(today));
    if (prefs.tips && !quietWeek) {
        const seen = inbox.filter((item) => item.type === "tip").length;
        drafts.push({
            id: `tip-${isoWeekKey(today)}`,
            type: "tip",
            titleKey: "inbox_tip_title",
            bodyKey: `inbox_tip_${seen % TIP_COUNT}`,
            route: "/practice",
        });
    }

    if (!isFirstRun && mockNudgeDue(user, today, inbox)) {
        drafts.push({ id: `mock-${today}`, type: "mock", titleKey: "inbox_mock_title", bodyKey: "inbox_mock_body", route: "/mock" });
    }

    return drafts;
}

/**
 * Applies streak freezes, unlocks achievements, and adds the notifications
 * the learner has earned since the last run. Returns the same user object
 * when nothing changed.
 */
export function runEngagement(user: User, options: EngagementOptions): EngagementResult {
    const today = dayKey(options.now);
    const inbox = inboxOf(user);

    const streakResult = refreshStreak(user, today);
    const achievementResult = unlockAchievements(buildAchievementContext(streakResult.user, today), options.now);
    let next = achievementResult.user;

    const evaluationDate = options.evaluation?.examDate?.trim() || null;
    let evaluationChanged: string | null = null;
    if (evaluationDate && evaluationDate !== user.lastSeenEvaluationDate) {
        // The first run only remembers the date; later changes get a note.
        evaluationChanged = user.lastSeenEvaluationDate ? evaluationDate : null;
        next = { ...next, lastSeenEvaluationDate: evaluationDate };
    }

    const known = new Set(inbox.map((item) => item.id));
    const drafts = collectDrafts(next, today, inbox, achievementResult.unlocked, streakResult.events, evaluationChanged).filter(
        (draft) => !known.has(draft.id),
    );

    if (drafts.length === 0) {
        return { user: next, added: [] };
    }

    const createdAt = options.now.toISOString();
    const added = drafts.map((draft) => ({ ...draft, createdAt, read: false }));
    return {
        user: { ...next, inbox: [...added, ...inbox].slice(0, MAX_INBOX_ITEMS) },
        added,
    };
}

/** Title and body of a notification in the current language. */
export function renderNotification(t: Translations, item: InAppNotification): { title: string; body: string } {
    const params = { ...(item.params ?? {}) };
    if (typeof params.nameKey === "string") {
        params.name = t[params.nameKey] ?? params.nameKey;
    }
    return {
        title: fmt(t[item.titleKey], params) || item.titleKey,
        body: fmt(t[item.bodyKey], params),
    };
}

export function unreadCount(user: User | null | undefined): number {
    return inboxOf(user).filter((item) => !item.read).length;
}

/** Marks one notification as read. Returns the same object when nothing changed. */
export function markNotificationRead(user: User, id: string): User {
    const inbox = inboxOf(user);
    if (!inbox.some((item) => item.id === id && !item.read)) {
        return user;
    }
    return { ...user, inbox: inbox.map((item) => (item.id === id ? { ...item, read: true } : item)) };
}

/** Marks every notification as read. Returns the same object when nothing changed. */
export function markAllNotificationsRead(user: User): User {
    const inbox = inboxOf(user);
    if (!inbox.some((item) => !item.read)) {
        return user;
    }
    return { ...user, inbox: inbox.map((item) => (item.read ? item : { ...item, read: true })) };
}
