import { Question } from "@/types/question";
import { ExamType, MockTestProgress, User, UserDailyProgress, UserQuestionProgress } from "@/types/user";
import { dayKey, parseDayKey } from "./date-utils";
// Type only: the question catalogue is not loaded by this module.
import type { AnswerOption } from "./question-bank";
import { scheduleAnswer } from "./review-schedule";
import { answeredCount } from "./streak-logic";

/**
 * Recording practice answers, skips, and flags, and grading mock exams.
 *
 * Every function returns a new record and leaves its inputs untouched; the
 * caller saves the result. Daily statistics stay readable by older app
 * versions: entries are matched by local calendar day, new entries store
 * their date as `Date.toDateString()`, and the counters follow the legacy
 * `createUserStats` rules (utils/user-mapping.ts). Pure: callers pass the time.
 */

export interface AnswerResult {
    user: User;
    correct: boolean;
}

export interface FlagResult {
    user: User;
    /** Flag state of the question after the toggle. */
    flagged: boolean;
}

export interface GradeOptions {
    /** Correct answers needed to pass. */
    passMark: number;
    examType: ExamType;
    /** Whether the 60-minute timer was on. */
    timed: boolean;
    startedAt: Date;
    finishedAt: Date;
    /** The learner stopped early. A cancelled exam never passes. */
    cancelled?: boolean;
}

export interface MockScore {
    correct: number;
    wrong: number;
    /** Skipped questions and questions without a selected answer. */
    unanswered: number;
    total: number;
}

/** Changes to the counters of one day. */
interface DailyDelta {
    attempted?: number;
    correct?: number;
    incorrect?: number;
    skipped?: number;
    flagged?: number;
    /** Answers given. Also starts the `answered` counter on entries written before 2.1. */
    answered?: number;
}

/** A stored counter as a number; 0 for missing or damaged values. */
function counter(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Adds `change` to a stored counter without going below zero, like the legacy statistics. */
function bump(value: unknown, change = 0): number {
    return Math.max(0, counter(value) + change);
}

/**
 * Local day of a stored entry. Older versions stored `Date.toDateString()`
 * ("Fri Oct 09 2026"); some records hold ISO strings. Null when unreadable.
 */
function entryDay(entry: UserDailyProgress | null | undefined): string | null {
    if (!entry || !entry.date) {
        return null;
    }
    const date = new Date(entry.date);
    return Number.isNaN(date.getTime()) ? null : dayKey(date);
}

/** An empty entry for `day`, dated in the format older app versions read. */
function newDailyEntry(day: string): UserDailyProgress {
    return {
        date: parseDayKey(day).toDateString(),
        attempted: 0,
        correct: 0,
        incorrect: 0,
        skipped: 0,
        flagged: 0,
    };
}

/**
 * Applies `delta` to the entry of `day` (the first one when a day was stored
 * twice) or appends a new entry for it. Returns a new array.
 */
function updateDaily(entries: UserDailyProgress[] | undefined, day: string, delta: DailyDelta): UserDailyProgress[] {
    const list = entries ?? [];
    const index = list.findIndex((entry) => entryDay(entry) === day);
    const current = index === -1 ? newDailyEntry(day) : list[index];
    const next: UserDailyProgress = {
        ...current,
        attempted: bump(current.attempted, delta.attempted),
        correct: bump(current.correct, delta.correct),
        incorrect: bump(current.incorrect, delta.incorrect),
        skipped: bump(current.skipped, delta.skipped),
        flagged: bump(current.flagged, delta.flagged),
    };
    if (delta.answered) {
        // Counted from the entry as it was before this change.
        next.answered = answeredCount(current) + delta.answered;
    }
    if (index === -1) {
        return [...list, next];
    }
    const updated = list.slice();
    updated[index] = next;
    return updated;
}

function findProgress(progress: UserQuestionProgress[] | undefined, num: string): UserQuestionProgress | undefined {
    return progress?.find((entry) => entry?.num === num);
}

/**
 * Replaces the entry of `num` (the first one, which is the one every reader
 * uses) or appends a new one. Returns a new array.
 */
function upsertProgress(
    progress: UserQuestionProgress[] | undefined,
    num: string,
    build: (previous: UserQuestionProgress | undefined) => UserQuestionProgress,
): UserQuestionProgress[] {
    const list = progress ?? [];
    const index = list.findIndex((entry) => entry?.num === num);
    if (index === -1) {
        return [...list, build(undefined)];
    }
    const updated = list.slice();
    updated[index] = build(list[index]);
    return updated;
}

/** Progress entry after an answer. The practice flag survives the answer. */
function answeredEntry(
    previous: UserQuestionProgress | undefined,
    num: string,
    selected: string,
    correct: boolean,
): UserQuestionProgress {
    return {
        ...previous,
        num,
        answeredCorrectly: correct,
        answerSelected: selected,
        skipped: false,
        flagged: previous?.flagged ?? false,
    };
}

/**
 * Records a practice answer.
 *
 * `attempted` and `answered` count every answer. `correct` and `incorrect`
 * keep the legacy meaning: answering a known question correctly again adds
 * nothing, and a wrong answer to a known question moves one count from
 * `correct` to `incorrect`.
 */
export function recordAnswer(user: User, question: Question, option: AnswerOption, now: Date): AnswerResult {
    const today = dayKey(now);
    const num = question.num;
    const correct = option === question.solution;
    const wasCorrect = findProgress(user.questionProgress, num)?.answeredCorrectly === true;

    let correctDelta = 0;
    let incorrectDelta = 0;
    if (correct) {
        correctDelta = wasCorrect ? 0 : 1;
    } else {
        correctDelta = wasCorrect ? -1 : 0;
        incorrectDelta = 1;
    }

    return {
        user: {
            ...user,
            questionProgress: upsertProgress(user.questionProgress, num, (previous) =>
                answeredEntry(previous, num, option, correct),
            ),
            dailyProgress: updateDaily(user.dailyProgress, today, {
                attempted: 1,
                correct: correctDelta,
                incorrect: incorrectDelta,
                answered: 1,
            }),
            reviewSchedule: scheduleAnswer(user.reviewSchedule, num, correct, today),
        },
        correct,
    };
}

/** Records a skipped question. An earlier answer and flag are kept; the review schedule does not change. */
export function recordSkip(user: User, question: Question, now: Date): User {
    const num = question.num;
    return {
        ...user,
        questionProgress: upsertProgress(user.questionProgress, num, (previous) =>
            previous
                ? { ...previous, skipped: true }
                : { num, skipped: true, answerSelected: null, flagged: false, answeredCorrectly: null },
        ),
        dailyProgress: updateDaily(user.dailyProgress, dayKey(now), { attempted: 1, skipped: 1 }),
    };
}

/** Flags or unflags a question. Only the daily `flagged` counter changes; a flag is not an attempt. */
export function toggleFlag(user: User, question: Question, now: Date): FlagResult {
    const num = question.num;
    const flagged = !(findProgress(user.questionProgress, num)?.flagged ?? false);
    return {
        user: {
            ...user,
            questionProgress: upsertProgress(user.questionProgress, num, (previous) =>
                previous
                    ? { ...previous, flagged }
                    : { num, skipped: false, answerSelected: null, flagged: true, answeredCorrectly: null },
            ),
            dailyProgress: updateDaily(user.dailyProgress, dayKey(now), { flagged: flagged ? 1 : -1 }),
        },
        flagged,
    };
}

/**
 * Grades a mock exam. `answers` maps question numbers to the selected option;
 * `flagged` lists the question numbers flagged during the exam. Unanswered
 * questions are stored as skipped with an empty answer, as older versions did.
 */
export function gradeMock(
    questions: Question[],
    answers: Record<string, AnswerOption | null | undefined>,
    flagged: string[],
    options: GradeOptions,
): MockTestProgress {
    const flaggedNums = new Set(flagged);
    const graded = questions.map((question): UserQuestionProgress => {
        const selected = answers[question.num];
        const isFlagged = flaggedNums.has(question.num);
        if (!selected) {
            return { num: question.num, answeredCorrectly: false, answerSelected: "", skipped: true, flagged: isFlagged };
        }
        return {
            num: question.num,
            answeredCorrectly: selected === question.solution,
            answerSelected: selected,
            skipped: false,
            flagged: isFlagged,
        };
    });

    const cancelled = options.cancelled ?? false;
    const correct = graded.filter((entry) => entry.answeredCorrectly === true).length;
    const elapsed = options.finishedAt.getTime() - options.startedAt.getTime();
    const seconds = Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / 1000)) : 0;

    return {
        datetime: options.startedAt.toISOString(),
        timeTake: String(seconds),
        passed: !cancelled && correct >= options.passMark,
        cancelled,
        questions: graded,
        passMark: options.passMark,
        examType: options.examType,
        timed: options.timed,
    };
}

