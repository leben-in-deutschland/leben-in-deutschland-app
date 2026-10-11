import type { Question } from "@/types/question";
import type { MockTestProgress, UnlockedAchievement, User, UserQuestionProgress } from "@/types/user";
import { ACHIEVEMENTS, buildAchievementContext, type AchievementDef } from "@/utils/achievements";
import { parseDayKey, weekdayOf } from "@/utils/date-utils";
import { mockScore, type MockScore } from "@/utils/practice-logic";
import { getCategoryCounts, getRelevantQuestions, getStateQuestions, normalizeCategory, type Category } from "@/utils/question-bank";
import { getReviewItem, masteryLevel, type MasteryLevel } from "@/utils/review-schedule";
import { FREEZE_EARN_INTERVAL, type CalendarDay } from "@/utils/streak-logic";
import { passMarkOf } from "@/utils/user-defaults";

/**
 * Aggregations for the progress page. Pure functions over the learner
 * record; the page memoizes them on the record so they update live.
 *
 * Records written by version 2.0 may hold `answeredCorrectly: null`,
 * `answerSelected: null` or "", duplicate entries for one question, and mock
 * exams without a pass mark. Every helper here reads them the way the tested
 * logic modules do: the first entry of a question is the current one, a
 * boolean `answeredCorrectly` means "answered", and `passMarkOf` supplies the
 * pass mark of older exams.
 */

export type AnswerState = "correct" | "wrong" | "skipped" | "unanswered";

export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100] as const;

/** Mock exams shown in the trend chart. */
export const MOCK_TREND_LIMIT = 10;

/** Latest progress entry per question. Every writer updates the first match, so the first entry wins. */
export function latestProgress(user: User): Map<string, UserQuestionProgress> {
    const latest = new Map<string, UserQuestionProgress>();
    for (const entry of user.questionProgress ?? []) {
        if (entry && typeof entry.num === "string" && !latest.has(entry.num)) {
            latest.set(entry.num, entry);
        }
    }
    return latest;
}

/**
 * State of a question from its latest entry. Without an answer on record a
 * question counts as skipped when it was skipped or opened without answering;
 * a question that was only flagged stays unanswered (rule of version 2.0).
 */
export function answerState(entry: UserQuestionProgress | undefined): AnswerState {
    if (!entry) {
        return "unanswered";
    }
    if (entry.answeredCorrectly === true) {
        return "correct";
    }
    if (entry.answeredCorrectly === false) {
        return "wrong";
    }
    return entry.skipped || !entry.flagged ? "skipped" : "unanswered";
}

export interface TopicMastery {
    category: Category;
    total: number;
    /** Latest answer correct. */
    known: number;
    /** Latest answer wrong. */
    wrong: number;
    answered: number;
}

/** Known and wrong questions per topic of the learner's catalogue, in catalogue topic order. */
export function topicMastery(user: User): TopicMastery[] {
    const stateCode = user.state?.stateCode ?? "";
    const latest = latestProgress(user);
    const byTopic = new Map<Category, TopicMastery>();
    for (const { category, total } of getCategoryCounts(stateCode)) {
        byTopic.set(category, { category, total, known: 0, wrong: 0, answered: 0 });
    }
    for (const question of getRelevantQuestions(stateCode)) {
        const topic = byTopic.get(normalizeCategory(question.category));
        if (!topic) {
            continue;
        }
        const state = answerState(latest.get(question.num));
        if (state === "correct") {
            topic.known += 1;
            topic.answered += 1;
        } else if (state === "wrong") {
            topic.wrong += 1;
            topic.answered += 1;
        }
    }
    return Array.from(byTopic.values());
}

export interface AnswerBreakdown {
    correct: number;
    wrong: number;
    skipped: number;
    unanswered: number;
    /** Flagged questions; they may also be correct, wrong, or skipped. */
    flagged: number;
    total: number;
}

