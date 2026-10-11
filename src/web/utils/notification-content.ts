import { Question } from "@/types/question";
import { User } from "@/types/user";
import { daysBetween, isDayKey } from "./date-utils";
import { fmt, plural, TranslationParams, Translations } from "./i18n";
import type { NotificationCard } from "./notification-planner";
import { getRelevantQuestions, normalizeCategory } from "./question-bank";
import { computeReadiness, Readiness } from "./readiness-logic";
import { dueCount } from "./review-schedule";
import { computeStreak, GoalProgress, goalProgress, StreakInfo } from "./streak-logic";
import { buildModeQuestions } from "./study-modes";
import { prefsOf } from "./user-defaults";

/**
 * Texts of the Android notifications: a catalogue question to answer, or
 * encouragement built from the learner's own numbers.
 *
 * Everything is computed on the device from the learner record (ADR-003).
 * The planner (`notification-planner.ts`) decides which card fires when;
 * this module only builds the cards. Pure: no clock, no storage, no plugin.
 * Callers pass the day a card fires as a "YYYY-MM-DD" day key.
 */

/** Pool a question of the day came from; also the mode `/prepare` opens. */
export type QuestionPoolMode = "review" | "incorrect" | "new" | "quick";

export interface QuestionPick {
    question: Question;
    mode: QuestionPoolMode;
}

/** "daily" asks the question of the day, "comeback" after days away, "test" from Settings. */
export type QuestionCardVariant = "daily" | "comeback" | "test";

/** Result of the last mock exam that was not cancelled. */
export interface MockResult {
    correct: number;
    total: number;
    passed: boolean;
}

/** Translation keys of a generic title and body, used when no fact applies. */
export interface FallbackTexts {
    titleKey: string;
    bodyKey: string;
}

/** The learner's numbers, computed once per plan. */
export interface LearnerFacts {
    user: User;
    /** The day the plan is made. Volatile facts (streak, today's goal) only fit this day. */
    today: string;
    stateCode: string;
    /** Trimmed nickname, or null when none is set. */
    name: string | null;
    readiness: Readiness;
    streak: StreakInfo;
    goal: GoalProgress;
    lastMock: MockResult | null;
    /** Valid "YYYY-MM-DD" exam day, or null. */
    examDate: string | null;
    /** Questions of the learner's catalogue due for review on a day. */
    dueOn: (day: string) => number;
}

/** Readiness facts need this many answered questions to say anything. */
const READINESS_MIN_ANSWERED = 10;
/** A streak is worth mentioning from this many days on. */
const STREAK_MIN_DAYS = 2;

const QUESTION_ROUTE = "/practice";
const PROGRESS_ROUTE = "/progress";
const MOCK_ROUTE = "/mock";
const DASHBOARD_ROUTE = "/dashboard";

/** The translation, or the key itself when it is missing or empty. */
export function translate(t: Translations, key: string): string {
    const value = t?.[key];
    return typeof value === "string" && value.length > 0 ? value : key;
}

/** 1 on January 1st, up to 366 on December 31st of a leap year. */
export function dayOfYear(day: string): number {
    return daysBetween(`${day.slice(0, 4)}-01-01`, day) + 1;
}

