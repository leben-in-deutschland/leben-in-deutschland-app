import { questionsData, statesData } from "@/data/data";
import type { Question } from "@/types/question";
import { withBundledPictures } from "@/utils/question-pictures";
import { createRemoteStore } from "@/utils/remote-cache";

/**
 * Downloaded question catalogue (ADR-006). The sync workflow commits the
 * split core file (`questions-core.json`) to the public app repository; on
 * Android the app downloads that same file at most once a day and, when it
 * passes the strict check below, uses it instead of the bundled copy from the
 * next catalogue load on. Stored under its own key, stamped with the app
 * version so a newer build's bundle is never shadowed by an older download.
 * The learner record is never written; progress stays keyed by `num`.
 */

export const QUESTIONS_KEY = "lid:questions";

/** Catalogue numbers: "1".."300" for general questions, "BE-3" for state questions. */
const NUM = /^(\d{1,3}|[A-Z]{2}-\d{1,2})$/;
const SOLUTIONS = new Set(["a", "b", "c", "d"]);

/** Bounds that a real catalogue always satisfies; anything outside is a broken scrape. */
export const MIN_GENERAL_QUESTIONS = 300;
export const MAX_QUESTIONS = 1000;
/** Each state must keep at least as many questions as a mock exam draws. */
export const MIN_STATE_QUESTIONS = 3;

const FIELDS = ["num", "id", "question", "a", "b", "c", "d", "solution", "image", "category"] as const;

function isQuestionLike(value: unknown): value is Question {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const entry = value as Record<string, unknown>;
    return (
        typeof entry.num === "string" &&
        NUM.test(entry.num) &&
        typeof entry.id === "string" &&
        typeof entry.question === "string" &&
        entry.question.trim().length > 0 &&
        typeof entry.a === "string" &&
        typeof entry.b === "string" &&
        typeof entry.c === "string" &&
        typeof entry.d === "string" &&
        typeof entry.solution === "string" &&
        SOLUTIONS.has(entry.solution) &&
        typeof entry.image === "string" &&
        (entry.category === undefined || entry.category === null || typeof entry.category === "string")
    );
}

/**
 * True only for a complete catalogue: well-formed entries, unique numbers,
 * all general questions, and every state still represented.
 */
export function isQuestionCatalogue(value: unknown): value is Question[] {
    if (!Array.isArray(value) || value.length < MIN_GENERAL_QUESTIONS || value.length > MAX_QUESTIONS) {
        return false;
    }
    if (!value.every(isQuestionLike)) {
        return false;
    }
    const nums = new Set(value.map((question) => question.num));
    if (nums.size !== value.length) {
        return false;
    }
    const general = value.filter((question) => /^\d+$/.test(question.num)).length;
    if (general < MIN_GENERAL_QUESTIONS) {
        return false;
    }
    return statesData().every((state) => value.filter((question) => question.num.startsWith(`${state.code}-`)).length >= MIN_STATE_QUESTIONS);
}

export const questionStore = createRemoteStore<Question[]>({ key: QUESTIONS_KEY, isValid: isQuestionCatalogue, versioned: true });

function sameQuestion(left: Question, right: Question): boolean {
    return FIELDS.every((field) => (left[field] ?? null) === (right[field] ?? null));
}

/** True when both catalogues hold the same questions in the same order. */
export function sameCatalogue(left: Question[], right: Question[]): boolean {
    return left.length === right.length && left.every((question, index) => sameQuestion(question, right[index]));
}

/** Numbers whose question, answers, solution or image differ from the bundled copy, plus numbers the bundle lacks. */
export function changedQuestionNums(downloaded: Question[], bundled: Question[]): Set<string> {
    const byNum = new Map(bundled.map((question) => [question.num, question]));
    const changed = new Set<string>();
    for (const question of downloaded) {
        const original = byNum.get(question.num);
        if (!original || !sameQuestion(question, original)) {
            changed.add(question.num);
        }
    }
    return changed;
}

/**
 * What to keep from a valid download: nothing when it equals the bundled
 * catalogue. The file carries website URLs for its pictures (for apps up to
 * 2.1.25); those this build bundles are compared and kept as the local file.
 */
export function keepIfDifferent(downloaded: Question[]): Question[] | null {
    const local = withBundledPictures(downloaded);
    return sameCatalogue(local, questionsData()) ? null : local;
}

/** The downloaded catalogue to use instead of the bundled one, or null; bundled pictures point at their local files. */
export function readDownloadedCatalogue(): Question[] | null {
    const data = questionStore.read().data;
    return data ? withBundledPictures(data) : null;
}
