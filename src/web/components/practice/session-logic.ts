import type { AnswerState } from "@/components/question/answer-option";
import type { Question } from "@/types/question";
import type { User } from "@/types/user";
import { ANSWER_OPTIONS, getRelevantQuestions, normalizeCategory, type AnswerOption, type Category } from "@/utils/question-bank";

/**
 * Pure state and helpers of a practice session. The session screen keeps the
 * question list, the position, and what happened per question in memory;
 * the learner's record is written through `utils/practice-logic` separately.
 */

export type SessionResult = "correct" | "wrong" | "skipped";

export interface SessionEntry {
    num: string;
    result: SessionResult;
}

export interface GradedAnswer {
    option: AnswerOption;
    correct: boolean;
}

export interface SessionState {
    questions: Question[];
    /** Position in `questions`. */
    index: number;
    /** Option picked but not graded yet (confirm mode). */
    selected: AnswerOption | null;
    /** Set once the current question was answered. */
    graded: GradedAnswer | null;
    /** One entry per question that was answered or skipped, in order. */
    log: SessionEntry[];
    /** True after the last question was left. */
    finished: boolean;
    /** Counts up on every restart so per-question UI can reset. */
    round: number;
}

export type SessionAction =
    | { type: "select"; option: AnswerOption }
    | { type: "answer"; option: AnswerOption; correct: boolean }
    | { type: "skip" }
    | { type: "next" }
    | { type: "restart"; questions: Question[] };

export function createSession(questions: Question[], round = 0): SessionState {
    return { questions, index: 0, selected: null, graded: null, log: [], finished: false, round };
}

/** Leaves the current question: moves to the next one or ends the session. */
function leaveQuestion(state: SessionState, log: SessionEntry[]): SessionState {
    const next = state.index + 1;
    if (next >= state.questions.length) {
        return { ...state, log, selected: null, graded: null, finished: true };
    }
    return { ...state, log, index: next, selected: null, graded: null };
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
    const question = state.questions[state.index];
    switch (action.type) {
        case "select":
            if (state.graded || state.finished || !question) {
                return state;
            }
            return state.selected === action.option ? state : { ...state, selected: action.option };
        case "answer":
            if (state.graded || state.finished || !question) {
                return state;
            }
            return {
                ...state,
                selected: action.option,
                graded: { option: action.option, correct: action.correct },
                log: state.log.concat({ num: question.num, result: action.correct ? "correct" : "wrong" }),
            };
        case "skip":
            if (state.graded || state.finished || !question) {
                return state;
            }
            return leaveQuestion(state, state.log.concat({ num: question.num, result: "skipped" }));
        case "next":
            if (!state.graded || state.finished || !question) {
                return state;
            }
            // The answer is already in the log.
            return leaveQuestion(state, state.log);
        case "restart":
            return createSession(action.questions, state.round + 1);
        default:
            return state;
    }
}

export interface SessionSummary {
    total: number;
    /** Correct plus wrong. */
    answered: number;
    correct: number;
    wrong: number;
    skipped: number;
    /** 0 to 100, or null when nothing was answered. */
    accuracy: number | null;
    /** Questions answered wrong, in session order. */
    wrongQuestions: Question[];
}

export function summarizeSession(log: SessionEntry[], questions: Question[]): SessionSummary {
    const byNum = new Map(questions.map((question) => [question.num, question]));
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    const wrongQuestions: Question[] = [];
    const seenWrong = new Set<string>();
    for (const entry of log) {
        if (entry.result === "correct") {
            correct++;
        } else if (entry.result === "wrong") {
            wrong++;
            const question = byNum.get(entry.num);
            if (question && !seenWrong.has(entry.num)) {
                seenWrong.add(entry.num);
                wrongQuestions.push(question);
            }
        } else {
            skipped++;
        }
    }
    const answered = correct + wrong;
    return {
        total: questions.length,
        answered,
        correct,
        wrong,
        skipped,
        accuracy: answered > 0 ? Math.round((correct / answered) * 100) : null,
        wrongQuestions,
    };
}

/** Visual state of every answer of the current question. */
export function answerStates(question: Question, selected: AnswerOption | null, graded: GradedAnswer | null): Record<AnswerOption, AnswerState> {
    const states = {} as Record<AnswerOption, AnswerState>;
    for (const option of ANSWER_OPTIONS) {
        if (!graded) {
            states[option] = option === selected ? "selected" : "idle";
        } else if (option === graded.option) {
            states[option] = graded.correct ? "correct" : "wrong";
        } else if (!graded.correct && option === question.solution) {
            states[option] = "reveal";
        } else {
            states[option] = "dimmed";
        }
    }
    return states;
}

