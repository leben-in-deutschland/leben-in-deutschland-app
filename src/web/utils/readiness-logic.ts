import { MockTestProgress, User, UserQuestionProgress } from "@/types/user";
import { EXAM_QUESTION_COUNT, getRelevantQuestions } from "./question-bank";
import { passMarkFor, prefsOf } from "./user-defaults";

/**
 * Exam readiness: one score that says how close the learner is to passing.
 *
 * The score blends catalogue mastery (questions whose latest answer was
 * correct) with the results of the most recent mock exams. The pass chance
 * models a 33-question exam in which every question is answered correctly
 * with the same probability. Pure: no clock, no storage.
 */

export type ReadinessStatus = "start" | "building" | "close" | "ready";

export interface Readiness {
    /** Whole number from 0 to 100. */
    score: number;
    /** Share (0..1) of the learner's catalogue whose latest answer was correct. */
    mastery: number;
    /** Share (0..1) of the learner's catalogue answered correctly or wrongly at least once. */
    coverage: number;
    /** Catalogue questions whose latest answer was correct. */
    known: number;
    /** Catalogue questions with a correct or wrong answer on record. */
    answered: number;
    /** Questions in the learner's catalogue (general questions plus their state's). */
    total: number;
    /** Mean share (0..1) of correct answers in the recent mock exams; null without any. */
    mockAverage: number | null;
    /** Mock exams that count: the last three that were not cancelled. */
    recentMocks: number;
    /** How many of the recent mock exams were passed. */
    recentPasses: number;
    /** Estimated chance (0..1) of reaching the pass mark in a real exam. */
    passChance: number;
    status: ReadinessStatus;
}

/** Only the most recent mock exams describe the current level. */
const RECENT_MOCK_COUNT = 3;
/** Without a mock exam, mastery alone reaches a score of at most 85. */
const MASTERY_ONLY_FACTOR = 0.85;
const MASTERY_WEIGHT = 0.7;
const MOCK_WEIGHT = 0.3;
/** Chance of guessing an unknown question right: one of four options. */
const GUESS_PROBABILITY = 0.25;
const BUILDING_FROM = 40;
const CLOSE_FROM = 70;
const READY_FROM = 85;
/** Passed mock exams among the recent ones that "ready" requires. */
const READY_MIN_PASSES = 2;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/** log C(n, k), summed term by term so that large coefficients never overflow. */
function logChoose(n: number, k: number): number {
    const r = Math.min(k, n - k);
    let result = 0;
    for (let j = 1; j <= r; j++) {
        result += Math.log((n - r + j) / j);
    }
    return result;
}

/**
 * log P(X >= k) for X ~ Binomial(n, p), given log p and log(1 - p), 1 <= k <= n.
 *
 * Each term follows from the previous one by the ratio
 * (n - i) / (i + 1) * p / (1 - p), and the tail is summed relative to its
 * largest term, so neither huge coefficients nor tiny powers of p overflow or
 * underflow.
 */
function logUpperTail(n: number, k: number, logP: number, logQ: number): number {
    const logOdds = logP - logQ;
    let logTerm = logChoose(n, k) + k * logP + (n - k) * logQ;
    let maxLog = logTerm;
    // Sum of exp(term - maxLog) over the terms seen so far.
    let scaledSum = 1;
    for (let i = k; i < n; i++) {
        logTerm += Math.log((n - i) / (i + 1)) + logOdds;
        if (logTerm > maxLog) {
            scaledSum = scaledSum * Math.exp(maxLog - logTerm) + 1;
            maxLog = logTerm;
        } else {
            scaledSum += Math.exp(logTerm - maxLog);
        }
    }
    return maxLog + Math.log(scaledSum);
}

/**
 * P(X >= k) for X ~ Binomial(n, p), computed in log space.
 *
 * n is rounded down and k up to whole numbers; p outside 0..1 counts as 0
 * or 1.
 */
