import { Question } from "@/types/question";
import { User, UserQuestionProgress } from "@/types/user";
import { getRelevantQuestions, isStateQuestion, normalizeCategory } from "./question-bank";
import { dueCount, dueItems } from "./review-schedule";
import { DEFAULT_PREFERENCES, prefsOf } from "./user-defaults";

/**
 * Study modes: which questions a practice session asks, and in which order.
 *
 * Every mode draws only from the learner's catalogue (the general questions
 * plus those of their federal state), so answers kept from an earlier state
 * never show up. Questions keep catalogue order unless a mode says otherwise.
 * Pure: the caller passes "today" as a "YYYY-MM-DD" day key and may pass the
 * random source of the quick round.
 */

export type StudyModeId =
    | "new"
    | "review"
    | "incorrect"
    | "flagged"
    | "skipped"
    | "state"
    | "category"
    | "quick"
    | "marathon"
    | "correct";

export type ModeAccent = "primary" | "secondary" | "success" | "warning" | "danger" | "default";

export interface StudyModeDef {
    id: StudyModeId;
    /** Translation key "mode_<id>_title". */
    titleKey: string;
    /** Translation key "mode_<id>_desc". */
    descriptionKey: string;
    /** Name of an icon in the app's icon set. */
    icon: string;
    accent: ModeAccent;
    /** False for modes whose sessions always have a fixed set of questions. */
    usesSessionSize: boolean;
}

function defineMode(id: StudyModeId, icon: string, accent: ModeAccent, usesSessionSize = true): StudyModeDef {
    return { id, titleKey: `mode_${id}_title`, descriptionKey: `mode_${id}_desc`, icon, accent, usesSessionSize };
}

/** All study modes, in display order. */
export const STUDY_MODES: StudyModeDef[] = [
    defineMode("new", "sparkles", "primary"),
    defineMode("review", "repeat", "secondary"),
    defineMode("incorrect", "target", "danger"),
    defineMode("flagged", "flag", "warning"),
    defineMode("skipped", "skip", "default"),
    // The questions of the learner's state always form one session.
    defineMode("state", "map-pin", "primary", false),
    defineMode("category", "layers", "secondary"),
    // Always QUICK_ROUND_SIZE questions.
    defineMode("quick", "zap", "warning", false),
    defineMode("marathon", "route", "default"),
    defineMode("correct", "check-circle", "success"),
];

export const QUICK_ROUND_SIZE = 10;

/** A backlog of at least this many due or wrong questions comes before new questions. */
const BACKLOG_THRESHOLD = 5;

/** How many modes the practice hub shows before folding the rest away. */
const PRIMARY_MODE_COUNT = 4;

/** Values of `/prepare?action=` written by version 2.0. */
const LEGACY_ACTIONS = new Map<string, StudyModeId>([
    ["prepare", "new"],
    ["random", "quick"],
    ["failed", "incorrect"],
]);

/** Shape of a catalogue number in `/prepare?start=`: "12" or "BE-3" (the longest real number has five characters). */
const START_PARAM = /^[A-Za-z0-9-]{1,8}$/;

export interface ModeOptions {
    /** "YYYY-MM-DD"; decides which review questions are due. */
    today: string;
    /**
     * Topic of the "category" mode, a category name as `normalizeCategory`
     * returns it. Without one the mode covers every topic.
     */
    category?: string;
    /** Questions per session, 0 for all. Default: the learner's preference. */
    sessionSize?: number;
    /** Random source of the quick round, returning 0 <= x < 1. Default: Math.random. */
    random?: () => number;
    /**
     * Catalogue number of the question the session opens with, e.g. "12" or
     * "BE-3" from a "question of the day" notification. It is moved to the
     * front of the mode's list, or added there when the mode would not ask
     * it, and survives the session-size cut. Numbers outside the learner's
     * catalogue are ignored.
     */
    startNum?: string;
}

export type NextAction = { kind: "mode"; mode: StudyModeId; count: number } | { kind: "mock" };

export interface StudyModeSplit {
    /** The modes the practice hub shows first, in display order. */
    primary: StudyModeDef[];
    /** Every other mode, in the order of the input. */
    more: StudyModeDef[];
}

type Progress = UserQuestionProgress | undefined;

interface Catalogue {
    stateCode: string;
    /** The learner's questions in catalogue order. */
    questions: Question[];
    byNum: Map<string, Question>;
    /** Progress entry per question number. */
    progress: Map<string, UserQuestionProgress>;
}

