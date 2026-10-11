import { questionsData } from "@/data/data";
import { categories, Question } from "@/types/question";
import { changedQuestionNums, readDownloadedCatalogue } from "@/utils/question-store";

/**
 * Read-only access to the question catalogue.
 *
 * `questionsData()` returns a fresh deep copy on every call, which is costly in
 * render paths. This module loads the catalogue once, cleans the category
 * names, and offers lookups. Treat the returned objects as read-only.
 *
 * On Android a newer catalogue downloaded by `services/questions.ts` replaces
 * the bundled one at this first load (ADR-006); `isQuestionChanged` tells
 * which questions differ from the bundle so stale explanations stay hidden.
 */

export type Category = NonNullable<Question["category"]>;
export type AnswerOption = "a" | "b" | "c" | "d";
export const ANSWER_OPTIONS: readonly AnswerOption[] = ["a", "b", "c", "d"];

/** Number of questions in a real exam and the general/state split. */
export const EXAM_QUESTION_COUNT = 33;
export const EXAM_GENERAL_COUNT = 30;
export const EXAM_STATE_COUNT = 3;
/** Real exam duration in seconds. */
export const EXAM_DURATION_SECONDS = 60 * 60;

let bank: Question[] | null = null;
let byNum: Map<string, Question> | null = null;
let source: "bundled" | "downloaded" = "bundled";
let changed: Set<string> = new Set();

/**
 * Some catalogue entries carry stray quotes or spaces around the category
 * (for example "'Elections'"). Unknown values fall back to "General".
 */
export function normalizeCategory(raw: string | null | undefined): Category {
    const cleaned = (raw ?? "").replace(/['"]/g, "").trim();
    const match = (categories as string[]).find((category) => category === cleaned);
    return (match ?? "General") as Category;
}

/** All questions (general and every state), loaded once. */
export function getQuestionBank(): Question[] {
    if (!bank) {
        const downloaded = readDownloadedCatalogue();
        source = downloaded ? "downloaded" : "bundled";
        changed = downloaded ? changedQuestionNums(downloaded, questionsData()) : new Set();
        bank = (downloaded ?? questionsData()).map((question) => ({
            ...question,
            category: normalizeCategory(question.category),
        }));
    }
    return bank;
}

/** Where the loaded catalogue came from. */
export function getQuestionBankSource(): "bundled" | "downloaded" {
    getQuestionBank();
    return source;
}

/** True when the loaded catalogue's version of this question differs from the bundled one. */
export function isQuestionChanged(num: string): boolean {
    getQuestionBank();
    return changed.has(num);
}

/** Question by its catalogue number, e.g. "42" or "BE-3". */
export function getQuestion(num: string): Question | undefined {
    if (!byNum) {
        byNum = new Map(getQuestionBank().map((question) => [question.num, question]));
    }
    return byNum.get(num);
}

/** True for the 300 general questions, which have plain numeric numbers. */
export function isGeneralQuestion(num: string): boolean {
    return /^\d+$/.test(num);
}

/** True for questions of the given state, e.g. "BE-3" for "BE". */
export function isStateQuestion(num: string, stateCode: string): boolean {
    return Boolean(stateCode) && num.startsWith(`${stateCode}-`);
}

/** True when a question belongs to the learner's catalogue (general + own state). */
export function isRelevantQuestion(num: string, stateCode: string): boolean {
    return isGeneralQuestion(num) || isStateQuestion(num, stateCode);
}

/** The learner's catalogue: 300 general questions plus the 10 of their state. */
export function getRelevantQuestions(stateCode: string): Question[] {
    return getQuestionBank().filter((question) => isRelevantQuestion(question.num, stateCode));
}

/** Only the questions of one state. */
export function getStateQuestions(stateCode: string): Question[] {
    return getQuestionBank().filter((question) => isStateQuestion(question.num, stateCode));
}

/** Categories that have at least one question in the learner's catalogue, with counts. */
export function getCategoryCounts(stateCode: string): { category: Category; total: number }[] {
    const counts = new Map<Category, number>();
    for (const question of getRelevantQuestions(stateCode)) {
        const category = normalizeCategory(question.category);
        counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return categories
        .filter((category) => counts.has(category as Category))
        .map((category) => ({ category: category as Category, total: counts.get(category as Category) ?? 0 }));
}

/** Test-only: forget the cached catalogue. */
export function resetQuestionBankCache(): void {
    bank = null;
    byNum = null;
    source = "bundled";
    changed = new Set();
}
