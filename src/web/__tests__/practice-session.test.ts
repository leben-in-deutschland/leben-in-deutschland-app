// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
    answerStates,
    createSession,
    isInteractiveTarget,
    isTypingTarget,
    keyAction,
    normalizeTranslationLanguage,
    parseSessionSize,
    sessionReducer,
    speechText,
    summarizeSession,
    topicStats,
    TRANSLATION_LANGUAGES,
    type SessionState,
} from "@/components/practice/session-logic";
import type { Question } from "@/types/question";
import type { User, UserQuestionProgress } from "@/types/user";
import { getCategoryCounts, getQuestion, getRelevantQuestions, normalizeCategory } from "@/utils/question-bank";

function question(num: string, solution = "a", overrides: Partial<Question> = {}): Question {
    return {
        num,
        id: num,
        question: `Frage ${num}`,
        a: "Antwort A",
        b: "Antwort B",
        c: "Antwort C",
        d: "Antwort D",
        solution,
        image: "-",
        category: "General",
        ...overrides,
    };
}

const Q1 = question("1", "a");
const Q2 = question("2", "c");
const Q3 = question("3", "b");

/** Minimal record as older app versions wrote it: none of the 2.1 fields. */
function makeUser(questionProgress: UserQuestionProgress[] = []): User {
    return {
        id: "test-user",
        state: { stateName: "Berlin", stateCode: "BE" },
        dailyProgress: [],
        questionProgress,
        testProgress: [],
        appLanguage: "de",
        appFirstTimeOpenDateTime: new Date(2026, 0, 1),
        lastReviewPromptDateTime: null,
        reviewNoCount: 0,
        userReviewed: false,
    };
}

function run(state: SessionState, ...actions: Parameters<typeof sessionReducer>[1][]): SessionState {
    return actions.reduce(sessionReducer, state);
}

describe("sessionReducer", () => {
    it("starts at the first question with nothing selected", () => {
        const state = createSession([Q1, Q2]);
        expect(state.index).toBe(0);
        expect(state.selected).toBeNull();
        expect(state.graded).toBeNull();
        expect(state.log).toEqual([]);
        expect(state.finished).toBe(false);
    });

    it("selects without grading and ignores a repeated selection", () => {
        const start = createSession([Q1, Q2]);
        const selected = sessionReducer(start, { type: "select", option: "b" });
        expect(selected.selected).toBe("b");
        expect(selected.graded).toBeNull();
        expect(selected.log).toEqual([]);
        expect(sessionReducer(selected, { type: "select", option: "b" })).toBe(selected);
    });

    it("grades an answer once and logs it", () => {
        const graded = run(createSession([Q1, Q2]), { type: "answer", option: "b", correct: false });
        expect(graded.graded).toEqual({ option: "b", correct: false });
        expect(graded.selected).toBe("b");
        expect(graded.log).toEqual([{ num: "1", result: "wrong" }]);
        // A second answer to the same question changes nothing.
        expect(sessionReducer(graded, { type: "answer", option: "a", correct: true })).toBe(graded);
        expect(sessionReducer(graded, { type: "select", option: "a" })).toBe(graded);
    });

    it("moves on only after grading and ends after the last question", () => {
        const start = createSession([Q1, Q2]);
        expect(sessionReducer(start, { type: "next" })).toBe(start);
        const second = run(start, { type: "answer", option: "a", correct: true }, { type: "next" });
        expect(second.index).toBe(1);
        expect(second.selected).toBeNull();
        expect(second.graded).toBeNull();
        expect(second.finished).toBe(false);
        const done = run(second, { type: "answer", option: "c", correct: true }, { type: "next" });
        expect(done.finished).toBe(true);
        expect(done.log).toEqual([
            { num: "1", result: "correct" },
            { num: "2", result: "correct" },
        ]);
        // Nothing happens after the end.
        expect(sessionReducer(done, { type: "answer", option: "a", correct: true })).toBe(done);
        expect(sessionReducer(done, { type: "skip" })).toBe(done);
    });

    it("skips an ungraded question and advances, but not a graded one", () => {
        const skipped = sessionReducer(createSession([Q1, Q2]), { type: "skip" });
        expect(skipped.index).toBe(1);
        expect(skipped.log).toEqual([{ num: "1", result: "skipped" }]);
        const graded = sessionReducer(skipped, { type: "answer", option: "c", correct: true });
        expect(sessionReducer(graded, { type: "skip" })).toBe(graded);
    });

    it("finishes when the last question is skipped", () => {
        const done = run(createSession([Q1]), { type: "skip" });
        expect(done.finished).toBe(true);
        expect(done.log).toEqual([{ num: "1", result: "skipped" }]);
    });

    it("restarts with new questions and counts the round", () => {
        const done = run(createSession([Q1, Q2]), { type: "skip" }, { type: "skip" });
        const again = sessionReducer(done, { type: "restart", questions: [Q2] });
        expect(again.questions).toEqual([Q2]);
        expect(again.index).toBe(0);
        expect(again.log).toEqual([]);
        expect(again.finished).toBe(false);
        expect(again.round).toBe(1);
    });

    it("does nothing on an empty session", () => {
        const empty = createSession([]);
        expect(sessionReducer(empty, { type: "select", option: "a" })).toBe(empty);
        expect(sessionReducer(empty, { type: "skip" })).toBe(empty);
        expect(sessionReducer(empty, { type: "next" })).toBe(empty);
    });
});