function catalogueOf(user: User): Catalogue {
    const stateCode = user.state?.stateCode ?? "";
    const questions = getRelevantQuestions(stateCode);
    const progress = new Map<string, UserQuestionProgress>();
    for (const entry of user.questionProgress ?? []) {
        // Every writer updates the first entry of a question (findIndex), so
        // if an older record holds duplicates, the first one is current.
        if (entry && typeof entry.num === "string" && !progress.has(entry.num)) {
            progress.set(entry.num, entry);
        }
    }
    return {
        stateCode,
        questions,
        byNum: new Map(questions.map((question) => [question.num, question])),
        progress,
    };
}

function isIncorrect(entry: Progress): boolean {
    return entry?.answeredCorrectly === false;
}

function isCorrect(entry: Progress): boolean {
    return entry?.answeredCorrectly === true;
}

function isFlagged(entry: Progress): boolean {
    return Boolean(entry?.flagged);
}

/** Skipped, or opened without an answer and not just flagged (rule of version 2.0). */
function isSkipped(entry: Progress): boolean {
    if (!entry) {
        return false;
    }
    return Boolean(entry.skipped) || (entry.answeredCorrectly === null && !entry.flagged);
}

function withProgress(catalogue: Catalogue, keep: (entry: Progress) => boolean): Question[] {
    return catalogue.questions.filter((question) => keep(catalogue.progress.get(question.num)));
}

/** Orders by rank, lowest first, keeping catalogue order within a rank. */
function orderByRank(catalogue: Catalogue, questions: Question[], rankOf: (entry: Progress) => number): Question[] {
    return questions
        .map((question, index) => ({ question, index, rank: rankOf(catalogue.progress.get(question.num)) }))
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .map((ranked) => ranked.question);
}

/**
 * Order of the state mode, the group order of version 2.0: wrong, skipped,
 * flagged, then the rest. A question goes to the first group it fits.
 */
function stateRank(entry: Progress): number {
    if (isIncorrect(entry)) {
        return 0;
    }
    if (isSkipped(entry)) {
        return 1;
    }
    return isFlagged(entry) ? 2 : 3;
}

/** Order of the category mode: wrong, then not answered yet (or skipped), then known. */
function topicRank(entry: Progress): number {
    if (isIncorrect(entry)) {
        return 0;
    }
    return isCorrect(entry) ? 2 : 1;
}

function isInCatalogue(catalogue: Catalogue): (num: string) => boolean {
    return (num) => catalogue.byNum.has(num);
}

function reviewQuestions(user: User, catalogue: Catalogue, today: string): Question[] {
    const questions: Question[] = [];
    for (const item of dueItems(user.reviewSchedule, today, isInCatalogue(catalogue))) {
        const question = catalogue.byNum.get(item.num);
        if (question) {
            questions.push(question);
        }
    }
    return questions;
}