/** Answers over the learner's catalogue. correct + wrong + skipped + unanswered = total. */
export function answerBreakdown(user: User): AnswerBreakdown {
    const latest = latestProgress(user);
    const breakdown: AnswerBreakdown = { correct: 0, wrong: 0, skipped: 0, unanswered: 0, flagged: 0, total: 0 };
    for (const question of getRelevantQuestions(user.state?.stateCode ?? "")) {
        const entry = latest.get(question.num);
        breakdown[answerState(entry)] += 1;
        breakdown.total += 1;
        if (entry?.flagged) {
            breakdown.flagged += 1;
        }
    }
    return breakdown;
}

export type MasteryDistribution = Record<MasteryLevel, number> & { total: number };

/** Catalogue questions per review level (new, learning, known, mastered). */
export function masteryDistribution(user: User): MasteryDistribution {
    const distribution: MasteryDistribution = { new: 0, learning: 0, known: 0, mastered: 0, total: 0 };
    const schedule = user.reviewSchedule ?? [];
    for (const question of getRelevantQuestions(user.state?.stateCode ?? "")) {
        distribution[masteryLevel(getReviewItem(schedule, question.num))] += 1;
        distribution.total += 1;
    }
    return distribution;
}

export type MockStatus = "passed" | "failed" | "cancelled";

export interface MockEntry {
    test: MockTestProgress;
    score: MockScore;
    passMark: number;
    status: MockStatus;
    /** Time taken in whole seconds; 0 when the record has none. */
    seconds: number;
}

function mockSeconds(test: MockTestProgress): number {
    const seconds = Number(test.timeTake);
    return Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
}

function mockEntry(test: MockTestProgress): MockEntry {
    const score = mockScore(test);
    const passMark = passMarkOf(test);
    let status: MockStatus;
    if (test.cancelled === true) {
        status = "cancelled";
    } else if (typeof test.passed === "boolean") {
        status = test.passed ? "passed" : "failed";
    } else {
        status = score.correct >= passMark ? "passed" : "failed";
    }
    return { test, score, passMark, status, seconds: mockSeconds(test) };
}

/** Every stored mock exam, newest first (the record is chronological). */
export function mockHistory(user: User): MockEntry[] {
    return (user.testProgress ?? [])
        .filter((test) => Boolean(test) && Array.isArray(test.questions))
        .map(mockEntry)
        .reverse();
}

export interface MockTrendPoint {
    datetime: string;
    correct: number;
    total: number;
    passMark: number;
    passed: boolean;
}

export interface MockTrend {
    /** The last `limit` exams that were not cancelled, oldest first. */
    points: MockTrendPoint[];
    /** Exams that were not cancelled. */
    finished: number;
    passed: number;
    /** Most correct answers in one exam. */
    best: number;
    /** Mean correct answers, or null without a finished exam. */
    average: number | null;
}

/** Score trend of the recent mock exams plus a summary over all finished ones. */
export function mockTrend(user: User, limit: number = MOCK_TREND_LIMIT): MockTrend {
    const finished = mockHistory(user)
        .filter((entry) => entry.status !== "cancelled")
        .reverse();
    const passed = finished.filter((entry) => entry.status === "passed").length;
    const best = finished.reduce((max, entry) => Math.max(max, entry.score.correct), 0);
    const average = finished.length > 0 ? finished.reduce((sum, entry) => sum + entry.score.correct, 0) / finished.length : null;
    const points = finished.slice(-Math.max(0, limit)).map((entry) => ({
        datetime: entry.test.datetime,
        correct: entry.score.correct,
        total: entry.score.total,
        passMark: entry.passMark,
        passed: entry.status === "passed",
    }));
    return { points, finished: finished.length, passed, best, average };
}

export interface StateQuestionStatus {
    question: Question;
    state: AnswerState;
}

export interface StateMastery {
    questions: StateQuestionStatus[];
    known: number;
    total: number;
}