describe("summarizeSession", () => {
    it("counts results and lists wrong questions in session order", () => {
        const summary = summarizeSession(
            [
                { num: "1", result: "wrong" },
                { num: "2", result: "correct" },
                { num: "3", result: "wrong" },
            ],
            [Q1, Q2, Q3],
        );
        expect(summary).toMatchObject({ total: 3, answered: 3, correct: 1, wrong: 2, skipped: 0, accuracy: 33 });
        expect(summary.wrongQuestions.map((entry) => entry.num)).toEqual(["1", "3"]);
    });

    it("has no accuracy when nothing was answered", () => {
        const summary = summarizeSession([{ num: "1", result: "skipped" }], [Q1, Q2]);
        expect(summary).toMatchObject({ total: 2, answered: 0, skipped: 1, accuracy: null, wrongQuestions: [] });
    });

    it("rounds the accuracy and ignores unknown numbers", () => {
        const summary = summarizeSession(
            [
                { num: "1", result: "correct" },
                { num: "2", result: "correct" },
                { num: "99", result: "wrong" },
            ],
            [Q1, Q2],
        );
        expect(summary.accuracy).toBe(67);
        expect(summary.wrong).toBe(1);
        expect(summary.wrongQuestions).toEqual([]);
    });
});

describe("answerStates", () => {
    it("shows the selection before grading", () => {
        expect(answerStates(Q2, null, null)).toEqual({ a: "idle", b: "idle", c: "idle", d: "idle" });
        expect(answerStates(Q2, "b", null)).toEqual({ a: "idle", b: "selected", c: "idle", d: "idle" });
    });

    it("marks a correct answer and dims the rest", () => {
        expect(answerStates(Q2, "c", { option: "c", correct: true })).toEqual({ a: "dimmed", b: "dimmed", c: "correct", d: "dimmed" });
    });

    it("marks a wrong answer and reveals the right one", () => {
        expect(answerStates(Q2, "a", { option: "a", correct: false })).toEqual({ a: "wrong", b: "dimmed", c: "reveal", d: "dimmed" });
    });
});

describe("keyAction", () => {
    it("maps digits and letters to answers", () => {
        expect(keyAction({ key: "1" })).toEqual({ type: "select", option: "a" });
        expect(keyAction({ key: "4" })).toEqual({ type: "select", option: "d" });
        expect(keyAction({ key: "b" })).toEqual({ type: "select", option: "b" });
        expect(keyAction({ key: "C" })).toEqual({ type: "select", option: "c" });
    });

    it("maps Enter, S, and F", () => {
        expect(keyAction({ key: "Enter" })).toEqual({ type: "primary" });
        expect(keyAction({ key: "s" })).toEqual({ type: "skip" });
        expect(keyAction({ key: "F" })).toEqual({ type: "flag" });
    });

    it("ignores other keys and modifier combinations", () => {
        expect(keyAction({ key: "5" })).toBeNull();
        expect(keyAction({ key: "0" })).toBeNull();
        expect(keyAction({ key: "e" })).toBeNull();
        expect(keyAction({ key: "Escape" })).toBeNull();
        expect(keyAction({ key: "ArrowDown" })).toBeNull();
        expect(keyAction({ key: "1", ctrlKey: true })).toBeNull();
        expect(keyAction({ key: "f", metaKey: true })).toBeNull();
        expect(keyAction({ key: "s", altKey: true })).toBeNull();
    });
});

