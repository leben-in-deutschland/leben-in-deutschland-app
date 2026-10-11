import type { AnswerState } from "@/components/question/answer-option";
import { categories, type Question } from "@/types/question";
import type { ExamType, MockTestProgress, User } from "@/types/user";
import { mockScore } from "@/utils/practice-logic";
import {
    ANSWER_OPTIONS,
    EXAM_DURATION_SECONDS,
    EXAM_GENERAL_COUNT,
    EXAM_STATE_COUNT,
    getQuestion,
    getRelevantQuestions,
    getStateQuestions,
    isStateQuestion,
    normalizeCategory,
    type AnswerOption,
    type Category,
} from "@/utils/question-bank";
import { PASS_MARKS, passMarkOf } from "@/utils/user-defaults";

/*
 * Pure helpers for the mock exam screens. Nothing here touches React, the
 * clock, or storage, so every function is unit tested in
 * __tests__/mock-exam-logic.test.ts.
 */

export type ExamAnswers = Record<string, AnswerOption | undefined>;

/** Fisher–Yates shuffle into a new array. `random` returns a number in [0, 1). */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

/**
 * Picks the exam set from two pools: `generalCount` random general questions
 * followed by `stateCount` random state questions, like the real exam. Pools
 * smaller than the requested count give a shorter exam instead of duplicates.
 */
export function pickExamQuestions(
    general: readonly Question[],
    state: readonly Question[],
    random: () => number = Math.random,
    generalCount = EXAM_GENERAL_COUNT,
    stateCount = EXAM_STATE_COUNT,
): Question[] {
    const seen = new Set<string>();
    const unique = (questions: readonly Question[]) =>
        questions.filter((question) => {
            if (!question || seen.has(question.num)) {
                return false;
            }
            seen.add(question.num);
            return true;
        });
    const generalPick = shuffle(unique(general), random).slice(0, generalCount);
    const statePick = shuffle(unique(state), random).slice(0, stateCount);
    return [...generalPick, ...statePick];
}

/** The question set for a new exam: 30 general questions plus 3 of the learner's state. */
export function buildExamQuestions(stateCode: string, random: () => number = Math.random): Question[] {
    const general = getRelevantQuestions(stateCode).filter((question) => !isStateQuestion(question.num, stateCode));
    return pickExamQuestions(general, getStateQuestions(stateCode), random);
}

/* ------------------------------------------------------------------ */
/*  Timer                                                              */
/* ------------------------------------------------------------------ */

export type TimerTone = "default" | "warning" | "danger";

/** Whole seconds since the exam started, never negative. */
export function elapsedSeconds(startedAt: Date | number, now: number): number {
    const start = typeof startedAt === "number" ? startedAt : startedAt.getTime();
    const elapsed = Math.floor((now - start) / 1000);
    return Number.isFinite(elapsed) && elapsed > 0 ? elapsed : 0;
}

/** Seconds left on the exam clock, clamped at 0. */
export function remainingSeconds(startedAt: Date | number, now: number, duration = EXAM_DURATION_SECONDS): number {
    return Math.max(0, duration - elapsedSeconds(startedAt, now));
}

/** Calm until 5 minutes are left, warning under 5 minutes, danger under 1 minute. */
export function timerTone(remaining: number): TimerTone {
    if (remaining < 60) {
        return "danger";
    }
    if (remaining < 5 * 60) {
        return "warning";
    }
    return "default";
}

/* ------------------------------------------------------------------ */
/*  Running exam                                                       */
/* ------------------------------------------------------------------ */

export interface OpenItems {
    answered: number;
    unanswered: number;
    flagged: number;
    /** Index of the first question without an answer, or -1. */
    firstUnanswered: number;
    /** Index of the first flagged question, or -1. */
    firstFlagged: number;
}

/** What is still open before the learner submits. */
export function openItems(questions: readonly Question[], answers: ExamAnswers, flagged: ReadonlySet<string>): OpenItems {
    let answered = 0;
    let flaggedCount = 0;
    let firstUnanswered = -1;
    let firstFlagged = -1;
    questions.forEach((question, index) => {
        if (answers[question.num]) {
            answered += 1;
        } else if (firstUnanswered === -1) {
            firstUnanswered = index;
        }
        if (flagged.has(question.num)) {
            flaggedCount += 1;
            if (firstFlagged === -1) {
                firstFlagged = index;
            }
        }
    });
    return {
        answered,
        unanswered: questions.length - answered,
        flagged: flaggedCount,
        firstUnanswered,
        firstFlagged,
    };
}

/* ------------------------------------------------------------------ */
/*  Stored exams                                                       */
/* ------------------------------------------------------------------ */

/** Exam type a stored exam was taken as. Older records only know the pass mark (17). */
export function examTypeOf(test: MockTestProgress): ExamType {
    if (test.examType === "lid" || test.examType === "einbuergerung") {
        return test.examType;
    }
    return passMarkOf(test) === PASS_MARKS.lid ? "lid" : "einbuergerung";
}

/** Seconds a stored exam took. Older records store a string, sometimes empty. */
export function durationOf(test: MockTestProgress): number {
    const seconds = Number(test.timeTake);
    return Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
}

/** Older records have no `timed` flag and were always timed. */
export function wasTimed(test: MockTestProgress): boolean {
    return test.timed !== false;
}

function timeOf(datetime: string): number {
    const time = new Date(datetime).getTime();
    return Number.isNaN(time) ? 0 : time;
}