export function binomialAtLeast(n: number, p: number, k: number): number {
    const trials = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    const needed = Math.ceil(k);
    if (needed <= 0) {
        return 1;
    }
    if (!(needed <= trials)) {
        // More successes than trials (or k is NaN).
        return 0;
    }
    if (!(p > 0)) {
        // Never a success (p <= 0 or NaN).
        return 0;
    }
    if (p >= 1) {
        return 1;
    }

    const logP = Math.log(p);
    const logQ = Math.log1p(-p);
    // Sum the smaller tail so that results near 0 and near 1 both keep full
    // precision. Above the mean that is the upper tail itself; otherwise it is
    // 1 minus the lower tail, where "k - 1 successes or fewer" equals
    // "n - k + 1 failures or more".
    if (needed > trials * p) {
        return clamp(Math.exp(logUpperTail(trials, needed, logP, logQ)), 0, 1);
    }
    return clamp(1 - Math.exp(logUpperTail(trials, trials - needed + 1, logQ, logP)), 0, 1);
}

/** Share of the 33 exam questions a mock exam got right (0..1). */
function mockShare(test: MockTestProgress): number {
    const questions = Array.isArray(test.questions) ? test.questions : [];
    const correct = questions.filter((question) => question?.answeredCorrectly === true).length;
    return Math.min(1, correct / EXAM_QUESTION_COUNT);
}

function readinessStatus(score: number, recentPasses: number): ReadinessStatus {
    if (score < BUILDING_FROM) {
        return "start";
    }
    if (score < CLOSE_FROM) {
        return "building";
    }
    if (score >= READY_FROM && recentPasses >= READY_MIN_PASSES) {
        return "ready";
    }
    return "close";
}

/**
 * Readiness of the learner for their exam. `passMark` defaults to the pass
 * mark of the learner's exam type (17 for the Einbürgerungstest, 15 for
 * "Leben in Deutschland").
 */
export function computeReadiness(user: User, passMark?: number): Readiness {
    const mark = passMark ?? passMarkFor(prefsOf(user).examType);
    const catalogue = getRelevantQuestions(user.state?.stateCode ?? "");
    const total = catalogue.length;
    const relevant = new Set(catalogue.map((question) => question.num));

    // Every writer updates the first entry of a question (findIndex), so if an
    // older record holds duplicates, the first one carries the latest answer.
    const latest = new Map<string, UserQuestionProgress>();
    for (const progress of user.questionProgress ?? []) {
        if (progress && relevant.has(progress.num) && !latest.has(progress.num)) {
            latest.set(progress.num, progress);
        }
    }

    let known = 0;
    let answered = 0;
    for (const progress of latest.values()) {
        if (progress.answeredCorrectly === true) {
            known += 1;
        }
        if (typeof progress.answeredCorrectly === "boolean") {
            answered += 1;
        }
    }
    const mastery = total > 0 ? known / total : 0;
    const coverage = total > 0 ? answered / total : 0;

    // testProgress is chronological. Cancelled exams say nothing about the level.
    const recent = (user.testProgress ?? [])
        .filter((test) => Boolean(test) && test.cancelled !== true)
        .slice(-RECENT_MOCK_COUNT);
    const mockAverage =
        recent.length > 0 ? recent.reduce((sum, test) => sum + mockShare(test), 0) / recent.length : null;
    const recentPasses = recent.filter((test) => test.passed === true).length;

    const rawScore =
        mockAverage === null
            ? Math.round(100 * mastery * MASTERY_ONLY_FACTOR)
            : Math.round(100 * (MASTERY_WEIGHT * mastery + MOCK_WEIGHT * mockAverage));
    const score = clamp(rawScore, 0, 100);

    // Questions the learner does not know yet are still guessed right sometimes.
    const catalogueChance = mastery + (1 - mastery) * GUESS_PROBABILITY;
    const questionChance = mockAverage === null ? catalogueChance : 0.5 * catalogueChance + 0.5 * mockAverage;
    const passChance = binomialAtLeast(EXAM_QUESTION_COUNT, questionChance, mark);

    return {
        score,
        mastery,
        coverage,
        known,
        answered,
        total,
        mockAverage,
        recentMocks: recent.length,
        recentPasses,
        passChance,
        status: readinessStatus(score, recentPasses),
    };
}