describe("isTypingTarget / isInteractiveTarget", () => {
    it("treats fields, editable areas, and menus as typing targets", () => {
        document.body.innerHTML = `
            <input id="field" />
            <textarea id="area"></textarea>
            <div id="editable" contenteditable="true"></div>
            <div role="listbox"><div id="option" role="option"></div></div>
            <button id="trigger" aria-haspopup="listbox"></button>
            <button id="plain"></button>
            <a id="link" href="/practice"><span id="inner"></span></a>
            <p id="text"></p>
        `;
        const byId = (id: string) => document.getElementById(id);
        expect(isTypingTarget(byId("field"))).toBe(true);
        expect(isTypingTarget(byId("area"))).toBe(true);
        expect(isTypingTarget(byId("option"))).toBe(true);
        expect(isTypingTarget(byId("trigger"))).toBe(true);
        expect(isTypingTarget(byId("plain"))).toBe(false);
        expect(isTypingTarget(byId("text"))).toBe(false);
        expect(isTypingTarget(document.body)).toBe(false);
        expect(isTypingTarget(null)).toBe(false);

        expect(isInteractiveTarget(byId("plain"))).toBe(true);
        expect(isInteractiveTarget(byId("inner"))).toBe(true);
        expect(isInteractiveTarget(byId("text"))).toBe(false);
        expect(isInteractiveTarget(document.body)).toBe(false);
        expect(isInteractiveTarget(null)).toBe(false);
    });
});

describe("topicStats", () => {
    it("counts known and wrong questions per topic from the first progress entry", () => {
        const berlin = getRelevantQuestions("BE");
        const first = berlin[0];
        const second = berlin.find((entry) => normalizeCategory(entry.category) === normalizeCategory(first.category) && entry.num !== first.num)!;
        const user = makeUser([
            { num: first.num, answeredCorrectly: true, skipped: false, answerSelected: first.solution, flagged: false },
            // Older records may hold duplicates; the first entry wins.
            { num: first.num, answeredCorrectly: false, skipped: false, answerSelected: "a", flagged: false },
            { num: second.num, answeredCorrectly: false, skipped: false, answerSelected: "a", flagged: false },
            // Legacy entries with null results count as neither.
            { num: berlin[berlin.length - 1].num, answeredCorrectly: null, skipped: true, answerSelected: null, flagged: false },
        ]);
        const stats = topicStats(user);
        const category = normalizeCategory(first.category);
        const total = getCategoryCounts("BE").find((entry) => entry.category === category)!.total;
        expect(stats.get(category)).toEqual({ category, total, known: 1, wrong: 1 });
        const totals = Array.from(stats.values()).reduce((sum, entry) => sum + entry.total, 0);
        expect(totals).toBe(berlin.length);
    });

    it("works for a record without a state or progress list", () => {
        const user = { ...makeUser(), state: undefined as unknown as User["state"], questionProgress: undefined as unknown as [] };
        const stats = topicStats(user);
        expect(stats.size).toBeGreaterThan(0);
        for (const entry of stats.values()) {
            expect(entry.known).toBe(0);
            expect(entry.wrong).toBe(0);
        }
    });
});

describe("parseSessionSize", () => {
    it("accepts whole numbers including 0 for all", () => {
        expect(parseSessionSize("10")).toBe(10);
        expect(parseSessionSize("0")).toBe(0);
        expect(parseSessionSize("33")).toBe(33);
    });

    it("rejects anything else", () => {
        expect(parseSessionSize(null)).toBeUndefined();
        expect(parseSessionSize("")).toBeUndefined();
        expect(parseSessionSize("abc")).toBeUndefined();
        expect(parseSessionSize("-5")).toBeUndefined();
        expect(parseSessionSize("2.5")).toBeUndefined();
    });
});

describe("translation languages", () => {
    it("offers the seven translated languages and falls back to English", () => {
        expect(TRANSLATION_LANGUAGES.map((entry) => entry.code)).toEqual(["en", "tr", "ru", "fr", "ar", "uk", "hi"]);
        expect(normalizeTranslationLanguage("tr")).toBe("tr");
        expect(normalizeTranslationLanguage("de")).toBe("en");
        expect(normalizeTranslationLanguage(undefined)).toBe("en");
    });
});

describe("speechText", () => {
    it("reads the question and the lettered answers", () => {
        const real = getQuestion("1")!;
        const text = speechText(real);
        expect(text.startsWith(real.question)).toBe(true);
        expect(text).toContain(`A: ${real.a}`);
        expect(text).toContain(`D: ${real.d}`);
    });
});