export function isAnswerOption(value: string | null | undefined): value is AnswerOption {
    return typeof value === "string" && (ANSWER_OPTIONS as readonly string[]).includes(value);
}

export type KeyAction = { type: "select"; option: AnswerOption } | { type: "primary" } | { type: "skip" } | { type: "flag" };

interface KeyLike {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
}

/**
 * Keyboard shortcuts of the session: 1-4 or A-D pick an answer, Enter checks
 * or moves on, S skips, F flags. Presses with a modifier key are left to the
 * browser.
 */
export function keyAction(event: KeyLike): KeyAction | null {
    if (event.ctrlKey || event.metaKey || event.altKey) {
        return null;
    }
    const key = event.key;
    if (key === "Enter") {
        return { type: "primary" };
    }
    if (key.length !== 1) {
        return null;
    }
    const digit = Number.parseInt(key, 10);
    if (digit >= 1 && digit <= ANSWER_OPTIONS.length) {
        return { type: "select", option: ANSWER_OPTIONS[digit - 1] };
    }
    const lower = key.toLowerCase();
    if (isAnswerOption(lower)) {
        return { type: "select", option: lower };
    }
    if (lower === "s") {
        return { type: "skip" };
    }
    if (lower === "f") {
        return { type: "flag" };
    }
    return null;
}

const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const CAPTURED_CONTEXT = '[role="listbox"], [role="dialog"], [role="combobox"], [role="menu"], [aria-haspopup]';

/** True when a key press belongs to a field, a menu, or a dialog rather than the session. */
export function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
        return false;
    }
    if (TYPING_TAGS.has(target.tagName)) {
        return true;
    }
    if (target instanceof HTMLElement && target.isContentEditable) {
        return true;
    }
    return target.closest(CAPTURED_CONTEXT) !== null;
}

/** True for buttons and links, which act on Enter by themselves. */
export function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
        return false;
    }
    return target.closest('button, a[href], [role="button"], [role="link"], summary') !== null;
}

export interface TopicStats {
    category: Category;
    total: number;
    /** Answered correctly at the last attempt. */
    known: number;
    /** Answered wrong at the last attempt. */
    wrong: number;
}

/** Known and wrong questions per topic of the learner's catalogue. */
export function topicStats(user: User): Map<Category, TopicStats> {
    const stats = new Map<Category, TopicStats>();
    const progress = new Map<string, boolean | null | undefined>();
    for (const entry of user.questionProgress ?? []) {
        // Writers update the first entry of a question, so the first one is current.
        if (entry && typeof entry.num === "string" && !progress.has(entry.num)) {
            progress.set(entry.num, entry.answeredCorrectly);
        }
    }
    for (const question of getRelevantQuestions(user.state?.stateCode ?? "")) {
        const category = normalizeCategory(question.category);
        const stat = stats.get(category) ?? { category, total: 0, known: 0, wrong: 0 };
        stat.total++;
        const result = progress.get(question.num);
        if (result === true) {
            stat.known++;
        } else if (result === false) {
            stat.wrong++;
        }
        stats.set(category, stat);
    }
    return stats;
}

/** Session size from a `?size=` value: a whole number, 0 meaning all; otherwise undefined. */
export function parseSessionSize(value: string | null | undefined): number | undefined {
    if (value == null || value.trim() === "") {
        return undefined;
    }
    const size = Number(value);
    return Number.isInteger(size) && size >= 0 ? size : undefined;
}

export const TRANSLATION_LANGUAGES = [
    { code: "en", label: "English", rtl: false },
    { code: "tr", label: "Türkçe", rtl: false },
    { code: "ru", label: "Русский", rtl: false },
    { code: "fr", label: "Français", rtl: false },
    { code: "ar", label: "العربية", rtl: true },
    { code: "uk", label: "Українська", rtl: false },
    { code: "hi", label: "हिन्दी", rtl: false },
] as const;

export type TranslationLanguage = (typeof TRANSLATION_LANGUAGES)[number]["code"];

export function normalizeTranslationLanguage(code: string | null | undefined): TranslationLanguage {
    const found = TRANSLATION_LANGUAGES.find((language) => language.code === code);
    return found ? found.code : "en";
}

/** Text read aloud for a question: the question followed by the lettered answers. */
export function speechText(question: Question): string {
    return [question.question, ...ANSWER_OPTIONS.map((option) => `${option.toUpperCase()}: ${question[option]}`)].join(". ");
}