/** Finished (not cancelled) exams, newest first. */
export function recentExams(user: Pick<User, "testProgress"> | null | undefined, limit = 5): MockTestProgress[] {
    return (user?.testProgress ?? [])
        .filter((test) => test && !test.cancelled)
        .sort((a, b) => timeOf(b.datetime) - timeOf(a.datetime))
        .slice(0, limit);
}

/** Passed and finished exam counts; cancelled exams are not counted. */
export function examHistorySummary(user: Pick<User, "testProgress"> | null | undefined): { passed: number; total: number } {
    const finished = (user?.testProgress ?? []).filter((test) => test && !test.cancelled);
    return { passed: finished.filter((test) => test.passed).length, total: finished.length };
}

/**
 * Finds a stored exam by its `datetime`. The key may arrive raw or
 * URL-encoded, so both spellings are tried.
 */
export function findExam(user: Pick<User, "testProgress"> | null | undefined, key: string | null | undefined): MockTestProgress | undefined {
    if (!key) {
        return undefined;
    }
    const tests = user?.testProgress ?? [];
    const direct = tests.find((test) => test?.datetime === key);
    if (direct) {
        return direct;
    }
    try {
        const decoded = decodeURIComponent(key);
        return decoded === key ? undefined : tests.find((test) => test?.datetime === decoded);
    } catch {
        return undefined;
    }
}

/* ------------------------------------------------------------------ */
/*  Results and review                                                 */
/* ------------------------------------------------------------------ */

export interface ReviewEntry {
    num: string;
    /** Catalogue question; undefined when it no longer exists. */
    question: Question | undefined;
    /** The learner's answer, or null when the question was left open. */
    selected: AnswerOption | null;
    answered: boolean;
    correct: boolean;
    flagged: boolean;
    category: Category;
}

function asOption(value: string | null | undefined): AnswerOption | null {
    return (ANSWER_OPTIONS as readonly string[]).includes(value ?? "") ? (value as AnswerOption) : null;
}

/**
 * Joins a stored exam with the catalogue. Unanswered questions follow the
 * `mockScore` rules: skipped, or without a selected answer (older versions
 * stored an empty string).
 */
export function buildReviewEntries(test: MockTestProgress, lookup: (num: string) => Question | undefined = getQuestion): ReviewEntry[] {
    return (test.questions ?? [])
        .filter((entry) => entry && typeof entry.num === "string")
        .map((entry) => {
            const question = lookup(entry.num);
            const selected = entry.skipped ? null : asOption(entry.answerSelected);
            const answered = selected !== null;
            return {
                num: entry.num,
                question,
                selected,
                answered,
                correct: answered && entry.answeredCorrectly === true,
                flagged: entry.flagged === true,
                category: normalizeCategory(question?.category),
            };
        });
}

export type ReviewFilter = "all" | "wrong" | "unanswered" | "flagged";
export const REVIEW_FILTERS: readonly ReviewFilter[] = ["all", "wrong", "unanswered", "flagged"];

function matchesFilter(entry: ReviewEntry, filter: ReviewFilter): boolean {
    switch (filter) {
        case "wrong":
            return entry.answered && !entry.correct;
        case "unanswered":
            return !entry.answered;
        case "flagged":
            return entry.flagged;
        default:
            return true;
    }
}

export function filterReviewEntries(entries: readonly ReviewEntry[], filter: ReviewFilter): ReviewEntry[] {
    return entries.filter((entry) => matchesFilter(entry, filter));
}

export function reviewCounts(entries: readonly ReviewEntry[]): Record<ReviewFilter, number> {
    return {
        all: entries.length,
        wrong: filterReviewEntries(entries, "wrong").length,
        unanswered: filterReviewEntries(entries, "unanswered").length,
        flagged: filterReviewEntries(entries, "flagged").length,
    };
}

export interface TopicStat {
    category: Category;
    correct: number;
    total: number;
}

/** Correct answers per topic, in the catalogue's topic order; topics without questions are left out. */
export function topicBreakdown(entries: readonly ReviewEntry[]): TopicStat[] {
    const stats = new Map<Category, TopicStat>();
    for (const entry of entries) {
        const stat = stats.get(entry.category) ?? { category: entry.category, correct: 0, total: 0 };
        stat.total += 1;
        stat.correct += entry.correct ? 1 : 0;
        stats.set(entry.category, stat);
    }
    return (categories as readonly Category[]).filter((category) => stats.has(category)).map((category) => stats.get(category)!);
}

/** How each answer of a reviewed question is shown: the choice graded, the solution revealed, the rest dimmed. */
export function answerStates(entry: ReviewEntry): Record<AnswerOption, AnswerState> {
    const solution = asOption(entry.question?.solution);
    const states = {} as Record<AnswerOption, AnswerState>;
    for (const option of ANSWER_OPTIONS) {
        if (entry.selected === option) {
            states[option] = option === solution ? "correct" : "wrong";
        } else if (option === solution) {
            states[option] = "reveal";
        } else {
            states[option] = "dimmed";
        }
    }
    return states;
}

export type ResultStatus = "passed" | "failed" | "cancelled";

export function resultStatus(test: MockTestProgress): ResultStatus {
    if (test.cancelled) {
        return "cancelled";
    }
    return test.passed ? "passed" : "failed";
}

/** Score as a share of all questions, for rings and bars. */
export function scoreRatio(test: MockTestProgress): number {
    const score = mockScore(test);
    return score.total > 0 ? score.correct / score.total : 0;
}