function topicQuestions(catalogue: Catalogue, category: string | undefined): Question[] {
    // The option may carry the stray quotes or spaces that some catalogue entries have.
    const wanted = (category ?? "").replace(/['"]/g, "").trim();
    const questions = wanted
        ? catalogue.questions.filter((question) => normalizeCategory(question.category) === wanted)
        : catalogue.questions;
    return orderByRank(catalogue, questions, topicRank);
}

/** All questions in catalogue order, starting at the first one never opened. */
function marathonQuestions(catalogue: Catalogue): Question[] {
    const { questions, progress } = catalogue;
    const start = questions.findIndex((question) => !progress.has(question.num));
    return start > 0 ? questions.slice(start).concat(questions.slice(0, start)) : questions.slice();
}

function randomIndex(random: () => number, size: number): number {
    const value = random();
    const index = Math.floor((Number.isFinite(value) ? value : 0) * size);
    return Math.min(size - 1, Math.max(0, index));
}

/** Up to `count` items drawn without repetition, in random order (partial Fisher-Yates). */
function pickRandom<T>(items: T[], count: number, random: () => number): T[] {
    const pool = items.slice();
    const take = Math.min(count, pool.length);
    for (let i = 0; i < take; i++) {
        const j = i + randomIndex(random, pool.length - i);
        const picked = pool[j];
        pool[j] = pool[i];
        pool[i] = picked;
    }
    return pool.slice(0, take);
}

/** Random questions, preferring those the learner does not know yet. */
function quickRound(catalogue: Catalogue, random: () => number): Question[] {
    const known: Question[] = [];
    const notKnown: Question[] = [];
    for (const question of catalogue.questions) {
        (isCorrect(catalogue.progress.get(question.num)) ? known : notKnown).push(question);
    }
    const picked = pickRandom(notKnown, QUICK_ROUND_SIZE, random);
    if (picked.length === QUICK_ROUND_SIZE) {
        return picked;
    }
    // Too few unknown questions: fill up with known ones and mix them in.
    const filled = picked.concat(pickRandom(known, QUICK_ROUND_SIZE - picked.length, random));
    return pickRandom(filled, filled.length, random);
}

/** The questions of a mode before the session size is applied. */
function modeQuestions(user: User, catalogue: Catalogue, mode: StudyModeId, options: ModeOptions): Question[] {
    switch (mode) {
        case "new":
            return withProgress(catalogue, (entry) => !entry);
        case "review":
            return reviewQuestions(user, catalogue, options.today);
        case "incorrect":
            return withProgress(catalogue, isIncorrect);
        case "flagged":
            return withProgress(catalogue, isFlagged);
        case "skipped":
            return withProgress(catalogue, isSkipped);
        case "state":
            return orderByRank(
                catalogue,
                catalogue.questions.filter((question) => isStateQuestion(question.num, catalogue.stateCode)),
                stateRank,
            );
        case "category":
            return topicQuestions(catalogue, options.category);
        case "quick":
            return quickRound(catalogue, options.random ?? Math.random);
        case "marathon":
            return marathonQuestions(catalogue);
        case "correct":
            return withProgress(catalogue, isCorrect);
        default:
            return [];
    }
}

/**
 * The mode's list opening with the start question: moved to the front when
 * the mode asks it anyway, otherwise added there. Numbers outside the
 * learner's catalogue leave the list as it is.
 */
function withStartQuestion(catalogue: Catalogue, questions: Question[], startNum: string | undefined): Question[] {
    // The option may carry the stray quotes or spaces that some data has.
    const num = (startNum ?? "").replace(/['"]/g, "").trim();
    const start = num ? catalogue.byNum.get(num) : undefined;
    if (!start) {
        return questions;
    }
    return [start, ...questions.filter((question) => question.num !== start.num)];
}

/** Longest session of a mode, 0 for no limit. */
function sessionLimit(user: User, mode: StudyModeId, options: ModeOptions): number {
    if (mode === "quick") {
        return QUICK_ROUND_SIZE;
    }
    if (!getStudyMode(mode).usesSessionSize) {
        return 0;
    }
    const size = Math.floor(options.sessionSize ?? prefsOf(user).sessionSize ?? DEFAULT_PREFERENCES.sessionSize);
    return size > 0 ? size : 0;
}

function modeCount(user: User, catalogue: Catalogue, mode: StudyModeId, today: string, category?: string): number {
    switch (mode) {
        case "quick":
            return Math.min(QUICK_ROUND_SIZE, catalogue.questions.length);
        case "marathon":
            return catalogue.questions.length;
        case "review":
            return dueCount(user.reviewSchedule, today, isInCatalogue(catalogue));
        default:
            return modeQuestions(user, catalogue, mode, { today, category }).length;
    }
}

/** Definition of a mode. Unknown ids get the "new" mode, as in parseModeParam. */
export function getStudyMode(id: StudyModeId): StudyModeDef {
    return STUDY_MODES.find((def) => def.id === id) ?? STUDY_MODES[0];
}

/**
 * Questions of one practice session. Modes that use the session size are cut
 * to `options.sessionSize` (default: the learner's preference; 0 means all).
 * The state mode is never cut and the quick round always has
 * QUICK_ROUND_SIZE questions (fewer only when the catalogue is smaller).
 * `options.startNum` comes first and is placed before the cut, so it is never
 * cut away; a quick round with an added start question drops its last draw.
 */
export function buildModeQuestions(user: User, mode: StudyModeId, options: ModeOptions): Question[] {
    const catalogue = catalogueOf(user);
    const questions = withStartQuestion(catalogue, modeQuestions(user, catalogue, mode, options), options.startNum);
    const limit = sessionLimit(user, mode, options);
    return limit > 0 ? questions.slice(0, limit) : questions;
}

/**
 * Questions a mode has to offer, ignoring the session size. The quick round
 * counts min(QUICK_ROUND_SIZE, catalogue size) and the marathon the whole
 * catalogue. Without a category, the category mode counts every topic.
 */
export function countForMode(user: User, mode: StudyModeId, today: string, category?: string): number {
    return modeCount(user, catalogueOf(user), mode, today, category);
}

/** `countForMode` for every mode (the category mode across all topics). */
export function modeCounts(user: User, today: string): Record<StudyModeId, number> {
    const catalogue = catalogueOf(user);
    const counts = {} as Record<StudyModeId, number>;
    for (const def of STUDY_MODES) {
        counts[def.id] = modeCount(user, catalogue, def.id, today);
    }
    return counts;
}

/**
 * The one thing to do next: clear a large backlog of due or wrong questions,
 * then learn new questions, then clear what is left, then take a mock exam.
 */
export function suggestNextAction(user: User, today: string): NextAction {
    const catalogue = catalogueOf(user);
    const due = modeCount(user, catalogue, "review", today);
    const incorrect = modeCount(user, catalogue, "incorrect", today);
    const fresh = modeCount(user, catalogue, "new", today);

    if (due >= BACKLOG_THRESHOLD) {
        return { kind: "mode", mode: "review", count: due };
    }
    if (incorrect >= BACKLOG_THRESHOLD) {
        return { kind: "mode", mode: "incorrect", count: incorrect };
    }
    if (fresh > 0) {
        return { kind: "mode", mode: "new", count: fresh };
    }
    if (due > 0) {
        return { kind: "mode", mode: "review", count: due };
    }
    if (incorrect > 0) {
        return { kind: "mode", mode: "incorrect", count: incorrect };
    }
    return { kind: "mock" };
}

/**
 * Splits the modes into the four the practice hub shows first and the rest.
 * The first slot goes to the recommended mode, or to new questions without a
 * recommendation; review, mistakes, and the quick round follow. A slot the
 * recommendation makes redundant goes back to new questions, then to the next
 * mode in display order, so there are always four primary modes when at least
 * four exist. No mode appears twice, and `more` keeps the display order.
 */
export function splitStudyModes(modes: readonly StudyModeDef[], recommended: StudyModeId | null = null): StudyModeSplit {
    const byId = new Map(modes.map((def) => [def.id, def]));
    const first = recommended !== null && byId.has(recommended) ? recommended : "new";
    const wanted: StudyModeId[] = [first, "review", "incorrect", "quick", "new", ...byId.keys()];
    const taken = new Set<StudyModeId>();
    const primary: StudyModeDef[] = [];
    for (const id of wanted) {
        if (primary.length === PRIMARY_MODE_COUNT) {
            break;
        }
        const def = byId.get(id);
        if (def && !taken.has(id)) {
            taken.add(id);
            primary.push(def);
        }
    }
    return { primary, more: modes.filter((def) => !taken.has(def.id)) };
}

/**
 * In-app route of a practice session, e.g.
 * "/prepare?action=category&category=Law%20%26%20Governance". With a
 * `startNum` the session opens with that question: "/prepare?action=review&start=12".
 */
export function modeHref(mode: StudyModeId, category?: string, startNum?: string): string {
    const base = `/prepare?action=${mode}`;
    const href = mode === "category" && category ? `${base}&category=${encodeURIComponent(category)}` : base;
    return startNum ? `${href}&start=${encodeURIComponent(startNum)}` : href;
}

/**
 * Mode of a `/prepare?action=` value. Understands the values of version 2.0
 * ("prepare", "random", "failed"); anything unknown starts learning new
 * questions.
 */
export function parseModeParam(action: string | null): StudyModeId {
    const value = (action ?? "").trim().toLowerCase();
    const legacy = LEGACY_ACTIONS.get(value);
    if (legacy) {
        return legacy;
    }
    const known = STUDY_MODES.find((def) => def.id === value);
    return known ? known.id : "new";
}

/**
 * Start question of a `/prepare?start=` value: the trimmed value when it has
 * the shape of a catalogue number (letters, digits, and hyphens, at most
 * eight characters), otherwise undefined. Whether the number exists in the
 * learner's catalogue is decided when the session is built.
 */
export function parseStartParam(value: string | null | undefined): string | undefined {
    const num = (value ?? "").trim();
    return START_PARAM.test(num) ? num : undefined;
}