/** The questions of the learner's state with their answer state. */
export function stateMastery(user: User): StateMastery {
    const latest = latestProgress(user);
    const questions = getStateQuestions(user.state?.stateCode ?? "").map((question) => ({
        question,
        state: answerState(latest.get(question.num)),
    }));
    return {
        questions,
        known: questions.filter((item) => item.state === "correct").length,
        total: questions.length,
    };
}

export interface AchievementStatus {
    def: AchievementDef;
    unlocked: UnlockedAchievement | undefined;
    /** Progress clamped to the target. */
    progress: number;
    /** progress / target, 0..1. */
    ratio: number;
}

export interface AchievementOverview {
    items: AchievementStatus[];
    unlocked: number;
    total: number;
}

/** Every achievement with its unlock record or its progress. */
export function achievementOverview(user: User, today: string): AchievementOverview {
    const ctx = buildAchievementContext(user, today);
    const unlockedById = new Map<string, UnlockedAchievement>();
    for (const item of user.achievements ?? []) {
        if (item && typeof item.id === "string" && !unlockedById.has(item.id)) {
            unlockedById.set(item.id, item);
        }
    }
    const items = ACHIEVEMENTS.map((def) => {
        const unlocked = unlockedById.get(def.id);
        const raw = def.progress(ctx);
        const progress = unlocked ? def.target : Math.min(def.target, Number.isFinite(raw) ? Math.max(0, raw) : 0);
        return { def, unlocked, progress, ratio: def.target > 0 ? progress / def.target : 0 };
    });
    return { items, unlocked: items.filter((item) => item.unlocked).length, total: items.length };
}

/**
 * Arranges calendar days (oldest first) into week columns from Monday to
 * Sunday. Cells before the first day and after the last one are null.
 */
export function calendarWeeks(days: CalendarDay[]): (CalendarDay | null)[][] {
    if (days.length === 0) {
        return [];
    }
    const columns: (CalendarDay | null)[][] = [];
    // 0 = Monday ... 6 = Sunday
    let column: (CalendarDay | null)[] = new Array<CalendarDay | null>((weekdayOf(days[0].day) + 6) % 7).fill(null);
    for (const day of days) {
        column.push(day);
        if (column.length === 7) {
            columns.push(column);
            column = [];
        }
    }
    if (column.length > 0) {
        while (column.length < 7) {
            column.push(null);
        }
        columns.push(column);
    }
    return columns;
}

/**
 * One label per week column: the short month name where a new month begins,
 * otherwise "".
 */
export function monthLabels(weeks: (CalendarDay | null)[][], locale: string): string[] {
    const labels: string[] = [];
    let previous = "";
    for (const week of weeks) {
        const first = week.find((cell) => cell !== null);
        const month = first ? first.day.slice(0, 7) : previous;
        labels.push(first && month !== previous ? monthName(first.day, locale) : "");
        previous = month;
    }
    return labels;
}

/** Days of practice still needed until the next streak freeze is earned (1 to 7). */
export function daysToNextFreeze(currentStreak: number): number {
    const current = Number.isFinite(currentStreak) && currentStreak > 0 ? Math.floor(currentStreak) : 0;
    return FREEZE_EARN_INTERVAL - (current % FREEZE_EARN_INTERVAL);
}

/** Localized weekday name; `weekday` uses 0 = Sunday ... 6 = Saturday like the preferences. */
export function weekdayName(weekday: number, locale: string, format: "long" | "short" = "long"): string {
    // 1 January 2023 was a Sunday.
    return new Intl.DateTimeFormat(locale, { weekday: format }).format(new Date(2023, 0, 1 + weekday));
}

/** Short localized month name of a day key, e.g. "Oct" or "Okt.". */
export function monthName(day: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, { month: "short" }).format(parseDayKey(day));
}

/** Day and month of a day key, e.g. "09.10." or "09/10", for calendar cell titles. */
export function shortDate(day: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(parseDayKey(day));
}