/** FNV-1a 32-bit hash; the same on every device, run, and language. */
export function stableHash(text: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

/** "2026-11-18" -> "18.11.2026". */
export function germanDate(day: string): string {
    const [year, month, date] = day.split("-");
    return `${date}.${month}.${year}`;
}

function text(t: Translations, key: string, params?: TranslationParams): string {
    return fmt(translate(t, key), params);
}

/** `<key>_named` with the learner's name when one is set and translated, else `<key>`. */
function personal(t: Translations, key: string, name: string | null, params?: TranslationParams): string {
    if (name && translate(t, `${key}_named`) !== `${key}_named`) {
        return text(t, `${key}_named`, { ...params, name });
    }
    return text(t, key, params);
}

/** A question shown as text only; image questions make no sense in a notification. */
function hasImage(question: Question): boolean {
    return Boolean(question.image) && question.image !== "-";
}

function lastMockOf(user: User): MockResult | null {
    const finished = (user.testProgress ?? []).filter((test) => Boolean(test) && test.cancelled !== true);
    const last = finished[finished.length - 1];
    const questions = Array.isArray(last?.questions) ? last.questions : [];
    if (!last || questions.length === 0) {
        return null;
    }
    return {
        correct: questions.filter((question) => question?.answeredCorrectly === true).length,
        total: questions.length,
        passed: last.passed === true,
    };
}

export function learnerFacts(user: User, today: string): LearnerFacts {
    const stateCode = user.state?.stateCode ?? "";
    const catalogue = new Set(getRelevantQuestions(stateCode).map((question) => question.num));
    const name = (user.nickname ?? "").trim();
    return {
        user,
        today,
        stateCode,
        name: name.length > 0 ? name : null,
        readiness: computeReadiness(user),
        streak: computeStreak(user, today),
        goal: goalProgress(user, today),
        lastMock: lastMockOf(user),
        examDate: isDayKey(user.examDate) ? user.examDate : null,
        dueOn: (day) => dueCount(user.reviewSchedule, day, (num) => catalogue.has(num)),
    };
}

/**
 * The question of the day: the same for a day and catalogue on every run and
 * in every language. Due reviews come first, then wrong answers, then new
 * questions, then the whole catalogue. Image questions and the numbers in
 * `exclude` are skipped, so several cards never show the same question.
 * Null when the catalogue is empty or nothing is left to pick.
 */
export function pickQuestionOfTheDay(
    user: User,
    day: string,
    exclude: ReadonlySet<string> = new Set(),
): QuestionPick | null {
    const stateCode = user.state?.stateCode ?? "";
    const catalogue = getRelevantQuestions(stateCode);
    if (catalogue.length === 0) {
        return null;
    }
    const pools: [QuestionPoolMode, () => Question[]][] = [
        ["review", () => buildModeQuestions(user, "review", { today: day, sessionSize: 0 })],
        ["incorrect", () => buildModeQuestions(user, "incorrect", { today: day, sessionSize: 0 })],
        ["new", () => buildModeQuestions(user, "new", { today: day, sessionSize: 0 })],
        ["quick", () => catalogue],
    ];
    const hash = stableHash(`${day}|${stateCode}`);
    for (const [mode, pool] of pools) {
        const usable = pool().filter((question) => !hasImage(question) && !exclude.has(question.num));
        if (usable.length > 0) {
            return { question: usable[hash % usable.length], mode };
        }
    }
    return null;
}

/** Practice session that opens with the picked question. */
export function questionRoute(pick: QuestionPick): string {
    return `/prepare?action=${pick.mode}&start=${encodeURIComponent(pick.question.num)}`;
}

/**
 * A card that asks a catalogue question. The question itself stays German in
 * every language, because the exam is in German; only the frame is translated.
 */
export function questionCard(pick: QuestionPick, t: Translations, variant: QuestionCardVariant): NotificationCard {
    const { question } = pick;
    const category = normalizeCategory(question.category);
    const topic = translate(t, category);
    const summary = text(t, "notif_question_summary", { num: question.num, topic });
    const options = [`A ${question.a}`, `B ${question.b}`, `C ${question.c}`, `D ${question.d}`].join("\n");
    return {
        title: text(t, variant === "comeback" ? "notif_comeback_question_title" : "notif_question_title", { topic }),
        body: question.question,
        largeBody: `${question.question}\n\n${options}\n\n${translate(t, "notif_question_hint")}`,
        summaryText: variant === "test" ? `${translate(t, "notif_test_prefix")}${summary}` : summary,
        actionTypeId: "question",
        route: questionRoute(pick),
        questionNum: question.num,
    };
}

/** "Noch 12 Tage bis zur Prüfung" when the exam comes after `day`, else null. */
function examCountdownLine(facts: LearnerFacts, t: Translations, day: string): string | null {
    if (!facts.examDate) {
        return null;
    }
    const days = daysBetween(day, facts.examDate);
    return days > 0 ? plural(t, "notif_fact_exam_days", days) : null;
}

function readinessLine(facts: LearnerFacts, t: Translations): string | null {
    return facts.readiness.answered >= READINESS_MIN_ANSWERED
        ? text(t, "notif_fact_readiness", { percent: facts.readiness.score })
        : null;
}

function knownLine(facts: LearnerFacts, t: Translations): string | null {
    const { known, total } = facts.readiness;
    return known >= 1 ? text(t, "notif_fact_known", { known, total }) : null;
}

function mockLine(facts: LearnerFacts, t: Translations): string | null {
    const mock = facts.lastMock;
    return mock ? text(t, "notif_fact_mock", { correct: mock.correct, total: mock.total }) : null;
}

function dueLine(facts: LearnerFacts, t: Translations, day: string): string | null {
    const due = facts.dueOn(day);
    return due >= 1 ? plural(t, "notif_fact_due", due) : null;
}

interface EncouragementText {
    title: string;
    body: string;
}

interface EncouragementTemplate {
    /** Only true for facts that change during the day; such a template fits today only. */
    volatile: boolean;
    render: (facts: LearnerFacts, t: Translations, day: string) => EncouragementText | null;
}

/** In rotation order. A template that returns null does not apply. */
const ENCOURAGEMENT_TEMPLATES: readonly EncouragementTemplate[] = [
    {
        volatile: true,
        render: (facts, t) => {
            const count = facts.streak.current;
            if (count < STREAK_MIN_DAYS) {
                return null;
            }
            return {
                title: text(t, "notif_encourage_streak_title", { count }),
                body: personal(t, "notif_encourage_streak_body", facts.name),
            };
        },
    },
    {
        volatile: true,
        render: (facts, t) => {
            const { answered, remaining } = facts.goal;
            if (answered < 1 || remaining < 1) {
                return null;
            }
            return {
                title: plural(t, "notif_encourage_goal_title", remaining),
                body: personal(t, "notif_encourage_goal_body", facts.name),
            };
        },
    },
    {
        volatile: false,
        render: (facts, t, day) => {
            const title = dueLine(facts, t, day);
            return title ? { title, body: personal(t, "notif_encourage_due_body", facts.name) } : null;
        },
    },
    {
        volatile: false,
        render: (facts, t) => {
            const title = readinessLine(facts, t);
            return title ? { title, body: translate(t, `notif_encourage_status_${facts.readiness.status}`) } : null;
        },
    },
    {
        volatile: false,
        render: (facts, t) => {
            const { known, total } = facts.readiness;
            if (known < 1) {
                return null;
            }
            return {
                title: text(t, "notif_encourage_known_title", { known, total }),
                body: personal(t, "notif_encourage_known_body", facts.name),
            };
        },
    },
    {
        volatile: false,
        render: (facts, t) => {
            const title = mockLine(facts, t);
            if (!title) {
                return null;
            }
            return { title, body: translate(t, facts.lastMock?.passed ? "notif_encourage_mock_passed" : "notif_encourage_mock_failed") };
        },
    },
];

/**
 * Encouragement from the learner's own numbers. Every applicable template is
 * eligible; the day of the year picks one, so consecutive days differ.
 * Streak and today's goal only count for a card that fires today. Without
 * any applicable fact the generic `fallback` texts are used. An exam date
 * after `day` adds the countdown as summary.
 */
export function encouragementCard(
    facts: LearnerFacts,
    t: Translations,
    day: string,
    fallback: FallbackTexts,
): NotificationCard {
    const today = day === facts.today;
    const eligible: EncouragementText[] = [];
    for (const template of ENCOURAGEMENT_TEMPLATES) {
        if (template.volatile && !today) {
            continue;
        }
        const rendered = template.render(facts, t, day);
        if (rendered) {
            eligible.push(rendered);
        }
    }
    const chosen: EncouragementText =
        eligible.length > 0
            ? eligible[dayOfYear(day) % eligible.length]
            : { title: translate(t, fallback.titleKey), body: translate(t, fallback.bodyKey) };
    const card: NotificationCard = {
        title: chosen.title,
        body: chosen.body,
        route: QUESTION_ROUTE,
        actionTypeId: "practice",
    };
    const countdown = examCountdownLine(facts, t, day);
    if (countdown) {
        card.summaryText = countdown;
    }
    return card;
}

/**
 * Streak warning. Today's card (offset 0) names the streak and how many
 * answers still make the day count; tomorrow's card (offset 1) stays
 * generic, because tomorrow's numbers are not known yet.
 */
export function streakCard(facts: LearnerFacts, t: Translations, offset: number): NotificationCard {
    const card: NotificationCard = {
        title: translate(t, "notif_streak_title"),
        body: translate(t, "notif_streak_body"),
        route: QUESTION_ROUTE,
        actionTypeId: "practice",
    };
    if (offset !== 0) {
        return card;
    }
    const { current, best, todayDone } = facts.streak;
    if (current >= STREAK_MIN_DAYS) {
        card.title = text(t, "notif_streak_risk_title", { count: current });
    }
    // Under the "activity" rule the first answer keeps the streak; under "goal" the daily goal does.
    const remaining = prefsOf(facts.user).streakRule === "goal" ? facts.goal.remaining : todayDone ? 0 : 1;
    if (remaining > 0) {
        card.body = plural(t, "notif_streak_risk_body", remaining);
    }
    if (best > current) {
        card.summaryText = text(t, "notif_streak_best_summary", { best });
    }
    return card;
}

/** Sunday summary with the learner's numbers as an inbox list. */
export function weeklyCard(facts: LearnerFacts, t: Translations, sunday: string): NotificationCard {
    const lines = [knownLine(facts, t), readinessLine(facts, t), dueLine(facts, t, sunday), examCountdownLine(facts, t, sunday)].filter(
        (line): line is string => line !== null,
    );
    const card: NotificationCard = {
        title: translate(t, "notif_weekly_title"),
        body: translate(t, "notif_weekly_body"),
        route: PROGRESS_ROUTE,
        actionTypeId: "progress",
    };
    if (lines.length > 0) {
        card.inboxList = lines;
    }
    return card;
}

function withFacts(body: string, lines: (string | null)[]): string | undefined {
    const present = lines.filter((line): line is string => line !== null);
    return present.length > 0 ? `${body}\n\n${present.join("\n")}` : undefined;
}

/** Exam countdown `days` before the exam (0 on exam day). */
export function examCard(facts: LearnerFacts, t: Translations, examDate: string, days: number): NotificationCard {
    const body = translate(t, `notif_exam_${days}_body`);
    const card: NotificationCard = {
        title: translate(t, `notif_exam_${days}_title`),
        body,
        route: days === 0 ? DASHBOARD_ROUTE : MOCK_ROUTE,
        summaryText: text(t, "notif_exam_summary", { date: germanDate(examDate) }),
    };
    const largeBody = withFacts(body, [readinessLine(facts, t), mockLine(facts, t)]);
    if (largeBody) {
        card.largeBody = largeBody;
    }
    if (days > 0) {
        card.actionTypeId = "mock";
    }
    return card;
}

/** Nudge to take a mock exam. */
export function mockCard(facts: LearnerFacts, t: Translations): NotificationCard {
    const body = translate(t, "notif_mock_body");
    const card: NotificationCard = {
        title: translate(t, "notif_mock_title"),
        body,
        route: MOCK_ROUTE,
        actionTypeId: "mock",
    };
    const largeBody = withFacts(body, [knownLine(facts, t), readinessLine(facts, t)]);
    if (largeBody) {
        card.largeBody = largeBody;
    }
    return card;
}