/** Result counts of a stored mock exam, including exams stored by older versions. */
export function mockScore(test: MockTestProgress): MockScore {
    const questions = test.questions ?? [];
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    for (const entry of questions) {
        if (!entry || entry.skipped || !entry.answerSelected) {
            unanswered += 1;
        } else if (entry.answeredCorrectly === true) {
            correct += 1;
        } else {
            wrong += 1;
        }
    }
    return { correct, wrong, unanswered, total: questions.length };
}

/**
 * Saves a graded mock exam: adds it to the history, counts it in today's
 * statistics, and feeds every answered question into the practice progress
 * and the review schedule. Flags set during the exam stay with the exam.
 */
export function applyMockToUser(user: User, test: MockTestProgress, now: Date): User {
    const today = dayKey(now);
    const questions = test.questions ?? [];
    let questionProgress = user.questionProgress ?? [];
    let reviewSchedule = user.reviewSchedule;
    let answers = 0;
    let correctAnswers = 0;

    for (const entry of questions) {
        const selected = entry?.answerSelected;
        if (!selected) {
            continue;
        }
        const correct = entry.answeredCorrectly === true;
        answers += 1;
        correctAnswers += correct ? 1 : 0;
        questionProgress = upsertProgress(questionProgress, entry.num, (previous) =>
            answeredEntry(previous, entry.num, selected, correct),
        );
        reviewSchedule = scheduleAnswer(reviewSchedule, entry.num, correct, today);
    }

    const next: User = {
        ...user,
        testProgress: [...(user.testProgress ?? []), test],
        questionProgress,
        dailyProgress: updateDaily(user.dailyProgress, today, {
            attempted: questions.length,
            correct: correctAnswers,
            incorrect: answers - correctAnswers,
            answered: answers,
        }),
    };
    if (reviewSchedule !== user.reviewSchedule) {
        next.reviewSchedule = reviewSchedule;
    }
    return next;
}
